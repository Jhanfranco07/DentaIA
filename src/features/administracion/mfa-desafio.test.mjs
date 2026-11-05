import test from 'node:test';
import assert from 'node:assert/strict';
import { crearDesafioMfaAdministrativo, FalloMfaDesafio, mensajeFalloMfaDesafio } from './mfa-desafio.ts';

function preparar({ nivel = 'aal1', verificados = ['factor-verificado'], errorDesafio = null, lanzarDesafio = null } = {}) {
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
        assert.equal(factorId, 'factor-verificado');
        if (lanzarDesafio) throw lanzarDesafio;
        if (errorDesafio) return { error: errorDesafio };
        if (code !== '123456' || !verificados.includes(factorId)) return { error: { code: 'mfa_verification_failed', message: 'secreto-no-publicar' } };
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

test('rechaza factores pendientes y códigos mal formados antes de llamar a Auth', async () => {
  const p = preparar();
  await assert.rejects(p.flujo.verificar('factor-pendiente', '123456'), e => e instanceof FalloMfaDesafio && e.codigo === 'FACTOR_NO_DISPONIBLE');
  await assert.rejects(p.flujo.verificar('factor-verificado', 'abc'), e => e instanceof FalloMfaDesafio && e.codigo === 'CODIGO_INVALIDO');
  assert.equal(p.llamadas.desafio, 0);
});

test('distingue rechazo TOTP, sesión caducada, límite, red y fallo del servicio sin filtrar detalles', async () => {
  const casos = [
    [{ code: 'mfa_verification_failed', message: 'codigo=123456 secreto=privado' }, 'CODIGO_RECHAZADO'],
    [{ code: 'session_expired', status: 401, message: 'jwt=privado' }, 'SESION_INVALIDA'],
    [{ code: 'over_request_rate_limit', status: 429, message: 'token=privado' }, 'LIMITE_INTENTOS'],
    [Object.assign(new Error('network payload privado'), { name: 'AuthRetryableFetchError', status: 0 }), 'RED_NO_DISPONIBLE'],
    [{ code: 'unexpected_failure', status: 503, message: 'detalles internos privados' }, 'SERVICIO_NO_DISPONIBLE'],
    [{ code: 'mfa_challenge_expired', message: 'no mostrar' }, 'DESAFIO_CADUCADO'],
    [{ code: 'another_error', status: 400, message: 'no mostrar' }, 'VERIFICACION_RECHAZADA'],
  ];

  for (const [errorDesafio, esperado] of casos) {
    const p = preparar({ errorDesafio });
    await assert.rejects(p.flujo.verificar('factor-verificado', '123456'), error => {
      assert.ok(error instanceof FalloMfaDesafio);
      assert.equal(error.codigo, esperado);
      const mensaje = mensajeFalloMfaDesafio(error);
      assert.equal(/123456|privado|jwt|token|internos/.test(mensaje), false);
      return true;
    });
    assert.equal(p.llamadas.desafio, 1);
  }

  const red = preparar({ lanzarDesafio: Object.assign(new Error('fetch failed'), { name: 'AuthRetryableFetchError', status: 0 }) });
  await assert.rejects(red.flujo.verificar('factor-verificado', '123456'), error => error.codigo === 'RED_NO_DISPONIBLE');
});

test('un desafío exitoso sin claim AAL2 sigue bloqueado', async () => {
  const p = preparar();
  p.auth.mfa.challengeAndVerify = async () => ({ error: null });
  await assert.rejects(p.flujo.verificar('factor-verificado', '123456'), e => e instanceof FalloMfaDesafio && e.codigo === 'NO_AAL2');
});
