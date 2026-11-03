import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluarConfiguracionLectura } from '../../../scripts/check-admin-read-config.mjs';

const base = { NEXT_PUBLIC_SUPABASE_URL:'https://proyecto.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'publicable-ficticia',
  DENTAIA_ADMIN_READS_ENABLED:'true', DENTAIA_SUPABASE_ADMIN_READ_SECRET:'sb_secret_ficticia_no_real' };

test('preflight sin red distingue preparación de verificación real y nunca serializa valores', () => {
  const r=evaluarConfiguracionLectura(base);
  assert.equal(r.estado,'PREPARADO_PARA_INTENTAR_LECTURA');
  assert.equal(r.backendValidado,false);assert.equal(r.aal2Validado,false);
  for (const value of Object.values(base).filter(v=>v!=='true')) assert.equal(JSON.stringify(r).includes(value),false);
});

test('preflight exige activación exacta, credencial dedicada, URL HTTPS y clave pública', () => {
  for (const cambios of [{DENTAIA_ADMIN_READS_ENABLED:'TRUE'},{DENTAIA_ADMIN_READS_ENABLED:undefined},
    {DENTAIA_SUPABASE_ADMIN_READ_SECRET:'',SUPABASE_SECRET_KEY:'no-reutilizar'}, {NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''},
    {NEXT_PUBLIC_SUPABASE_URL:'http://proyecto.example.test'},{NEXT_PUBLIC_SUPABASE_URL:' https://proyecto.example.test'},
    {NEXT_PUBLIC_SUPABASE_URL:'https://proyecto.example.test/?secret=no-publicar'}]) {
    assert.equal(evaluarConfiguracionLectura({...base,...cambios}).estado,'BLOQUEADO_POR_CONFIGURACION');
  }
});

test('preflight detecta secretos modernos y service_role legacy bajo cualquier variable pública', () => {
  const legacy='cabecera.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.firma-ficticia';
  for(const cambios of [{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_no_publicar'},
    {NEXT_PUBLIC_CUALQUIERA:legacy},{NEXT_PUBLIC_SUPABASE_SECRET_KEY:'no-publicar'}]) {
    const r=evaluarConfiguracionLectura({...base,...cambios});
    assert.equal(r.requisitos.sinSecretosDetectadosEnVariablesPublicas,false);
    assert.equal(r.estado,'BLOQUEADO_POR_CONFIGURACION');assert.doesNotMatch(JSON.stringify(r),/no-publicar|firma-ficticia/);
  }
});
