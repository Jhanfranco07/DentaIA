import { pathToFileURL, fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

const presente = value => typeof value === 'string' && value.trim().length > 0;
function posibleSecreto(value) {
  if (typeof value !== 'string') return false;
  if (value.trim().startsWith('sb_secret_')) return true;
  // Solo detección preventiva de exposición; no verifica un JWT ni autoriza una sesión.
  try { return JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8')).role === 'service_role'; }
  catch { return false; }
}

/** Diagnóstico sin red, sin devolver valores de configuración, tokens ni claves. */
export function evaluarConfiguracionLectura(env) {
  let urlValida = false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    urlValida = env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://') && url.protocol === 'https:'
      && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
  } catch { /* Solo se publica el booleano. */ }
  const publicaSospechosa = Object.entries(env).some(([name, value]) => name.startsWith('NEXT_PUBLIC_')
    && presente(value) && (/SECRET|SERVICE_ROLE/i.test(name) || posibleSecreto(value)));
  const requisitos = {
    urlHttpsValida: urlValida,
    clavePublicablePresente: presente(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    lecturaActivadaExplicitamente: env.DENTAIA_ADMIN_READS_ENABLED === 'true',
    credencialServidorPresente: presente(env.DENTAIA_SUPABASE_ADMIN_READ_SECRET),
    sinSecretosDetectadosEnVariablesPublicas: !publicaSospechosa,
  };
  return { estado: Object.values(requisitos).every(Boolean) ? 'PREPARADO_PARA_INTENTAR_LECTURA' : 'BLOQUEADO_POR_CONFIGURACION',
    requisitos, backendValidado: false, aal2Validado: false };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const modo = process.argv[2] ?? 'development';
  if (process.argv.length > 3 || !['development', 'production'].includes(modo)) {
    console.error('Uso: node scripts/check-admin-read-config.mjs [development|production]');
    process.exitCode = 2;
  } else {
    // Usa el cargador de Next instalado; .env.admin.local no forma parte de esta convención.
    process.env.NODE_ENV = modo;
    let errorCarga = false;
    const raiz = fileURLToPath(new URL('../', import.meta.url));
    const cargado = nextEnv.loadEnvConfig(raiz, modo === 'development', {
      info() {}, error() { errorCarga = true; },
    });
    const resultado = evaluarConfiguracionLectura(process.env);
    if (errorCarga) resultado.estado = 'BLOQUEADO_POR_CARGA_DE_ENTORNO';
    console.log(JSON.stringify({ modo, ...resultado, archivosCargados: cargado.loadedEnvFiles.map(f => f.path) }, null, 2));
    process.exitCode = resultado.estado === 'PREPARADO_PARA_INTENTAR_LECTURA' ? 0 : 2;
  }
}
