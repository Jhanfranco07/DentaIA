// Ejecutar manualmente como Snippet de DevTools en la pestaña LOCAL de DentaIA.
// No importar en la app ni servir como archivo público. Solo GET; nunca imprime la sesión.
(async () => {
  const noVerificada = motivo => ({ resultado: 'NO_VERIFICADA', motivo });
  try {
    if (!['localhost', '127.0.0.1'].includes(location.hostname) || !['http:', 'https:'].includes(location.protocol)) {
      return noVerificada('Usar exclusivamente el origen local de DentaIA.');
    }
    const escenario = prompt('Escenario: perfil_presente, perfil_ausente, cuenta_suspendida, asignacion_invalida, denegado403 o denegado401');
    if (!['perfil_presente', 'perfil_ausente', 'cuenta_suspendida', 'asignacion_invalida', 'denegado403', 'denegado401'].includes(escenario)) {
      return noVerificada('Escenario cancelado o no admitido.');
    }
    const consultar = (ruta, token) => fetch(ruta, { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
      referrerPolicy: 'no-referrer', headers: token ? { Authorization: 'Bearer ' + token } : {}, signal: AbortSignal.timeout(30000) });
    const ruta = '/api/administracion/usuarios/reales';
    const anonima = await consultar(ruta, null);
    const rechazoAnonimo = anonima.status === 401;
    const claves = Object.keys(localStorage).filter(k => /^sb-.+-auth-token$/.test(k));
    if (claves.length !== 1) return { ...noVerificada('Se requiere una única sesión local del proyecto; no pegar tokens.'), rechazoAnonimo };
    const sesion = JSON.parse(localStorage.getItem(claves[0]));
    if (typeof sesion?.access_token !== 'string' || !sesion.access_token) return { ...noVerificada('Iniciar sesión en Mi cuenta.'), rechazoAnonimo };
    const negativo = escenario.startsWith('denegado');
    const id = negativo ? null : prompt('UUID de una cuenta CONTROLADA ya existente; no introducir correos, claves ni tokens.');
    if (!negativo && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id ?? '')) {
      return noVerificada('UUID cancelado o inválido.');
    }
    const acceso = await consultar('/api/administracion/acceso', sesion.access_token);
    const respuesta = await consultar(ruta + (id ? '?q=' + encodeURIComponent(id) : ''), sesion.access_token);
    const privada = /private/.test(respuesta.headers.get('cache-control') ?? '')
      && /no-store/.test(respuesta.headers.get('cache-control') ?? '')
      && respuesta.headers.get('cdn-cache-control') === 'no-store'
      && /Authorization/i.test(respuesta.headers.get('vary') ?? '');
    const resumen = { escenario, rechazoAnonimo, accesoHTTP: acceso.status, lecturaHTTP: respuesta.status, respuestaPrivada: privada };
    if (negativo) {
      const esperado = escenario === 'denegado403' ? 403 : 401;
      const cuerpo = await respuesta.json();
      const sinDatos = cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo)
        && Object.keys(cuerpo).every(k => k === 'error') && typeof cuerpo.error === 'string';
      return { ...resumen, resultado: rechazoAnonimo && privada && sinDatos && acceso.status === esperado && respuesta.status === esperado
        ? 'COINCIDE_CON_ESPERADO' : 'FALLO_O_BLOQUEO' };
    }
    if (acceso.status !== 200 || respuesta.status !== 200) return { ...resumen, ...noVerificada('Resolver sesión/AAL2/configuración sin relajar controles.') };
    const body = await respuesta.json();
    const clavesExactas = (v, esperadas) => v && typeof v === 'object' && !Array.isArray(v)
      && Object.keys(v).length === esperadas.length && Object.keys(v).every(k => esperadas.includes(k));
    const u = body?.usuarios?.[0];
    const contrato = clavesExactas(body, ['origen','consistencia','total','pagina','paginas','tamano','usuarios'])
      && body.origen === 'supabase' && body.consistencia === 'lectura_no_transaccional'
      && body.total === 1 && body.pagina === 1 && body.paginas === 1 && [5,10,20].includes(body.tamano)
      && Array.isArray(body.usuarios) && body.usuarios.length === 1 && clavesExactas(u,['id','perfil','cuenta','asignacion'])
      && u.id === id.toLowerCase() && clavesExactas(u.perfil,['estado','nombre'])
      && ['habilitada','suspendida','sin_confirmar','anonima','eliminada','inconsistente'].includes(u.cuenta)
      && ((u.perfil.estado === 'ausente' && u.perfil.nombre === null)
        || (u.perfil.estado === 'presente' && typeof u.perfil.nombre === 'string' && u.perfil.nombre.length <= 120))
      && clavesExactas(u.asignacion,['estado','roles']) && ['activa','suspendida','ausente','invalida'].includes(u.asignacion.estado)
      && Array.isArray(u.asignacion.roles) && u.asignacion.roles.every(r => ['paciente','odontologo','superusuario'].includes(r))
      && new Set(u.asignacion.roles).size === u.asignacion.roles.length
      && (['ausente','invalida'].includes(u.asignacion.estado) ? u.asignacion.roles.length === 0 : u.asignacion.roles.length > 0);
    const coincide = contrato && (escenario === 'perfil_presente' ? u.perfil.estado === 'presente'
      : escenario === 'perfil_ausente' ? u.perfil.estado === 'ausente'
      : escenario === 'cuenta_suspendida' ? u.cuenta === 'suspendida' : u.asignacion.estado === 'invalida');
    // Reportar únicamente aserciones. No devolver cuerpo, UUID, nombre, claves ni token.
    return { ...resumen, contratoMinimo: Boolean(contrato), estadoEsperado: Boolean(coincide),
      resultado: rechazoAnonimo && privada && coincide ? 'COINCIDE_CON_ESPERADO' : 'FALLO_O_BLOQUEO' };
  } catch { return noVerificada('Fallo de transporte, sesión o formato; no copiar detalles de sesión.'); }
})();
