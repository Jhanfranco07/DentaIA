import test from 'node:test';
import assert from 'node:assert/strict';
import { crearDesafioMfaAdministrativo, FalloMfaDesafio, mensajeFalloMfaDesafio } from './mfa-desafio.ts';

function preparar({ nivel = 'aal1', verificados = ['factor-verificado'], desafioFalla = false } = {}) {
  let actual = nivel;
  let llamadas = { usuario: 0, factores: 0, desafio: 0, enrolar: 0, eliminar: 0 };
  const usuario = { id: 'usuario-sintetico', aud: 'authenticated', confirmed_at: '2026-11-01T00:00:00Z' };
  const auth = {
    getUser: async () => { llamadas.usuario++; return { data: { user: usuario }, error: null }; },
    getSession: async () => ({ data: { session: { user: usuario, expires_at: Date.now() / 1000 + 300 } }, error: null }),
    mfa: {
      listFactors: async () => { llamadas.factores++; return { data: { totp: [...verificados.map(id => ({ id, status: 'verified' })), { id: 'factor-pendiente', status: 'unverified' }] }, error: null }; },
      challengeAndVerify: async ({ factorId, code }) => {
        llamadas.desafio++;
        if (desafioFalla || code !== '123456' || !verificados.includes(factorId)) return { error: { code: 'mfa_verification_failed', message: 'no-publicar' } };
        actual = 'aal2'; return { error: null };
      },
      getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: actual, nextLevel: 'aal2' }, error: null }),
      enroll: async () => { llamadas.enrolar++; throw Error('no permitido'); },
      unenroll: async () => { llamadas.eliminar++; throw Error('no permitido'); },
    },
  };
  return { flujo: crearDesafioMfaAdministrativo(() => auth), llamadas, auth };
}

test('el step-up verifica un factor TOTP existente y solo declara éxito después de AAL2', async () => {
  const p = preparar();
  assert.deepEqual(await p.flujo.factoresVerificados(), ['factor-verificado']);
  assert.equal(await p.flujo.verificar('factor-verificado', '123456'), true);
  assert.equal(p.llamadas.desafio, 1);
  assert.equal(p.llamadas.enrolar, 0);
  assert.equal(p.llamadas.eliminar, 0);
});

test('rechaza factores pendientes, códigos inválidos y errores Auth sin filtrar detalles', async () => {
  const p = preparar();
  await assert.rejects(p.flujo.verificar('factor-pendiente', '123456'), e => e instanceof FalloMfaDesafio && e.codigo === 'FACTOR_NO_DISPONIBLE');
  await assert.rejects(p.flujo.verificar('factor-verificado', 'abc'), e => e instanceof FalloMfaDesafio && e.codigo === 'CODIGO_INVALIDO');
  const fallo = preparar({ desafioFalla: true });
  await assert.rejects(fallo.flujo.verificar('factor-verificado', '123456'), e => {
    assert.equal(mensajeFalloMfaDesafio(e).includes('no-publicar'), false);
    return e instanceof FalloMfaDesafio && e.codigo === 'VERIFICACION_RECHAZADA';
  });
});

test('un desafío exitoso sin claim AAL2 sigue bloqueado', async () => {
  const p = preparar();
  p.auth.mfa.challengeAndVerify = async () => ({ error: null });
  await assert.rejects(p.flujo.verificar('factor-verificado', '123456'), e => e instanceof FalloMfaDesafio && e.codigo === 'NO_AAL2');
});
