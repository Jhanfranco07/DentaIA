import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Aprovisionamiento puntual del propietario, NO API de administración ni asignación general.
// Valor sintético para pruebas inyectadas. La CLI exige el objetivo en configuración privada.
export const UUID_OBJETIVO = '00000000-0000-4000-8000-000000000001';
export const URL_PROYECTO = 'https://vwmdknzjyvmsdqpepykz.supabase.co';
export const FRASE_CONFIRMACION = 'ASIGNAR SUPERUSUARIO DI-151 A LA CUENTA VERIFICADA';
const ASIGNACION = Object.freeze({ version: 1, estado: 'activo', roles: Object.freeze(['superusuario']) });
const objeto = v => v !== null && typeof v === 'object' && !Array.isArray(v);

const mensajes = {
  CONFIGURACION: 'Falta la configuración privada del proyecto esperado o contiene un valor no admitido.',
  CUENTA_NO_VERIFICADA: 'No se pudo verificar la cuenta objetivo. No se autoriza la escritura.',
  CUENTA_NO_HABILITADA: 'La cuenta objetivo no cumple los requisitos de identidad confirmada y habilitada.',
  METADATA_NO_ESPERADA: 'El proveedor o la asignación existente no coinciden con la operación revisada. Requiere nueva revisión.',
  CAMBIO_CONCURRENTE: 'La cuenta cambió desde la vista previa. Se cancela sin enviar una actualización.',
  CONFIRMACION_REQUERIDA: 'Se requiere confirmación explícita desde una terminal interactiva.',
  VERIFICACION_NO_DISPONIBLE: 'No se pudo leer el estado posterior. El resultado es incierto: no reintentar ni restaurar automáticamente.',
  VERIFICACION_DISTINTA: 'La lectura posterior no coincide con el resultado esperado. Requiere revisión; no se reintenta ni restaura automáticamente.',
  RAMA: 'Ejecutar exclusivamente desde feature/superusuario-admin en este repositorio.',
  USO: 'Uso: node scripts/asignar-superusuario.mjs [--resumen|--aplicar]',
  NO_DISPONIBLE: 'Operación no disponible. No se publican mensajes internos del proveedor ni credenciales.',
};
export class ErrorAsignacion extends Error {
  constructor(codigo) { super(mensajes[codigo] ?? mensajes.NO_DISPONIBLE); this.codigo = codigo; }
}
const fallo = codigo => { throw new ErrorAsignacion(codigo); };

function validarCuenta(user, objetivo) {
  if (!objeto(user) || user.id !== objetivo) fallo('CUENTA_NO_VERIFICADA');
  if (user.aud !== 'authenticated' || user.is_anonymous !== false || (user.deleted_at != null && user.deleted_at !== '')
    || typeof user.confirmed_at !== 'string' || !Number.isFinite(Date.parse(user.confirmed_at))) fallo('CUENTA_NO_HABILITADA');
  if (user.banned_until != null && user.banned_until !== '') {
    const hasta = typeof user.banned_until === 'string' ? Date.parse(user.banned_until) : NaN;
    if (!Number.isFinite(hasta) || hasta > Date.now()) fallo('CUENTA_NO_HABILITADA');
  }
  const metadata = user.app_metadata;
  if (!objeto(metadata) || metadata.provider !== 'email' || !isDeepStrictEqual(metadata.providers, ['email'])) fallo('METADATA_NO_ESPERADA');
  // No sobrescribir asignaciones o roles previos distintos de esta concesión puntual.
  if (Object.hasOwn(metadata, 'dentaia') && !isDeepStrictEqual(metadata.dentaia, ASIGNACION)) fallo('METADATA_NO_ESPERADA');
  return { metadata: structuredClone(metadata),
    identidad: { id: user.id, created_at: user.created_at, email: user.email } }; // Memoria, nunca salida/log.
}

async function leer(admin, objetivo) {
  try {
    const { data, error } = await admin.getUserById(objetivo);
    if (error || !data?.user) fallo('CUENTA_NO_VERIFICADA');
    return validarCuenta(data.user, objetivo);
  } catch (e) { if (e instanceof ErrorAsignacion) throw e; fallo('CUENTA_NO_VERIFICADA'); }
}

/** Núcleo inyectable: los tests usan exclusivamente fixtures. No imprime usuarios ni metadata. */
export async function prepararAsignacion(admin, objetivo = UUID_OBJETIVO) {
  if (typeof objetivo !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(objetivo)) fallo('CONFIGURACION');
  const inicial = await leer(admin, objetivo);
  const yaAsignado = Object.hasOwn(inicial.metadata, 'dentaia');
  const resumen = Object.freeze({ proyecto: 'Dental-IA', cuentaEsperadaVerificada: true,
    proveedorEsperadoVerificado: true, cuentaHabilitada: true, otrosMetadatosSeConservan: true,
    asignacion: ASIGNACION, cambioNecesario: !yaAsignado });
  let utilizado = false;
  return {
    resumen,
    async aplicar(confirmar) {
      if (utilizado) fallo('CONFIRMACION_REQUERIDA');
      utilizado = true;
      if (yaAsignado) return { resultado: 'YA_ASIGNADO_SIN_ESCRITURA', estadoVerificado: true };
      if (typeof confirmar !== 'function' || await confirmar(resumen) !== FRASE_CONFIRMACION) {
        return { resultado: 'CANCELADA_SIN_ESCRITURA', estadoVerificado: false };
      }
      // Lectura fresca DESPUÉS de la confirmación; detecta cambios durante la revisión humana.
      const actual = await leer(admin, objetivo);
      if (!isDeepStrictEqual(inicial, actual)) fallo('CAMBIO_CONCURRENTE');
      const esperado = { ...actual.metadata, dentaia: structuredClone(ASIGNACION) };
      let respuestaIncierta = false;
      try {
        const { error } = await admin.updateUserById(objetivo, { app_metadata: esperado });
        respuestaIncierta = !!error;
      } catch { respuestaIncierta = true; }
      // Siempre una lectura nueva: nunca anunciar éxito por la sola respuesta de update.
      let posterior;
      try { posterior = await leer(admin, objetivo); }
      catch { fallo('VERIFICACION_NO_DISPONIBLE'); }
      if (!isDeepStrictEqual(posterior.identidad, inicial.identidad) || !isDeepStrictEqual(posterior.metadata, esperado)) {
        fallo('VERIFICACION_DISTINTA');
      }
      return { resultado: respuestaIncierta ? 'ESTADO_VERIFICADO_RESPUESTA_DE_ESCRITURA_INCIERTA' : 'ASIGNACION_VERIFICADA',
        estadoVerificado: true, metadatosPreservados: true };
    },
  };
}

/** Cliente exclusivo del script: solo GET/PUT al UUID ligado a esta ejecución. */
export function crearAdminAsignacion(env, solicitar = fetch, objetivo = UUID_OBJETIVO) {
  const secret = env.DENTAIA_SUPABASE_ADMIN_READ_SECRET;
  if (typeof objetivo !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(objetivo)
    || env.NEXT_PUBLIC_SUPABASE_URL !== URL_PROYECTO || typeof secret !== 'string' || !secret.trim() || secret !== secret.trim()
    || secret.startsWith('sb_publishable_')) fallo('CONFIGURACION');
  let escrituras = 0;
  const cliente = createClient(URL_PROYECTO, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const metodo = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (url.origin !== URL_PROYECTO || url.pathname !== `/auth/v1/admin/users/${objetivo}`
        || url.search || !['GET', 'PUT'].includes(metodo)) fallo('NO_DISPONIBLE');
      if (metodo === 'PUT') {
        let body;
        try { body = JSON.parse(init?.body); } catch { fallo('NO_DISPONIBLE'); }
        if (escrituras || !objeto(body) || !isDeepStrictEqual(Object.keys(body), ['app_metadata'])
          || !objeto(body.app_metadata) || !isDeepStrictEqual(body.app_metadata.dentaia, ASIGNACION)) fallo('NO_DISPONIBLE');
        escrituras++;
      }
      return solicitar(input, { ...init, cache: 'no-store', redirect: 'error',
        signal: AbortSignal.any([AbortSignal.timeout(15000), ...(init?.signal ? [init.signal] : [])]) });
    } },
  });
  return Object.freeze({
    getUserById: id => { if (id !== objetivo) fallo('CUENTA_NO_VERIFICADA'); return cliente.auth.admin.getUserById(id); },
    updateUserById: (id, datos) => { if (id !== objetivo) fallo('CUENTA_NO_VERIFICADA'); return cliente.auth.admin.updateUserById(id, datos); },
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--resumen', '--aplicar'].includes(args[0]))) fallo('USO');
  const raiz = fileURLToPath(new URL('../', import.meta.url));
  let rama;
  try { rama = execFileSync('git', ['branch', '--show-current'], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { fallo('RAMA'); }
  if (rama !== 'feature/superusuario-admin') fallo('RAMA');
  let errorCarga = false;
  nextEnv.loadEnvConfig(raiz, true, { info() {}, error() { errorCarga = true; } });
  if (errorCarga) fallo('CONFIGURACION');
  const objetivo = process.env.DENTAIA_BOOTSTRAP_USER_ID;
  if (typeof objetivo !== 'string' || !objetivo) fallo('CONFIGURACION');
  const operacion = await prepararAsignacion(crearAdminAsignacion(process.env, fetch, objetivo), objetivo);
  console.log(JSON.stringify({ modo: args[0] === '--aplicar' ? 'CONFIRMACION_PENDIENTE' : 'SOLO_LECTURA', ...operacion.resumen }, null, 2));
  if (args[0] !== '--aplicar') return;
  const resultado = await operacion.aplicar(async () => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) fallo('CONFIRMACION_REQUERIDA');
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    try {
      console.log('Verifica en tu panel que el UUID configurado privadamente corresponde a tu cuenta de pruebas autorizada. Ejecutar sin otros operadores modificando sus metadatos.');
      return await terminal.question(`Para autorizar esta concesión escribe exactamente: ${FRASE_CONFIRMACION}\n> `);
    } finally { terminal.close(); }
  });
  console.log(JSON.stringify(resultado, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(e => {
    const codigo = e instanceof ErrorAsignacion ? e.codigo : 'NO_DISPONIBLE';
    console.error(JSON.stringify({ resultado: 'DETENIDA', codigo, mensaje: mensajes[codigo] ?? mensajes.NO_DISPONIBLE }));
    process.exitCode = 1;
  });
}
