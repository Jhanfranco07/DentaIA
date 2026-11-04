# DI-151 — Preparación y protocolo de validación real de lectura

**Estado: preparado para validación condicionada; aceptación real NO EJECUTADA.** Rama `feature/superusuario-admin`, base `e6f6835` más cambios locales sin commit. Este documento complementa el [contrato](DI-151-contrato-usuarios-reales.md); no declara DI-151 terminado.

**Seguimiento dentro de la Parte 2:** la [sección 8 del documento principal](DI-151-administracion-parte2.md#8-credencial-real-aceptada-y-preparación-legítima-de-mfa) registra las cinco comprobaciones de configuración correctas y la credencial privada aceptada por Auth Admin real. No hace falta volver a configurar las variables de lectura. Las referencias a configuración ausente en este protocolo son históricas. Sigue pendiente una sesión de superusuario AAL2 autorizada y la aceptación positiva del endpoint; ni SQL del conector ni acceso con la credencial privada la sustituyen. Este protocolo es un anexo de la Parte 2, no una parte nueva.

Actualización posterior, dentro de la misma Parte 2: el [recorrido TOTP de la sección 10](DI-151-administracion-parte2.md#10-enrolamiento-totp-personal-y-endurecimiento-de-sesión) está habilitado localmente mediante `DENTAIA_QA_MFA_ENABLED=true`, a petición del responsable para completarlo personalmente. La asignación de superusuario de la cuenta indicada se confirmó mediante lectura real, sin modificarla. La vista permite enrolamiento/desafío, reintentos y retomar pendientes propios; no se ejecutaron esas acciones remotas por el agente. Completar MFA no concede roles. Solo `aal2` con HTTP 200 del guard acredita el acceso administrativo esperado.

## 1. Diagnóstico y alcance

Se revisaron `usuarios-reales.ts`, `lecturas-supabase.ts`, `api-usuarios-reales.ts`, su composición, DI-150, el cliente de navegador y los tests. La lectura usa Auth Admin y `profiles` exclusivamente en servidor, después del guard. No hay mutaciones administrativas habilitadas.

Comprobación inicial efectiva del entorno local: el preflight de desarrollo no encontró URL pública, clave publicable, activación ni credencial dedicada; tampoco archivos de entorno cargados por Next. No se mostraron valores ni se configuró nada. Una configuración presente en otro equipo o despliegue no queda acreditada por esta comprobación.

Bloqueos para ejecutar aceptación positiva:

1. Variables del proyecto de pruebas y credencial de servidor, provistas por el propietario fuera del chat.
2. Superusuario de prueba **ya existente**, habilitado, con `app_metadata.dentaia` válido y sesión AAL2 del mismo proyecto/origen local; factor ya verificado. No crear ni promover cuentas para resolver esta dependencia.
3. `/cuenta` reutiliza login, pero no implementa enrolamiento/challenge MFA en este repositorio. Login y «Mi perfil» no prueban AAL2. Usar un flujo autorizado ya disponible que deje la sesión AAL2 en ese origen. Si no existe tal flujo/sesión, el escenario queda **NO VERIFICADO**, sin bajar el requisito AAL2 ni importar tokens por el chat.
4. Inventario previo autorizado de cuentas controladas: perfil presente, perfil ausente, suspensión de Auth y asignación inválida. Si no existen esos estados, no provocarlos: registrar el escenario pendiente.

El proveedor recorre **todas** las cuentas de Auth antes de filtrar, aunque se solicite un UUID. Ejecutar únicamente en entorno autorizado de pruebas con cuentas controladas; `q` no es una frontera de aislamiento. No apuntar estas pruebas a pacientes reales. No se crea un entorno remoto mediante este protocolo.

## 2. Variables y exposición

| Variable | Uso | Exposición admitida |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Mismo proyecto para identidad, navegador y proveedor. HTTPS sin credenciales/query/path adicional. | Pública. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Login/sesión existente y validación de identidad del guard. | Pública; nunca colocar una clave secreta o service_role aquí. |
| `DENTAIA_ADMIN_READS_ENABLED` | Activación literal `true` para intentar la lectura. | Solo servidor. Por defecto no activa. |
| `DENTAIA_SUPABASE_ADMIN_READ_SECRET` | Auth Admin y lectura mínima de perfiles. | Secreto exclusivo de servidor, sin prefijo NEXT_PUBLIC. |

El nombre `READ_SECRET` no reduce los privilegios de la credencial en Supabase. No reutilizarla en componentes, navegador, captura de pantalla, HAR, URL, comando con valor literal o archivo versionado. La cuenta superusuario de aplicación y esta credencial son identidades/privilegios diferentes.

`server-only` impide importar el adaptador desde cliente. `next.config.ts` no inyecta estas variables privadas mediante `env`. El SDK expuesto por el puerto solo ofrece lecturas GET a dos rutas fijas, sin redirecciones ni caché. El build se inspecciona para detectar el identificador privado en bundles públicos; no imprimir nunca el valor para buscarlo.

Next carga los archivos estándar según el modo, **no `.env.admin.local` automáticamente**. No se modifica ninguno en esta entrega. El preflight usa `@next/env`, ya incluido con Next, y solo publica booleanos y nombres de archivos cargados:

```powershell
node scripts/check-admin-read-config.mjs development
node scripts/check-admin-read-config.mjs production
```

`BLOQUEADO_POR_CONFIGURACION` termina con código no cero; no significa un fallo de autorización. `PREPARADO_PARA_INTENTAR_LECTURA` solo comprueba presencia/formato y señales de exposición: **no valida la credencial, permisos, red, usuarios ni AAL2**. La detección de claves sensibles en variables públicas es preventiva, no una auditoría completa de secretos.

## 3. Configuración local reproducible, a cargo del propietario

Estos pasos se documentan para ejecución posterior autorizada. **No se ejecutaron ni se introdujo ningún valor en esta revisión.** Trabajar desde la raíz de DentaIA y verificar `git branch --show-current` y `git status --short`; no cambiar de rama ni limpiar modificaciones.

En una terminal local privada, preferentemente con variables ya provistas por un gestor de secretos. Si deben introducirse manualmente, usar entrada oculta para la credencial, nunca un literal en el comando:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = Read-Host 'URL HTTPS PUBLICA del proyecto de pruebas'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = Read-Host 'Clave PUBLICABLE del mismo proyecto (no secreta)'
$adminReadInput = Read-Host 'Credencial de servidor SOLO en esta terminal privada' -AsSecureString
$adminReadPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminReadInput)
try {
  $env:DENTAIA_SUPABASE_ADMIN_READ_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminReadPtr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminReadPtr)
  $adminReadInput.Dispose()
  Remove-Variable adminReadInput, adminReadPtr
}
$env:DENTAIA_ADMIN_READS_ENABLED = 'true'
node scripts/check-admin-read-config.mjs development
if ($LASTEXITCODE -ne 0) { throw 'Configuracion no preparada; detener la validacion.' }
npm run dev -- --hostname 127.0.0.1 --port 3000
```

No abrir una segunda terminal esperando que herede estas variables. No imprimir `process.env`, `Get-ChildItem Env:` ni el archivo de entorno. Detener cualquier servidor previo para que no se use un build/configuración diferente. Mantener un único origen, por ejemplo `http://127.0.0.1:3000`; localhost y 127.0.0.1 tienen almacenamientos de sesión distintos.

Al terminar, parar el servidor con Ctrl+C y retirar las variables privadas de esa terminal:

```powershell
Remove-Item Env:\DENTAIA_SUPABASE_ADMIN_READ_SECRET -ErrorAction SilentlyContinue
Remove-Item Env:\DENTAIA_ADMIN_READS_ENABLED -ErrorAction SilentlyContinue
```

## 4. Validación manual con la sesión existente

1. El propietario contrasta el inventario de cuentas ficticias y sus estados mediante un acceso autorizado ya existente, sin editar datos. Registrar alias de evidencia A/B/C/D, no secretos ni identificadores personales en documentos públicos. Un perfil ausente no se crea durante estas lecturas.
2. Abrir `/cuenta` en el origen local elegido. Introducir la contraseña solo en navegador. Usar el flujo MFA autorizado existente si corresponde; no enrolar/retirar factores, modificar roles o desactivar MFA como parte de este protocolo.
3. Abrir DevTools → Sources → Snippets. Crear un snippet local copiando **exactamente** el contenido de `scripts/validar-lectura-admin.browser.js` desde el repositorio. Revisarlo antes de ejecutarlo. No cargar código de CDN ni añadirlo a `public/` o a la app.
4. Ejecutarlo. Elegir uno de los escenarios admitidos y, para consultas positivas, introducir en el diálogo el UUID de la cuenta controlada que ya tiene ese estado. No pegar contraseñas, claves ni JWT en diálogos o chat.
5. El snippet toma el token de la sesión local predeterminada del SDK sin imprimirlo. Primero comprueba una petición anónima; luego consulta `/api/administracion/acceso` y el endpoint real. **La autoridad es el guard del servidor**, no el almacenamiento ni claims decodificados en navegador.
6. Revisar únicamente el resumen: HTTP, cabeceras privadas, coincidencia del contrato y estado esperado. El código no devuelve nombre, UUID, cuerpos completos ni token. No expandir variables locales de sesión, copiar cabeceras Authorization ni exportar HAR sin saneamiento.
7. Repetir los cuatro casos positivos existentes. Se requiere `accesoHTTP: 200`, `lecturaHTTP: 200`, rechazo anónimo, respuesta privada y contrato mínimo correctos. Un resultado favorable aislado solo cubre ese escenario y esa versión.
8. Cerrar sesión mediante Mi cuenta. Iniciar sesión con una cuenta controlada paciente y luego odontólogo; ejecutar `denegado403` con cada una. Se comprueban guard y lectura por separado. Una cuenta autenticada sin asignación también debe recibir 403, pero eso no acredita por sí solo que se probó el rol odontólogo.
9. Con un superusuario que tenga una sesión AAL1 **ya disponible**, `denegado403` también debe coincidir. No alterar MFA para obtenerlo. Una sesión que Auth rechace devuelve 401; si no existe tal sesión controlada, no declarar probado ese caso.
10. Tras logout, probar la lectura anónima desde DevTools con el GET de la sección siguiente. No usar `denegado401` con una sesión válida para simular caducidad. El escenario de sesión caducada necesita una expiración real comprobada, sin imprimir ni manipular el JWT.

El snippet es una herramienta manual local, no un arnés productivo ni un flujo MFA. Asume el formato de almacenamiento predeterminado del SDK instalado. Si hay varias sesiones/proyectos o cambia el formato, aborta; no elegir un token arbitrariamente. Con cookies o una sesión externa no disponible en este origen queda NO VERIFICADO. No es un sustituto de `getSession()` en componentes de la aplicación.

GET anónimo seguro, también después del logout:

```javascript
await (async () => {
  const r = await fetch('/api/administracion/usuarios/reales', {
    method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error'
  });
  return { http: r.status, rechazoEsperado: r.status === 401,
    privada: /private/.test(r.headers.get('cache-control') || ''),
    sinCache: /no-store/.test(r.headers.get('cache-control') || '') };
})();
```

## 5. Respuestas esperadas y significado

Para un operador autorizado, el objetivo de la consulta puede tener cualquiera de estos estados. Que una cuenta suspendida aparezca en el listado **no permite a esa cuenta ser operadora**.

| Escenario existente | Respuesta esperada | Qué comprobar |
| --- | --- | --- |
| Cuenta con perfil | 200; `perfil.estado: presente`; nombre de `profiles.full_name`. | Coincide con el registro controlado, sin campos adicionales. |
| Cuenta sin perfil | 200; `perfil.estado: ausente`, `nombre: null`. | No crea fila ni inventa nombre desde email/user_metadata. |
| Suspendida en Auth | 200 para el administrador lector; `cuenta: suspendida` si `banned_until` es futuro. | Independiente de `asignacion.estado`. No suspender una cuenta para preparar el caso. |
| Asignación de negocio suspendida | `asignacion.estado: suspendida`; puede conservar `cuenta: habilitada`. | No confundir suspensión del namespace con bloqueo de Auth. Como operadora, DI-150 la rechaza. |
| Asignación inválida | `asignacion.estado: invalida`, `roles: []`. | Ejemplos existentes: versión desconocida, rol no admitido, duplicado o estructura incorrecta. No generarlos en remoto. |
| Namespace ausente | `asignacion.estado: ausente`, `roles: []`. | No asigna paciente por defecto. |
| Visitante / identidad rechazada | 401, sin datos administrativos. | El rechazo anónimo no contacta al proveedor. |
| Paciente / odontólogo / superusuario AAL1 | 403, sin datos administrativos. | Sesión auténtica pero sin permiso suficiente; prueba cada identidad realmente disponible. |
| Configuración o proveedor no disponible | 503 tras autorización, mensaje controlado. | No cuenta como permiso rechazado ni aceptación positiva. |
| Campos de autoridad, proveedor o paginación inválida | 400 con administrador válido. | Sin sesión el guard debe devolver 401 antes de procesar la consulta. |

El cuerpo 200 solo admite `origen`, `consistencia`, `total`, `pagina`, `paginas`, `tamano`, `usuarios`. Cada usuario solo admite `id`, `perfil`, `cuenta`, `asignacion`; el snippet comprueba también las claves anidadas. No deben aparecer fotografías, consentimientos, solicitudes, resultados, historiales, correos, teléfonos, factores, claves ni objetos Auth completos.

Limitaciones conocidas: máximo 2000 cuentas; Auth y perfiles no comparten snapshot; los filtros se aplican al escaneo global. Duplicados detectados y truncamientos producen error; no se detectan todas las carreras de inserción/eliminación entre páginas. Este resultado no sirve para autorizar escrituras ni contar administradores de forma transaccional. Si una versión de Auth omite `is_anonymous`, se clasifica como `inconsistente`; comprobar la compatibilidad real antes de cambiar esa regla.

## 6. Ajustes seguros de esta revisión

- `usuarios-reales.ts`: valores falsy malformados (`false`, `0`, `NaN`) en fechas ya no se interpretan como ausencia de suspensión/eliminación o confirmación; devuelven `inconsistente`. No cambia datos ni privilegios.
- `lecturas-supabase.ts`: valida la paginación del puerto Auth y exige un UUID completo para perfiles antes de usar el SDK; una secuencia de 36 guiones ya no pasa la validación.
- `scripts/check-admin-read-config.mjs`: diagnóstico sin red ni valores secretos; utiliza el cargador instalado de Next. Detecta señales de secretos bajo variables públicas y diferencia preparación de aceptación.
- `scripts/validar-lectura-admin.browser.js`: snippet manual GET, local, de resumen mínimo. No es importado por la app ni requiere dependencias nuevas.
- Tests de regresión y herramientas: `usuarios-reales.test.mjs`, `lecturas-supabase.test.mjs`, `configuracion-lectura.test.mjs`, `validacion-browser.test.mjs`. Los tests del snippet se ejecutan en VM con HTTP/sesiones ficticios.

## 7. Registro de ejecución

Ejecución local de esta revisión: **02/11/2026**, Node `v22.18.0`, Next `15.5.28`, Supabase JS `2.118.0`. Las ejecuciones anteriores de 169 tests siguen documentadas en el contrato; no se sustituyen por afirmaciones de backend real.

| Comprobación | Resultado efectivamente ejecutado | Alcance |
| --- | --- | --- |
| Preflight development y production | `BLOQUEADO_POR_CONFIGURACION`: las cuatro variables requeridas no están configuradas; cero archivos de entorno cargados. Sin señales de secretos en variables públicas presentes. | Diagnóstico sin red; no comprueba otros equipos o despliegues. |
| Suite Node completa | **177/177 tests aislados pasan**, 0 fallos y 0 omitidos: 169 previos y 8 añadidos. | Fixtures/VM/SDK con fetch interceptado. No acredita cuentas, MFA ni RLS reales. |
| TypeScript / sintaxis | `npm run typecheck` y `node --check` de las dos herramientas: correctos. | Comprobación estática. |
| Build | `npm run build`: correcto. | Compilación local; configuración privada no encontrada en `.next/static`. |
| HTTP local sin sesión / privilegios en cabeceras / Authorization malformada / query no admitida | 401 sin datos; cabeceras privadas y sin caché. | Servidor Next real local, sin Supabase remoto. |
| Bearer sintético con configuración de identidad ausente | 503 controlado, sin datos. | Prueba de indisponibilidad local; **no prueba rechazo remoto de JWT inválido**. |
| Métodos/rutas | POST lectura: 405; POST roles/asignar y vista de desarrollo en producción local: 404. | Sin escrituras. |
| HTML de módulos existentes | Inicio, cuenta, directorio, solicitudes y fotografías: 200. | No equivale a sus flujos autenticados o a recorrer el navegador. |
| Perfil presente/ausente, suspensión y asignación inválida | Contratos comprobados únicamente con fixtures; casos reales **NO VERIFICADOS**. | No se crearon ni modificaron cuentas/estados para ejecutarlos. |
| Administrador AAL2 y paciente/odontólogo reales | **NO VERIFICADOS** en el nuevo endpoint. | Requieren entorno, sesiones y cuentas autorizados ya existentes. |

La comprobación HTTP local realizó 14 aserciones de estado, además de cabeceras/cuerpos mínimos en los rechazos. Logs temporales fuera del repositorio: `%TEMP%/DentaIA-DI151-preparacion-pruebas.tap`, `%TEMP%/DentaIA-DI151-preparacion-build.log` y `%TEMP%/DentaIA-DI151-preparacion-http.json`. No contienen credenciales ni datos de cuentas reales.

Comandos para repetir las comprobaciones técnicas desde la raíz del repositorio:

```powershell
npm run typecheck
npm run build
node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"
node --check scripts/check-admin-read-config.mjs
node --check scripts/validar-lectura-admin.browser.js
git diff --check
```

El build puede regenerar `next-env.d.ts`; revisar esa diferencia por separado y no usar limpiezas o descartes globales sobre el trabajo local.

Se preservan los cambios anteriores; solo se ajustaron los dos módulos de lectura y sus dos tests existentes. No se editaron los diez archivos de DI-151 parte 2, el guard ni los módulos de otros integrantes. El archivo auxiliar `next-env.d.ts` regenerado por el build se devolvió a su contenido inicial. No hay cambios remotos, archivos de entorno nuevos, credenciales introducidas, commit/push/merge ni ejecución de GitHub Actions.

Para cada aceptación real posterior registrar: fecha, versión/estado local, entorno, escenario/alias, HTTP esperado y observado, aserciones, resultado y limitación. No conservar datos personales ni secretos en el informe. Si una cuenta/estado no existe o la sesión AAL2 no está disponible: **NO VERIFICADO**. No modificar datos para convertir ese pendiente en un aprobado.

Referencias oficiales: [Auth Admin listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers), [niveles AAL](https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel), [variables de entorno de Next.js](https://nextjs.org/docs/app/guides/environment-variables). El changelog consultado mantiene el aviso de TLS de octubre de 2026; no se cambian versiones ni se debilita TLS.
