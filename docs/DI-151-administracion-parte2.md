# DI-151 — Integración administrativa, parte 2

- Historia: DI-144 — Superusuario y panel administrativo.
- Fecha: 02/11/2026. Responsable: Jhan.
- Rama exclusiva: `feature/superusuario-admin`.
- Base: `e6f6835`, primera parte de DI-151. Se conservan sus seis commits anteriores.
- **Estado del registro: preparado para revisión de cierre y publicación de la Parte 2, por confirmación del responsable. Ver sección 14 para las comprobaciones finales repetidas y la distinción entre evidencia ejecutada y validación comunicada. Las secciones anteriores conservan el historial técnico y sus limitaciones; no se cambia automáticamente el estado de Jira.**

DI-151 tiene únicamente dos partes: Parte 1 publicada en `e6f6835` y esta Parte 2, que comprende **todos los cambios locales posteriores**. Los documentos de contrato y protocolo son anexos técnicos de la Parte 2, no partes adicionales.

## 1. Continuidad del trabajo

Se revisaron [DI-151 parte 1](DI-151-administracion-parte1.md), [DI-150 parte 2](DI-150-autenticacion-parte2.md), componentes, proveedor, API y controles de servidor existentes. La copia accesible inicialmente estaba en `3576c13`; el árbol estaba limpio y se recuperaron los cuatro commits posteriores mediante avance rápido de la misma rama hasta `e6f6835`. No se crearon commits de integración ni se incorporaron cambios de otra rama.

La API de demostración mantiene un proveedor sintético y las acciones cerradas `usuarios.consultar_demo` y `roles.validar_propuesta`. La Parte 2 incorpora además la acción `usuarios.consultar_reales` y su endpoint. Conserva las comprobaciones de DI-150: identidad, asignación actual, firma/caducidad y AAL2 con factor verificado. No cambia RLS ni configuración remota, no reinicia el panel ni declara implementada DI-152. La sección 4 conserva evidencia histórica de la etapa inicial de esta Parte 2; las secciones 6 y 7 registran su evolución y estado actualizado.

## 2. Funcionalidad incorporada

### Canales separados

La sección Usuarios de `/desarrollo/panel-admin` permite elegir explícitamente:

1. **Demostración local sin sesión:** utiliza el proveedor en memoria de la parte 1. Conserva filtros, paginación y escenarios locales; no consulta Auth ni la API.
2. **API protegida con sesión existente:** comprueba acceso y consume los endpoints de servidor. No ofrece escenarios sintéticos seleccionables desde la petición. El servidor sigue devolviendo datos sintéticos: **conectar una API no convierte sus cuentas en un listado real de Supabase**.

Cambiar de canal desmonta la vista anterior y elimina su estado. Un error de API nunca activa automáticamente la demo local. El origen del listado y de las asignaciones se muestra por separado. El proveedor real incorporado posteriormente dentro de esta misma Parte 2 se describe en la sección 6; todavía no está conectado al listado visual ni aceptado con una sesión administrativa real.

### Adaptador cliente y sesión

`cliente.ts` define un adaptador comprobable con token y transporte inyectables. La composición de navegador reutiliza `getSupabaseBrowserClient().auth.getSession()` únicamente para obtener el access token de la sesión existente. No inicia otro login, no calcula roles, no decodifica claims ni comprueba AAL2 en React. La autoridad sigue siendo el servidor en cada petición.

El token se obtiene de nuevo por petición; no se guarda en el estado de React, URL, documentación o logs. El adaptador solo construye rutas relativas fijas del mismo origen, omite cookies, exige respuestas JSON, evita caché, rechaza redirecciones y limita a diez segundos el transporte HTTP. No hace reintentos automáticos de POST. Si no hay token, muestra la necesidad de iniciar sesión y no solicita datos.

| Endpoint existente | Integración |
| --- | --- |
| `GET /api/administracion/acceso` | Comprobación inicial antes de montar el listado conectado. No sustituye el guard de las operaciones siguientes. |
| `GET /api/administracion/usuarios` | Consulta con búsqueda, filtros y paginación validados; proyección mínima de respuesta. |
| `POST /api/administracion/roles/validar` | Envía exclusivamente operación, UUID objetivo y rol propuesto. No envía operador, roles de autoridad o claims. |

El operador ficticio de la demo se vincula únicamente al proveedor local. El adaptador de API no recibe ni envía esa identidad: el operador de la validación procede del contexto verificado de DI-150.

Se mantiene la separación explicada en la documentación oficial de [getSession](https://supabase.com/docs/reference/javascript/auth-getsession) y [getUser](https://supabase.com/docs/reference/javascript/auth-getuser): recuperar el token para transportarlo no acredita autorización administrativa. Se consultó el changelog; no se cambiaron versiones, cifrados ni configuración del servicio.

### Estados, errores y privacidad

- Carga y vacío reutilizan `EstadoAdministrativo`. La lista anterior se retira al empezar una nueva consulta.
- Una consulta correcta muestra total, origen y página. Una propuesta válida muestra éxito **solo de validación**, sin afirmar que se guardó o asignó un rol.
- Se traducen 400, 401, 403, 404, 413, 429, errores de servicio/red y respuestas inválidas a mensajes controlados. No se representan mensajes crudos de Auth, HTML de intermediarios ni campos adicionales del proveedor.
- Un reintento de consulta usa el mismo canal y vuelve a obtener el token. El control compartido admite un texto de reintento adecuado al canal.
- Un cambio de sesión desmonta el listado y vuelve a comprobar acceso. Se limpian cuentas y propuesta ante 401 o una denegación general 403. Las respuestas de una vista o sesión anterior se descartan.
- Una denegación de negocio, como una propuesta propia o una promoción que requiere aprobación, se muestra sin fingir un cambio aplicado y sin confundirla con la pérdida general de acceso.
- El adaptador valida estructura, origen, identificadores, roles y coherencia de la paginación. Descarta campos extra. Una respuesta con `aplicado: true`, otro objetivo o un resultado incoherente **no produce éxito**.

No existe un endpoint nuevo de escritura ni método de asignación. El panel sigue limitado a desarrollo; no se crea `/admin` y la URL de desarrollo sigue respondiendo 404 en producción. Administrar no concede acceso clínico.

## 3. Archivos de esta parte

Nuevos:

- `src/features/administracion/cliente.ts`: transporte y validación de respuestas, sin cliente privilegiado.
- `src/features/administracion/cliente.test.mjs`: diez pruebas del adaptador y su integración con la API/guard/proveedor mediante fixtures. Compila el adaptador real con TypeScript ya instalado para resolver sus imports en Node; no añade loaders ni cambia `tsconfig`.
- `src/features/administracion/UsuariosAdministrativos.tsx`: selección explícita de canal.
- `src/features/administracion/UsuariosAdministrativosConectados.tsx`: composición con sesión existente y comprobación de acceso; limpieza y revalidación por eventos Auth.
- `docs/DI-151-administracion-parte2.md`: este documento.

Modificados:

- `PanelAdministrativoDemo.tsx`: incorpora la selección de canal y explica el alcance.
- `UsuariosAdministrativosDemo.tsx`: reutiliza listado, filtros y paginación con un cliente inyectable, reintento real y origen explícito.
- `PropuestaRolDemo.tsx`: separa el operador local del contexto del servidor; presenta errores de autorización y éxito sin escritura.
- `EstadoAdministrativo.tsx`: admite etiqueta de reintento sin alterar su comportamiento por defecto.
- `administracion.module.css`: estilo encapsulado del selector de canal.

Los cinco archivos anteriores pertenecen a `src/features/administracion/`. No se modifican cuenta, directorio, solicitudes, fotografías, dependencias, workflows, endpoints o controles de autorización del equipo.

## 4. Verificación ejecutada y límites de evidencia

| Comprobación | Resultado y naturaleza de la prueba |
| --- | --- |
| TypeScript | `npm run typecheck`: aprobado. |
| Build | `npm run build`: aprobado con Next.js 15.5.28. |
| Suite completa | **146 aprobadas, 0 fallidas, 0 omitidas**: 136 existentes y 10 nuevas, con el ejecutor de Node. |
| Cliente → API → guard AAL2 → proveedor | Pruebas sin red con identidades y claims fixture: listado, filtros, paginación, propuesta sin persistencia, rechazo de paciente/odontólogo/AAL1/cuenta suspendida/token inválido antes del servicio. |
| Transporte y contrato | Token renovado por petición, rutas fijas, ausencia de cookies/caché, campos de autoridad rechazados, respuestas mínimas, errores seguros, JSON/origen/paginación inválidos y `aplicado: true` rechazados. |
| Navegador aislado, desarrollo | 12 escenarios aprobados, 19 peticiones a API interceptadas: separación de canales, vacío, 503/reintento, paginación, validación, aprobación denegada, 401/403, cierre de sesión simulado y retorno explícito local; sin errores React. |
| Naturaleza del navegador | Sesión ficticia y respuestas HTTP simuladas exclusivamente dentro del contexto de QA. El evento de cierre de sesión se simuló con el canal del SDK. **No valida MFA, revocación o usuarios reales.** Cero peticiones a Supabase. |
| Presentación | Capturas de escritorio y vista móvil de 390 px inspeccionadas; sin desbordamiento horizontal en el escenario móvil comprobado. No se repite una auditoría completa de accesibilidad. |
| HTTP contra servidor Next de producción local, sin fixtures | Acceso y listado sin bearer: 401; cabecera de rol sin bearer: 401; POST de propuesta sin sesión: 401, con `no-store` y sin datos administrativos. No requiere contactar a Auth real. |
| Métodos y rutas | POST usuarios/PATCH validar: 405. `/api/administracion/roles/asignar`, `/admin` y `/desarrollo/panel-admin` con/sin `?demo=1`: 404. |
| Compatibilidad HTML | `/`, `/cuenta`, `/directorio`, `/solicitudes`, `/fotografias`: 200 en producción local. No equivale a ejecutar operaciones privadas del equipo. |
| Diff y alcance | `git diff --check` y revisión de archivos nuevos, credenciales y alcance. No se crean commits ni se publica este trabajo. |

Para reproducir las comprobaciones principales:

```powershell
npm run typecheck
npm run build
node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"
git diff --check
```

Las herramientas de navegador y capturas se utilizaron temporalmente fuera del repositorio. No se añadieron dependencias de QA. La instalación local solo recuperó `server-only`, ya fijado en los commits anteriores; `package.json` y el lockfile permanecen sin cambios.

En esa etapa inicial no se hicieron consultas de cuentas, sesiones autorizadas, enrolamiento MFA, cambios de roles o modificaciones remotas de Supabase. Los resultados positivos de API y los rechazos con AAL/roles concretos utilizaron fixtures. La sección 7 diferencia las comprobaciones reales posteriores de esta misma Parte 2.

## 5. Pendientes obligatorios y criterio de cierre

- [x] Conectar la interfaz a los endpoints existentes y mantener separado el canal local.
- [x] Añadir estados y recuperación de errores sin exponer datos o habilitar cambios reales.
- [x] Reutilizar, sin debilitar, los controles de DI-150.
- [x] Probar integración del adaptador y recorrido de componentes con fixtures; verificar build, suite y restricción pública.
- [ ] Ejecutar aceptación con cuentas de prueba autorizadas: administrador AAL2 real, paciente/odontólogo denegados, caducidad, cierre y retirada/suspensión de rol según DI-150.
- [x] Implementar un proveedor real exclusivo del servidor con contrato mínimo y sin escrituras. Su implementación no acredita aceptación positiva real.
- [ ] Completar la configuración privada y ejecutar el proveedor mediante el endpoint con un administrador real AAL2.
- [ ] Implementar y validar actualización controlada de roles con autorización por operación, preservación de metadatos, auditoría, idempotencia y concurrencia. Es un requisito original de DI-151, no se traslada a DI-152.

El acceso a la vista sigue siendo `npm run dev` → `/desarrollo/panel-admin` → Usuarios → Canal de consulta. Sin una sesión administrativa AAL2 válida, la API no mostrará cuentas. Esta entrega no enrola factores, asigna roles ni aprovisiona administradores como atajo de pruebas.

Las escrituras de roles continúan bloqueadas. Aprobación independiente, protección del último administrador, concurrencia y auditoría transaccional deben estar definidas y validadas antes de habilitarlas. DI-152 integrará servicios e interfaz; no sustituye las operaciones pendientes de DI-151.

**Conclusión:** queda implementada la integración de interfaz y transporte protegido de DI-151. No se declara completa la subtarea mientras falten las validaciones reales y el acuerdo sobre el proveedor administrativo. Los seis commits recuperados se conservan; esta parte queda sin staging, commit, push, PR o integración a `main`.

Mensaje propuesto, únicamente para revisión posterior:

```text
DI-151 feat(admin): integrar interfaz con API protegida y estados de autorización
```

## 6. Alcance completo de los cambios locales de la Parte 2

Además de los componentes y cliente descritos arriba:

- `usuarios-reales.ts`: contrato de identidades Auth/perfiles/asignaciones, búsqueda, filtros y paginación global acotada a 2000 cuentas; lectura no transaccional, sin escrituras ni valores predeterminados que concedan roles.
- `lecturas-supabase.ts`: SDK administrativo `server-only`, puerto limitado a dos GET, proyección mínima, timeouts, rechazo de redirecciones, UUID y paginación validados.
- `api-usuarios-reales.ts`, `servidor-usuarios-reales.ts` y `src/app/api/administracion/usuarios/reales/route.ts`: `GET /api/administracion/usuarios/reales` protegido por DI-150 y la acción específica de lectura; no hay endpoint de asignación.
- `autorizacion.ts`: solo se añade la acción explícita de lectura real a la lista permitida; se conservan identidad, roles vigentes, claims y AAL2.
- `scripts/check-admin-read-config.mjs`: diagnóstico de configuración sin red ni valores secretos; `scripts/validar-lectura-admin.browser.js`: snippet manual local con sesión existente y resumen mínimo.
- Tests de cliente, API, proveedor, adaptador real con transporte interceptado, configuración y snippet. Suite actual: 177 pruebas aisladas, no pruebas positivas reales de administración.
- [Contrato de usuarios y consistencia](DI-151-contrato-usuarios-reales.md) y [protocolo reproducible de aceptación](DI-151-validacion-lectura-real.md): anexos de esta Parte 2, no partes nuevas.

Decisión de seguridad mantenida: el cambio de Auth y una escritura separada de auditoría PostgreSQL no forman una transacción. La propuesta de asignaciones/auditoría canónicas en PostgreSQL y sincronización durable hacia Auth sigue requiriendo aprobación, esquema, adaptación del guard y pruebas. No se ejecutó SQL de escritura, no se crearon tablas y no se habilitó una operación que pretenda ofrecer atomicidad mediante llamadas independientes.

## 7. Comprobaciones reales en Dental-IA y resultado actualizado

Registro de la primera comprobación remota. La sección 8 actualiza los bloqueos de configuración y el flujo MFA; no se interpreta este registro histórico como estado vigente de las variables.

Proyecto autorizado: `Dental-IA`, ID `vwmdknzjyvmsdqpepykz`, URL `https://vwmdknzjyvmsdqpepykz.supabase.co`. Verificación del 02/11/2026 sobre la rama y cambios locales existentes, sin nuevo commit.

### Configuración local: bloqueo parcialmente resuelto

Al inicio solo existía `.env.example`; Next no encontraba configuración de ejecución. El conector autorizado proporcionó una **clave publicable moderna ya existente y habilitada**; no se creó ni rotó ninguna clave. Se configuraron URL y clave publicable en `.env.local`, ignorado por Git. No se imprime el valor de ninguna clave ni token en esta evidencia.

El preflight confirmó que Next carga `.env.local` en desarrollo y producción:

| Variable | Estado actual | Acción pendiente |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Configurada para Dental-IA. | Ninguna para conexión pública local. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Configurada con la clave pública existente. | Ninguna para conexión pública local. |
| `DENTAIA_ADMIN_READS_ENABLED` | `false`, lectura administrativa desactivada deliberadamente. | Activar solo cuando exista credencial y sesión de prueba autorizada. |
| `DENTAIA_SUPABASE_ADMIN_READ_SECRET` | **Ausente**. | El propietario debe proporcionar una clave secreta existente del mismo proyecto exclusivamente al servidor. |

Dónde obtener la credencial faltante: [Settings → API Keys de Dental-IA](https://supabase.com/dashboard/project/vwmdknzjyvmsdqpepykz/settings/api-keys), sección de claves secretas. Usar una clave secreta existente (`sb_secret_…`) o la credencial heredada equivalente solo si ya está autorizada para este uso. No es la clave publicable, una contraseña de base de datos ni una connection string PostgreSQL. Configurar la variable mediante un gestor de secretos o entrada local oculta, siguiendo el protocolo; nunca pegarla en el chat ni añadir `NEXT_PUBLIC_`. El conector de lectura no suministra esa credencial al proceso Next.

### Resultados reales, sin fixtures

| Comprobación | Resultado observado | Límite de la evidencia |
| --- | --- | --- |
| Consulta del catálogo mediante conector SQL | `auth.users` contiene los campos esperados; `profiles` tiene `id` UUID, `full_name` y `created_at`, no nulos. | Lectura real de metadatos, no prueba del SDK Auth Admin. |
| Relación Auth/perfiles | `profiles_pkey` y FK `profiles_id_fkey`: `profiles.id → auth.users.id`, con ON DELETE CASCADE. | Se inspeccionó la restricción, no se ejecutó un borrado. |
| Dos cuentas controladas conocidas, alias QA-A y QA-B | Ambas confirmadas, no anónimas, con perfil y nombre compatible con el contrato; ninguna suspendida ni eliminada. | Solo esas dos cuentas; no se publican nombres, UUID, correos o datos clínicos. |
| Preparación administrativa de QA-A y QA-B | Ambas sin namespace `dentaia`, sin rol superusuario en ese namespace y con **0 factores MFA verificados**. | No son administradores AAL2 utilizables para esta aceptación. No implica que no exista otro administrador en el proyecto. |
| RLS de perfiles | Habilitado. Políticas de lectura, inserción y actualización por propietario `id = auth.uid()`; UPDATE incluye WITH CHECK. | Inspección real de configuración; no acredita aislamiento mediante dos JWT. |
| Auth público, HTTP GET real `/auth/v1/settings` con clave existente | 200. | Confirma conexión pública y clave aceptada, no autorización administrativa. |
| SDK Auth real con token sintético inválido, sin identidad | 403 `bad_jwt`, sin usuario devuelto. | Rechazo remoto real; no equivale a una sesión real, AAL2 o expiración comprobada. |
| Auth Admin `listUsers` real con clave publicable, sin sesión administrativa | 401 `no_authorization`, 0 identidades devueltas. | Prueba negativa real. No se listaron usuarios por Auth Admin con privilegios válidos. |
| Data API de perfiles, GET anónimo con límite 0 | 401 `42501`, sin filas. HEAD también rechazado con 401. | Permiso insuficiente observado; no se atribuye exclusivamente a RLS ni se interpreta como aislamiento entre usuarios autenticados. |
| Data API pública de directorio, GET con límite 0 | 206, 0 filas solicitadas/devueltas, conteo visible 4. | Comprueba conexión pública sin descargar perfiles; no prueba filtros ni recorrido visual. |

Todas las consultas del conector fueron SELECT sobre catálogos, las dos cuentas controladas y su vínculo a perfiles/factores; no se recuperaron tokens, contraseñas, claves privadas ni contenidos clínicos. No se simuló AAL2 ni se modificaron usuarios, roles, factores o configuración remota. Los permisos elevados del conector SQL **no** son una sesión administrativa de la app ni una validación de RLS por usuario.

### Bloqueos exactos y forma de resolverlos

1. **Credencial administrativa de servidor ausente:** configurar la variable indicada desde el origen autorizado; mantenerla fuera del navegador y de Git. No intentar sustituirla por la connection string o por una sesión SQL.
2. **Administrador de prueba AAL2 no disponible entre las dos cuentas conocidas:** identificar un administrador de pruebas ya habilitado y con factor verificado, y obtener su sesión mediante un flujo autorizado. Si no existe, la provisión de superusuario y el enrolamiento MFA requieren autorización explícita adicional; no se ejecutaron aquí.
3. **Flujo MFA de navegador:** `/cuenta` no implementa challenge/verificación. Una sesión inicial AAL1 o «Mi perfil» no bastan. Usar el flujo autorizado ya existente que deje AAL2 en el mismo origen, o aprobar e implementar ese flujo antes de la aceptación; nunca editar claims o relajar el guard.
4. **Escenarios no disponibles:** las dos cuentas controladas tienen perfil, están habilitadas y carecen de asignación administrativa. Perfil ausente, suspensión y asignación inválida siguen NO VERIFICADOS en el endpoint real; no se provocaron cambios para fabricarlos.
5. **Escrituras obligatorias de DI-151:** siguen sin implementar. Falta acordar la autoridad de roles y aprobar/configurar persistencia y auditoría con concurrencia verificable; después implementar transiciones, idempotencia, preservación de metadatos, protección del último administrador y aceptación real. No se traslada a DI-152.

### Verificación técnica final

`npm run typecheck`: correcto. `npm run build`: correcto con la configuración pública local cargada. Suite Node: **177 aprobadas, 0 fallidas y 0 omitidas**, todas aisladas; no acreditan aceptación administrativa real. Comando: `node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"`.

HTTP contra Next de producción local con la conexión pública real: lectura anónima y cabeceras falsas de privilegios devuelven 401; un token sintético inválido enviado al endpoint de acceso y al de usuarios es rechazado por Auth real y Next devuelve 401, sin datos. Se verificaron cabeceras privadas/no-store y cuerpos mínimos. No equivale a rechazo con una cuenta real de paciente/odontólogo ni a una sesión AAL2 positiva. POST lectura: 405; asignación de roles: 404; vista de desarrollo: 404. Inicio, cuenta, directorio, solicitudes y fotografías entregan HTML 200, sin afirmar sus flujos privados ni aceptación visual. Total: 12 aserciones de estado locales.

No se encontraron los identificadores de configuración privada en `.next/static`. La clave publicable sí puede formar parte del cliente por diseño; no se configuró una clave privada. `git diff --check` correcto. El archivo auxiliar regenerado por el build se devolvió a su contenido previo, sin descartar modificaciones del usuario.

Logs temporales de esta comprobación: `%TEMP%/DentaIA-DI151-parte2-final-pruebas.tap`, `%TEMP%/DentaIA-DI151-parte2-final-build.log` y `%TEMP%/DentaIA-DI151-parte2-final-http.json`. Los resultados SQL y HTTP remotos se describen arriba; no contienen filas personales ni secretos. No hay commit, push, PR, merge ni cambio de estado en Jira. **La Parte 2 y DI-151 siguen abiertas** mientras falten la aceptación positiva AAL2 y la actualización controlada obligatoria.

## 8. Credencial real aceptada y preparación legítima de MFA

Seguimiento del 02/11/2026 (America/Lima), dentro de esta misma Parte 2. No se crea una parte adicional.

### Resultados reales ejecutados

1. El preflight de desarrollo devuelve `PREPARADO_PARA_INTENTAR_LECTURA`, con las cinco comprobaciones correctas. El propietario ya configuró activación y credencial; no se modificó `.env.local` durante esta revisión ni se imprimieron sus valores.
2. En Node servidor, con `--conditions=react-server --experimental-strip-types`, se cargó la configuración mediante `@next/env` y se invocó **el adaptador real** `crearLecturasSupabase().listarCuentas(1, 1)`. Auth Admin aceptó la credencial. Solo se publicó un booleano de aceptación, sin identidades, recuentos de usuarios, respuestas Auth, claves o tokens. Es una prueba de capacidad técnica de la credencial, expresamente separada de la autorización AAL2 del endpoint.
3. Mediante SELECT del conector se consultaron únicamente agregados de las dos identidades controladas conocidas. QA-A y QA-B siguen sin superusuario en `app_metadata.dentaia`, con 0 factores verificados y 0 filas de sesión AAL2 cuyo `not_after` permita continuidad. No se publicaron UUID, correos ni sesiones. Una fila de sesión tampoco demostraría por sí sola disponer de su JWT vigente en navegador. No se concluye que no exista otra cuenta administrativa en el proyecto.
4. Se intentó inspeccionar el navegador existente con Computer Use. El host de acceso a navegadores y el canal nativo no estaban disponibles; no se pudieron leer pestañas ni comprobar su sesión. No se extrajo almacenamiento, tokens o credenciales del navegador por otro mecanismo.

**No se ejecutó el proveedor completo ni el endpoint de usuarios con un administrador real**: todavía no hay una sesión AAL2 autorizada disponible para esta ejecución. La prueba mínima de credencial no sustituye esa aceptación.

### Flujo preparado, sin ejecutarlo sobre cuentas remotas

Archivos nuevos de la Parte 2:

- `src/features/administracion/mfa-local.ts`: controlador comprobable, con `getUser`, `listFactors`, nivel informativo del SDK, enrolamiento TOTP y `challengeAndVerify`; vuelve a comprobar `/api/administracion/acceso` usando la sesión renovada del SDK. No asigna roles ni consulta usuarios administrativos.
- `src/features/administracion/MfaAdminLocal.tsx` y `mfa-local.module.css`: interfaz local, mensajes y estados, consentimiento explícito, QR únicamente en memoria, código oculto y borrado al enviar, limpieza ante cambio de identidad/logout. No guarda QR, secreto TOTP o código en archivos/logs/almacenamiento de aplicación.
- `src/app/desarrollo/mfa-admin/page.tsx`: ruta **solo en desarrollo**, 404 en producción/Preview antes de importar la vista. No se crea ni abre un panel administrativo productivo.
- `src/features/administracion/mfa-local.test.mjs`: 12 pruebas nuevas con SDK/HTTP ficticios, sin conexiones ni factores remotos.

Ruta: `http://localhost:3000/desarrollo/mfa-admin` (usar el mismo origen en el que se inició sesión; 127.0.0.1 y localhost no comparten sesión).

Estado inicial seguro: `DENTAIA_QA_MFA_ENABLED` no está activada. La vista permite comprobar sesión/acceso al pulsar el botón, pero **no permite iniciar enrolamiento ni desafío**. El guard existente no se modifica y sigue exigiendo identidad real, asignación vigente, firma/caducidad, AAL2 y factor verificado para la lectura administrativa.

La bandera local y la casilla evitan acciones accidentales: no son un nuevo permiso de negocio ni una frontera de seguridad frente a un usuario que modifique React. Supabase controla el MFA de la propia identidad y el servidor conserva la autorización administrativa completa. No hay un endpoint nuevo que omita AAL2 para obtener datos o asignar privilegios.

### Pasos posteriores, sujetos a autorización del propietario

1. Elegir una cuenta ficticia autorizada. Para la aceptación administrativa debe tener además una asignación de superusuario válida; si no existe, su provisión requiere autorización separada. Completar MFA no concede roles.
2. Iniciar sesión en `/cuenta`, con contraseña únicamente en navegador. Abrir `/desarrollo/mfa-admin` y pulsar **Comprobar sesión y acceso**. El nivel del SDK es informativo; la aceptación administrativa se expresa mediante el HTTP del servidor.
3. Solo después de autorizar expresamente cambios MFA de esa cuenta, el propietario puede configurar `DENTAIA_QA_MFA_ENABLED=true` en el entorno local y reiniciar `npm run dev`. Esta revisión no activó la bandera ni ejecutó esos cambios.
4. Si ya existe un TOTP verificado, seleccionarlo y verificar el código. No se enrola otro factor automáticamente.
5. Si no hay factores y se autorizó el enrolamiento, marcar la casilla y pulsar **Iniciar enrolamiento TOTP autorizado**. Supabase crearía un factor no verificado. El usuario escanea el QR directamente; no compartirlo ni pedir capturas/códigos por chat. Verificar un factor puede cerrar otras sesiones, tal como advierte la interfaz.
6. El usuario introduce el código de seis dígitos y pulsa **Crear desafío y verificar código**. El SDK ejecutaría el flujo legítimo y renovaría su sesión; no se edita ni simula `aal`. La pantalla solo informa AAL2 después de volver a consultar el SDK y separa el HTTP del servidor: AAL2 con HTTP 403 **no** acredita autorización administrativa.
7. Solo con HTTP 200 del guard se continúa con el protocolo de lectura real, búsqueda, filtros, paginación y respuestas mínimas. Registrar evidencia saneada por escenario; no publicar las respuestas completas.
8. Después de la prueba, desactivar la bandera local MFA. No eliminar ni retirar factores remotamente sin una autorización específica.

Si existe un factor no verificado previo o se pierde el QR al recargar/cambiar de sesión, se requiere revisión autorizada: no se crea otro ni se elimina el anterior automáticamente. Una operación ya enviada a Supabase no se deshace al desmontar la vista; la interfaz descarta el resultado de una identidad anterior. La prevención de duplicados local no garantiza exclusión transaccional entre varias pestañas.

### Separación de pruebas y aceptación pendiente

| Comprobación | Evidencia / resultado |
| --- | --- |
| Configuración y credencial Auth Admin | Real: cinco comprobaciones de configuración correctas y lectura mínima aceptada por el adaptador. |
| Sesiones/factores de QA-A y QA-B | Real: agregados SQL sin superusuario, sin factores verificados ni filas AAL2. No se presenta como sesión de navegador. |
| Enrolamiento/challenge/verify reales | **NO EJECUTADOS**; requieren autorización y participación del titular. No se crearon ni eliminaron factores. |
| Consulta administrativa positiva AAL2 | **NO VERIFICADA**; la credencial privada sola no concede una sesión de aplicación. |
| Controlador MFA y regresión | 189 pruebas aisladas sin fallos (177 previas y 12 nuevas). Las pruebas nuevas usan fixtures y no acreditan MFA real. |
| Flujos de roles con escritura/auditoría/concurrencia | Siguen pendientes y bloqueados. No se habilitan escrituras administrativas. |

Pruebas nuevas cubren lectura sin mutaciones; bandera y consentimiento; identidad ausente; proyección del enrolamiento; factor verificado existente; pendiente creado en la misma vista; código/factor inválido; cambio de identidad; redacción de errores; ausencia de AAL2 posterior; doble envío y respuestas inválidas. Se corrigieron dos aserciones inicialmente demasiado amplias que confundían `actor-fixture` con su subcadena dentro de `factor-fixture`; no se relajaron los controles de producción.

Referencias consultadas: [enroll](https://supabase.com/docs/reference/javascript/auth-mfa-enroll), [challenge](https://supabase.com/docs/reference/javascript/auth-mfa-challenge), SDK instalado `2.118.0` y changelog vigente. Se aplicó la revisión de componentes React: imports privados ausentes, eventos explícitos, suscripción limpiada, respuestas antiguas descartadas, etiquetas/foco/estado accesibles y sin dependencias nuevas. No se afirma una validación visual con navegador real, porque el host no estuvo disponible.

### Verificación final de esta preparación

- `npm run typecheck`, `npm run build` y `git diff --check`: correctos. Suite completa: 189/189 aisladas, 0 fallidas y 0 omitidas. Logs temporales: `%TEMP%/DentaIA-DI151-mfa-pruebas.tap` y `%TEMP%/DentaIA-DI151-mfa-build.log`.
- Comparación exacta de la credencial real con todos los archivos de `.next/static`: **sin coincidencias**, sin imprimir la credencial ni los contenidos. El HTML de la vista local tampoco contiene su valor. El adaptador conserva `server-only` y no se importa en los componentes MFA.
- HTTP de producción local: `/desarrollo/mfa-admin` devuelve 404, también al intentar habilitarla por query. Lectura administrativa sin bearer, con privilegios falsos o token sintético inválido: 401. POST lectura: 405; asignación de roles no habilitada: 404. Registro: `%TEMP%/DentaIA-DI151-mfa-http.json`.
- Desarrollo local: servidor iniciado en el puerto 3000; la vista MFA entrega HTML 200 y el botón de enrolamiento está desactivado. Se corrigió una aserción de texto que sufría conversión de acentos al canalizar PowerShell a Node; la comprobación ASCII posterior coincide con el HTML esperado. Esto no acredita hidratación/interacción visual ni una sesión real de navegador.
- Se pidió al responsable comprobar manualmente únicamente nivel y HTTP en la nueva vista; no se le pidió compartir usuario, QR, código ni token y no se le pidió activar enrolamiento. Esa respuesta, si se aporta, debe registrarse como comprobación manual reportada, separada de las pruebas observadas por el agente.
- Los 25 archivos previos fueron conservados; solo se ampliaron los tres documentos de esta Parte 2 y se añadieron los cinco archivos del flujo MFA. Ningún archivo previo de código cambió. `.env.local` y la bandera MFA permanecen como estaban; no se modificó el `next-env.d.ts` que ya estaba pendiente al comenzar esta revisión.

No se ejecutaron `enroll`, `challengeAndVerify`, retirada de factores o cambios de roles contra Supabase real. No hay commit, push, PR, merge ni cambios de Jira. La credencial está verificada para Auth Admin, pero **la aceptación positiva de lectura con AAL2 sigue pendiente**, al igual que las escrituras controladas obligatorias de DI-151.

## 9. Aprovisionamiento puntual solicitado, pendiente de confirmación

Seguimiento: el responsable informó posteriormente que asignó el rol por su cuenta. El agente no ejecutó este script; la sección 10 registra la lectura real que confirma el estado. No se atribuye esa modificación al agente ni a una ejecución del script.

Se creó `scripts/asignar-superusuario.mjs` para **un solo UUID fijado en su código**, el indicado expresamente por el propietario, exclusivamente en Dental-IA. No es una API de roles ni completa el mecanismo general de administración de DI-151.

Antes de preparar la operación se hicieron lecturas independientes reales mediante SELECT y `auth.admin.getUserById()`: el UUID coincide, la identidad está confirmada y habilitada, el proveedor coincide con `email`/`[email]` y no existe namespace `dentaia`. No se imprimieron identidades, correos, nombres, metadatos completos, claves o tokens. El titular de la cuenta debe contrastar en su panel el UUID que autorizó; esta verificación técnica no inventa una comprobación de identidad por correo.

**Resumen de la operación propuesta:** añadir `app_metadata.dentaia = {version:1, estado:"activo", roles:["superusuario"]}`, conservando todos los demás valores de `app_metadata`. No se cambia contraseña, correo, MFA, `profiles`, otras cuentas, RLS ni el código de autorización. **No se ejecutó el CLI ni se modificó el rol real: falta la confirmación del propietario después de revisar este resumen.**

Controles del script:

- Usa la configuración privada existente de `.env.local` mediante `@next/env`, sin guardar ni imprimir valores; exige la URL exacta del proyecto y la rama `feature/superusuario-admin`.
- Su cliente solo admite GET/PUT al UUID fijado. El PUT solo acepta `app_metadata` y se permite como máximo un envío por instancia; no ofrece operaciones sobre otras cuentas o campos.
- Sin argumentos o con `--resumen`, solo prepara una vista previa mediante lectura. `--aplicar` exige una terminal interactiva y la frase exacta `ASIGNAR SUPERUSUARIO DI-151 A LA CUENTA VERIFICADA`. Confirmación genérica, booleana o distinta no escribe.
- Hace una lectura fresca después de confirmar y cancela si cambió la identidad o cualquier metadato desde la vista previa. Conserva valores anidados y bloquea namespaces/asignaciones preexistentes distintos, sin reemplazar roles de terceros ni retirar administradores.
- Utiliza `auth.admin.updateUserById()` y siempre un GET posterior para verificar identidad, asignación y conservación de metadatos. No informa éxito basándose solo en el PUT.
- Si se pierde la respuesta de escritura, verifica el estado con GET y lo distingue de una respuesta confirmada. Si la lectura falla o difiere, informa incertidumbre/revisión, sin reintentos de escritura ni rollback automático. Nunca imprime el error crudo de Supabase.

Límite importante: Auth Admin no ofrece aquí compare-and-swap ni una transacción compartida con auditoría PostgreSQL. El doble GET detecta cambios durante la confirmación y la lectura posterior detecta divergencias, pero no elimina la ventana entre la última lectura y el PUT. Ejecutar esta provisión puntual con un único operador y sin otras modificaciones concurrentes sobre la cuenta; no presentarla como implementación transaccional ni como auditoría persistida del panel. La gestión general de roles de DI-151 sigue pendiente.

### PowerShell, después de la confirmación del propietario

Desde la raíz de DentaIA:

```powershell
# Vista previa; no modifica la cuenta.
node scripts/asignar-superusuario.mjs --resumen

# Presenta el resumen y exige confirmación escrita en la terminal.
node scripts/asignar-superusuario.mjs --aplicar
```

En el segundo comando escribir exactamente la frase indicada cuando la terminal la solicite. No introducir claves, tokens o contraseñas como argumentos. El script no modifica el `.env.local` existente.

Comprobaciones ejecutadas: `node --check scripts/asignar-superusuario.mjs`, `npm run typecheck`, suite Node completa y `git diff --check`. **200 pruebas aisladas sin fallos**, incluidas 11 nuevas en `asignar-superusuario.test.mjs`. Los tests usan datos y transporte ficticios; no ejecutan el CLI ni escrituras remotas. Una aserción inicial se ajustó al comportamiento real del SDK, que devuelve errores de transporte mediante `error` en lugar de rechazar la promesa; se mantuvieron todas las restricciones del transporte.

La verificación real posterior del rol se ejecutará únicamente después de recibir confirmación y completar la operación. No se declara hecha esa verificación anticipadamente. Sin commit, push, PR o merge.

## 10. Enrolamiento TOTP personal y endurecimiento de sesión

Trabajo del 02/11/2026 (America/Lima), siempre dentro de la Parte 2. El responsable reportó una cuenta real de pruebas con rol superusuario y una sesión `aal1`, 0 TOTP verificados, 0 pendientes y HTTP 403. Ese HTTP es coherente con la exigencia de AAL2; no se modifica el guard para eludirlo.

### Implementación y correcciones

El flujo ya utilizaba `auth.mfa.enroll({factorType: 'totp'})`, `challengeAndVerify()` y el endpoint de acceso. El bloqueo inmediato era `DENTAIA_QA_MFA_ENABLED=false`. A petición del responsable se activó **solo esa variable local** en `.env.local`, preservando todas las demás variables y sin imprimirlas. No se cambiaron roles, permisos o configuración remota de Supabase.

Cambios en `mfa-local.ts`, `MfaAdminLocal.tsx` y sus pruebas:

- El QR se representa como imagen SVG local, en memoria, después de comprobar identidad y sesión vigentes. Admite el SVG y data URI del SDK, así como payload codificado/base64; no inserta SVG mediante HTML ni usa un optimizador externo.
- Se oculta mientras se vuelve a comprobar la sesión y se retira ante logout, cambio de identidad, caducidad, rechazo 401 o factor no disponible. Un temporizador ligado a `expires_at` se actualiza al refrescar la sesión; no sustituye la autorización del servidor ni promete detectar instantáneamente una revocación remota aún no observada.
- Antes de enrolar o verificar se vuelven a comprobar identidad, correspondencia de sesión y caducidad. El código solo vive en memoria y se borra del campo al enviarlo; no hay logs de códigos, QR, URI, secretos o tokens.
- Los errores de código rechazado, desafío caducado, límite de intentos, TOTP deshabilitado, sesión inválida y transporte tienen mensajes seguros distintos. Los códigos MFA específicos se distinguen antes de interpretar el estado HTTP, para no confundir un OTP incorrecto con logout.
- Cada reintento manual de verificación usa `challengeAndVerify()` y genera un desafío nuevo. No se reintenta automáticamente una mutación ni se enrola otro factor al fallar un código.
- Se reutiliza un factor propio verificado. También se puede retomar un pendiente propio ya escaneado después de recargar: el ID debe estar en la lista fresca de factores de la identidad actual y se exige el código que comprueba Supabase. No se acepta un factor ajeno ni se elimina ninguno automáticamente.
- Si se perdió un QR sin escanearlo, no se recupera su secreto desde almacenamiento ni se elimina el factor a ciegas: requiere revisión autorizada. Completar este flujo no constituye recuperación de factores perdidos.
- Después de verificar se vuelve a consultar el nivel del SDK y se envía el token renovado al guard real `/api/administracion/acceso`. **AAL2 con HTTP 403/503 no se muestra como acceso aceptado**. DI-150 conserva identidad, firma/caducidad, asignación vigente, AAL2 y factor verificado.

### Recorrido que debe completar personalmente el titular

El servidor local se reinició y quedó disponible en `http://localhost:3000`. Usar exactamente el mismo origen de la sesión existente; no alternar con 127.0.0.1.

1. Abrir `/desarrollo/mfa-admin` y pulsar **Comprobar sesión y acceso**. Con el estado inicial reportado se espera `aal1`, cero factores y 403.
2. Marcar la casilla de autorización para modificar el MFA de la cuenta ficticia actual.
3. Pulsar **Iniciar enrolamiento TOTP autorizado** una sola vez. Esto creará el factor no verificado en la cuenta autenticada; el agente no pulsa ese botón ni obtiene su QR.
4. Escanear personalmente el QR desde una aplicación autenticadora compatible TOTP. No compartirlo ni enviarlo al chat, logs o capturas. Mantener la página abierta hasta terminar.
5. Introducir los seis dígitos actuales solo en el campo del navegador y pulsar **Crear desafío y verificar código**. El SDK oficial valida la posesión y conserva la sesión renovada; no se editan claims ni se simula `aal`.
6. La vista actualiza el resultado automáticamente. La aceptación esperada es **nivel `aal2`, al menos un factor verificado y HTTP 200 del servidor**. Pulsar otra vez **Comprobar sesión y acceso** debe conservar ese resultado.
7. Si el código fue rechazado, comprobar la hora automática del dispositivo, esperar el código siguiente y reintentar la verificación, sin generar otro QR. Si caducó la sesión, volver a `/cuenta`, iniciar sesión y seleccionar el factor propio existente/pending ya escaneado para verificarlo.
8. No se declara completada la aceptación por ver solamente un QR, por recibir respuesta de enrolamiento o por tener un factor registrado. Se requieren la verificación de posesión y la aceptación del guard. Si se mantiene 403 con AAL2, revisar la asignación y los controles efectivos sin desactivarlos; si aparece 503, revisar disponibilidad/configuración.

Verificar un factor nuevo puede cerrar otras sesiones de esa cuenta; se informa antes de ejecutar la acción. Tras las pruebas, el propietario puede volver a desactivar la bandera local MFA sin retirar el factor ni desactivar AAL2. Para una sesión futura AAL1, habilitar esta vista local de nuevo y desafiar el factor existente, no enrolar uno nuevo.

### Evidencia y límites

| Verificación | Resultado y naturaleza |
| --- | --- |
| Cuenta objetivo mediante `getUserById` real de Auth Admin | UUID coincidente, superusuario activo, 0 TOTP verificados y 0 pendientes en la lectura previa al recorrido personal. Solo booleanos y recuentos; cero escrituras del agente. |
| `aal1` y HTTP 403 iniciales | Reportados por el responsable desde su sesión real; no se presentan como una sesión observada mediante automatización. |
| Configuración local / HTML de desarrollo | MFA habilitado, HTML 200, casilla disponible y credencial privada ausente del HTML. No se extrae la sesión del navegador. |
| Producción local | Vista MFA: 404, también con intento de activación por query. Endpoint sin sesión/cabeceras falsas/token sintético: 401; POST lectura: 405. No se elude el guard. |
| Exposición de la credencial real | Comparación exacta contra los archivos públicos del build: sin coincidencias; no se imprime el valor. |
| TypeScript y build | `npm run typecheck` y `npm run build`: correctos. |
| Suite completa Node | **208/208 aisladas, 0 fallidas y 0 omitidas**; 20 casos específicos de MFA. Los ocho casos añadidos cubren pendientes propios, expiración, reintento, errores seguros y formatos de QR. No acreditan MFA real. |
| Enrolamiento, verificación real y aceptación AAL2 | Pendientes de la actuación personal del titular y del resultado observado. No se crean factores ni se introducen códigos mediante fixtures para sustituir esta comprobación. |

Logs técnicos sin datos de cuentas reales ni credenciales: `%TEMP%/DentaIA-DI151-totp-pruebas.tap`, `%TEMP%/DentaIA-DI151-totp-build.log` y `%TEMP%/DentaIA-DI151-totp-http.json`. La marca ISO de los logs está en UTC; la fecha de trabajo se expresa en America/Lima.

No se ejecutó el script de asignación ni se modificaron roles, permisos, tablas, RLS o ajustes remotos de MFA. No hay commit, push, PR o merge. Los criterios de DI-151 sobre administración persistida con auditoría y concurrencia continúan pendientes, independientemente del resultado del enrolamiento personal.

## 11. Diagnóstico del bloqueo de enrolamiento y corrección del formato SVG

El responsable informó que no podía iniciar TOTP. Se comprobó que la bandera local está activa y que la vista actual responde 200. Una lectura real de la cuenta autorizada mostró **0 factores TOTP verificados y 1 pendiente**, sin escrituras del agente. Por tanto, existe un enrolamiento iniciado; no se puede tratar como una cuenta sin factores ni crear otro automáticamente.

Se identificó un defecto del validador local: admitía la declaración XML, pero no un comentario entre esta y el elemento `<svg>`. El [código de Supabase Auth](https://github.com/supabase/auth/blob/master/internal/api/mfa.go) utiliza goqrsvg y SVGo para generar ese contenido, y [SVGo](https://github.com/ajstarks/svgo/blob/master/svg.go) antepone declaración XML y comentario. Un formato legítimo podía producir `QR_NO_DISPONIBLE` después de que Supabase ya hubiera creado el factor.

La regresión con un SVG ficticio de ese formato reprodujo el fallo antes de la corrección. Se corrigió la validación del prólogo XML/comentarios, manteniendo la exigencia de raíz SVG y la representación mediante imagen aislada, sin HTML inyectado. No se leyó ni registró el QR real del usuario. La interfaz ahora explica expresamente por qué el botón está desactivado: consentimiento, comprobación previa, operación en curso, QR ya emitido o factor existente.

Verificación: **209 pruebas aisladas sin fallos**, incluida la regresión nueva; TypeScript, build y `git diff --check` correctos. El servidor local se reinició con la corrección. Los fixtures no acreditan un nuevo enrolamiento real. Logs temporales de comprobación: `%TEMP%/DentaIA-DI151-qr-correccion-pruebas.tap` y `%TEMP%/DentaIA-DI151-qr-correccion-build.log`.

Pendiente personal: confirmar si el titular llegó a escanear el QR. Si lo escaneó, puede seleccionar el factor pendiente y verificar su código. Si sigue visible, debe escanearlo y continuar, sin repetir enrolamiento. Si no lo vio o perdió el QR sin escanearlo, esta corrección no recupera el secreto de ese factor ya creado: retirar exclusivamente ese pendiente y comenzar otro enrolamiento requerirá autorización específica, sin tocar factores verificados ni roles. No se eliminó ni modificó ningún factor ni se declaró alcanzado AAL2.

### Retirada puntual autorizada del factor no verificado

El titular confirmó que no llegó a ver el QR y autorizó expresamente eliminar únicamente ese pendiente. El 02/11/2026 (America/Lima) se ejecutó `auth.admin.mfa.deleteFactor()` sobre el único TOTP no verificado de la cuenta de pruebas indicada, mediante la credencial privada existente exclusivamente en Node servidor.

Antes de eliminar se hicieron dos lecturas reales: se exigió que hubiera un solo factor total, de tipo TOTP y estado `unverified`, y que factores, identidad y metadatos no hubieran cambiado entre lecturas. El transporte permitió solo GET de esa cuenta y un único DELETE del factor elegido; no admitió mutaciones de usuarios, roles, contraseña o configuración.

La nueva lectura posterior confirmó **0 pendientes y 0 verificados**, con `app_metadata` y datos de identidad comprobados sin cambios. No se modificaron otros factores ni se publicaron identificadores, códigos, QR, secretos o tokens. La respuesta de eliminación fue correcta y no se realizaron reintentos.

Evidencia saneada: `%TEMP%/DentaIA-DI151-factor-pendiente-retirado.json` (marca ISO en UTC). No se generó un QR nuevo ni se ejecutó verificación TOTP por el agente. El titular debe recargar la vista para retirar el estado local anterior, comprobar la sesión e iniciar un nuevo enrolamiento personalmente. La aceptación `aal2`/HTTP 200 sigue pendiente. Sin commit, push o merge.

### Recuperación del servidor local por chunk generado ausente

Se atendió el error `ENOENT` del archivo generado `.next/server/vendor-chunks/@supabase.js`. Se confirmó que el archivo faltaba y que un proceso Next de este repositorio seguía respondiendo HTTP 500. Se detuvieron únicamente procesos Node identificados como Next de DentaIA y se comprobó que el puerto 3000 quedaba libre.

La carpeta `.next` inconsistente se movió a una carpeta temporal local, después de verificar rutas absolutas y que no fuera un enlace; no se eliminaron fuentes, dependencias, configuración ni datos remotos. Se inició una sola instancia de desarrollo y se regeneraron los chunks. El archivo faltante volvió a existir.

Verificación HTTP real posterior: `/desarrollo/mfa-admin` y `/cuenta` responden 200 sin `ENOENT`; `/api/administracion/usuarios/reales` sin sesión responde 401, conservando el control de autorización. No se ejecutó otro build sobre el servidor de desarrollo activo ni se modificó Supabase. Estos resultados no acreditan la sesión AAL2 del navegador del titular. No hay commit, push o merge.

### MFA completado personalmente y verificación real posterior

El titular informó que escaneó el nuevo QR e introdujo el código en el navegador. La lectura real posterior, mediante SELECT de agregados para la cuenta de pruebas autorizada, confirmó: **superusuario activo, 1 TOTP verificado, 0 pendientes y 1 fila de sesión AAL2 no vencida por `not_after`**. No se recuperaron ni imprimieron códigos, QR, secretos o JWT. La consulta SQL por sí sola no acredita la vigencia de un access token específico.

Como evidencia independiente de aplicación, se inspeccionaron exclusivamente estados HTTP saneados del servidor Next local que atendió la prueba: `GET /api/administracion/acceso` pasó por la secuencia **403 → 200 → 200**. Se revisó el guard real sin modificarlo: el 200 exige identidad vigente, asignación de superusuario, claims verificados y caducidad, AAL2 y factor verificado. Los logs no incluyen identidad ni correlación por JWT, por lo que no se les atribuye una inspección de token o de la pantalla del usuario.

Estos son resultados reales posteriores al recorrido del titular, separados de los 209 tests aislados. Se acredita el funcionamiento positivo de MFA y del guard observado en esta prueba local, sin afirmar todavía una consulta positiva de `/api/administracion/usuarios/reales`, filtros/paginación o escrituras de roles con auditoría. La Parte 2 y DI-151 siguen abiertas por esos criterios. El agente no ejecutó verificaciones TOTP en nombre del titular, no cambió roles y no realizó commit, push o merge.


## 12. Validación real del proveedor administrativo — Parte 2

Fecha: 02/11/2026 (America/Lima). Las marcas ISO de los informes están en UTC.

### Método y seguridad

El titular ejecutó la vista local `/desarrollo/lectura-admin` con su sesión AAL2 real. El SDK normal envía la autorización a `GET /api/desarrollo/validar-lectura-admin`; el servidor invoca internamente el handler existente de `GET /api/administracion/usuarios/reales` para cada caso. Cada invocación aplica el guard real y utiliza Supabase Auth Admin y profiles reales, sin mocks ni sustitución de AAL2. El agente no extrajo tokens, no leyó localStorage ni recibió credenciales del titular.

Los códigos de la tabla son los Response.status del handler real invocado internamente, no solicitudes HTTP independientes del navegador al endpoint original. La petición HTTP de la herramienta con la sesión administrativa respondió 200. La invocación interna evita publicar nombres o UUID de búsqueda en logs HTTP. Los informes contienen únicamente métricas, nunca filas ni valores buscados.

El adaptador privilegiado permanece en módulos server-only, se crea dentro de una operación autorizada y permite únicamente GET a Auth Admin y profiles. Consulta de profiles limitada a id/full_name. La respuesta proyecta campos permitidos de identidad, perfil, estado y asignación, sin correos, teléfonos, contraseñas, factores MFA, credenciales ni datos clínicos.

### Evidencia real

Ejecución administrativa: de30c10f-959d-4ee5-8f94-ae4f235abf7f; UTC 2026-11-03T01:19:05.261Z. Resultado COHERENTE: 24 casos.

| Comprobación | HTTP del handler | Resultado sin datos personales |
| --- | --- | --- |
| Listado Auth + profiles | 200 | 5 cuentas únicas: 2 perfiles presentes y 3 ausentes. |
| Búsqueda UUID / nombre | 200 / 200 | 1 coincidencia en cada búsqueda, coherente con el listado base. |
| Búsqueda sin coincidencias | 200 | 0 filas. |
| Filtros de roles | 200 en los cinco casos | Superusuario: 1; sin asignación: 4; paciente, odontólogo y asignación inválida: 0 cada uno. No se infiere paciente por defecto. |
| Filtros de estados Auth | 200 en los seis casos | Habilitadas: 4; sin confirmar: 1; suspendidas, anónimas, eliminadas e inconsistentes: 0 cada una. |
| Filtros combinados | 200 | 3 filas, coherentes con la intersección del listado base. |
| Tamaños de página 5, 10 y 20 | 200 | 5 filas en página 1/1, total estable y orden coherente. |
| Página solicitada 999, tamaño 5 | 200 | Normalizada a la última página existente: 1/1, 5 filas. |
| Parámetro duplicado, rol inválido, actorId no admitido | 400 en los tres casos | Rechazados. |
| Sin sesión | 401 | Sin listado. También probado por HTTP directo al endpoint original en desarrollo y producción local. |
| Bearer sintético inválido | 401 | Rechazo real; no representa una segunda cuenta autenticada. |
| Segunda sesión real no administrativa | 403 | Sin registros consultados ni acceso al proveedor privilegiado. |

Segunda ejecución: eb295c6a-5806-428c-b41e-4889dd328dee; UTC 2026-11-03T01:20:20.983Z. El titular confirmó la sesión normal en el origen separado 127.0.0.1 y ejecutó la herramienta. Se presentó autorización y el handler respondió 403. El informe dice BLOQUEADA/SESION_O_PERMISO porque intenta un listado positivo: para esta prueba negativa es el rechazo esperado. No se inspeccionó ni publicó el JWT para identificar la cuenta.

Todas las respuestas de ambas ejecuciones conservaron Cache-Control privado/no-store, CDN-Cache-Control no-store y Vary Authorization. Las respuestas 200 cumplieron el contrato cerrado de campos en raíz y objetos anidados.

Informes locales saneados: `%TEMP%/DentaIA-DI151-lectura-real-<identificador-de-ejecucion>.json`.

### Implementación auxiliar y pruebas aisladas

Archivos nuevos: ValidacionLecturaAdmin.tsx, validacion-lectura.ts, validacion-lectura-servidor.ts, validacion-lectura.test.mjs y las dos rutas locales indicadas. Se reutilizan autorización y proveedor sin modificar sus controles. La matriz limita su recorrido a 100 cuentas, no hace escrituras remotas y no devuelve datos personales en sus informes.

- TypeScript, build y git diff --check: correctos.
- Suite Node: **213 pruebas aisladas aprobadas, 0 fallidas, 0 omitidas**. Cuatro casos nuevos verifican la matriz, límites, rechazos y sanitización con fixtures, sin acreditar servicios reales.
- Producción local: vista y endpoint auxiliar de desarrollo responden 404; endpoint real sin sesión responde 401.
- Comparación exacta de la credencial configurada contra los 45 archivos públicos de .next/static: sin coincidencias, sin imprimir el valor.
- Rama feature/superusuario-admin. Cambios locales anteriores conservados; guard de autorización y adaptadores existentes sin cambios durante esta validación. Sin commit, push, PR ni merge.

### Pendientes y límites de aceptación

La muestra real de cinco cuentas no permite probar tránsito entre dos páginas con el tamaño mínimo de cinco. El recorrido multipágina y los ejemplos positivos de cuenta suspendida/asignación inválida se comprobaron mediante fixtures y siguen **NO VERIFICADOS con ejemplares reales**. Sí se ejecutaron los filtros vacíos reales. No se crearon ni alteraron cuentas para fabricar esos estados.

Auth y PostgreSQL no comparten snapshot ni transacción. La coherencia observada no garantiza consistencia futura bajo concurrencia. El panel de demostración previo continúa usando un proveedor sintético; la vista QA no equivale a conectar ese listado a producción.

Siguen pendientes las operaciones obligatorias de roles autorizadas, auditoría durable, concurrencia, protección del último administrador, prevención de autoelevación y recuperación ante fallos. Las escrituras administrativas continúan sin habilitarse. No se modificaron cuentas, roles, políticas RLS ni configuración remota. **DI-151 Parte 2 y DI-151 permanecen abiertas.**

## 13. Actualización persistente de roles: implementación revisable, sin activar

Esta sección continúa exclusivamente la **Parte 2**. No constituye otra parte ni traslada la persistencia y su validación a DI-152.

### 13.1. Diagnóstico comprobado y decisión propuesta

Lecturas de catálogo del proyecto Dental-IA confirmaron las columnas utilizadas de `auth.users`, `auth.sessions`, `auth.mfa_factors` y `auth.mfa_amr_claims`. `profiles` conserva únicamente `id`, `full_name` y `created_at`; no se añade una columna editable de roles. Las tablas Auth inspeccionadas son propiedad de `supabase_auth_admin` y tienen RLS habilitado. El catálogo confirma privilegios de SELECT para `postgres` y UPDATE sobre `raw_app_meta_data`; esto **no acredita una escritura ejecutada ni la compatibilidad operativa de la migración**. No se consultaron contraseñas, secretos MFA, JWT o datos clínicos.

La sección 5 del contrato de usuarios documentaba dos bloqueos: Auth Admin por HTTP y auditoría separada no son una transacción, y la alternativa canónica/outbox requeriría adaptar DI-150. Se prepara ahora otra propuesta: **conservar Auth como autoridad y realizar el cambio acotado de `raw_app_meta_data.dentaia` junto con revisión, consumo de aprobación y auditoría en una transacción de la misma base PostgreSQL**. No llama `auth.admin.updateUserById()` ni intenta compensaciones por HTTP. No modifica el esquema Auth, sus políticas, perfiles, contraseñas o sesiones.

Es una actualización SQL deliberadamente limitada de un campo de una tabla gestionada por Supabase, no una API transaccional ofrecida por Auth Admin. **Requiere revisión explícita de esta decisión, del propietario de la función, permisos, triggers y compatibilidad con la versión Auth en un entorno aislado antes de aplicarla.** No se sustituye silenciosamente la arquitectura anterior ni se afirma que esté aprobada por existir este código. Si se rechaza escribir ese campo desde la función restringida, se mantiene todo desactivado y deberá desarrollarse la alternativa canónica/outbox con los cambios de autorización correspondientes.

Referencias primarias revisadas: [datos de Auth](https://supabase.com/docs/guides/auth/managing-user-data), [funciones y permisos](https://supabase.com/docs/guides/database/functions), [bloqueos PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html) y [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). El changelog vigente incluye la futura retirada de cifrados TLS antiguos; no se desactiva TLS ni se actualizan dependencias. El guard sigue leyendo asignación fresca mediante Auth, sin confiar en claims antiguos de roles.

### 13.2. Alcance permitido y límites funcionales

- **Asignar o revocar `paciente` y `superusuario`**, o revocar `odontologo`, sobre otra cuenta habilitada, siempre con transición previamente aprobada y vinculada a actor, objetivo, operación, rol, revisión y asignación esperada.
- Se rechazan todos los cambios propios. Modificar otro superusuario requiere la aprobación independiente exacta; sin ella no existe excepción del panel. Revocar superusuario comprueba el número de administradores activos bajo el bloqueo global y rechaza dejar cero. Dos administradores que intenten revocarse mutuamente quedan serializados: el segundo vuelve a validar su autorización después del primero. El actor no puede eliminarse su rol y siempre se revalida su asignación vigente.
- Promover a superusuario exige además que la cuenta objetivo tenga un TOTP verificado. No se enrola MFA ni se concede el rol automáticamente. El guard seguirá exigiendo su sesión AAL2 para cualquier acceso administrativo posterior.
- **Conceder `odontologo` sigue bloqueado**, incluso con aprobación administrativa: aún no existe verificación profesional ni vínculo de clínica. Puede revocarse un rol previamente existente mediante aprobación, preservando los demás; no se inventan permisos clínicos.
- Una asignación desconocida, suspendida, con duplicados o campos adicionales no se sobrescribe. La asignación ausente se distingue de una inválida. Revocar el único rol elimina el namespace `dentaia`, manteniendo los demás metadatos.
- El aprobador debe ser otro superusuario habilitado, distinto de actor y objetivo. Las aprobaciones solo se provisionan por el propietario mediante un procedimiento externo auditado: **no hay endpoint que permita al operador aprobarse ni INSERT directo para authenticated/service_role**.
- Con un único superusuario no hay aprobador independiente disponible. No se crean cuentas ni se elevan roles para eludir ese bloqueo; debe resolverse mediante autorización y provisión explícitas del propietario.

### 13.3. Contrato y flujo del servidor

Nuevo endpoint protegido: `GET /api/administracion/roles?usuarioId=<UUID>` obtiene revisión y asignación; `POST /api/administracion/roles` intenta una transición. Ambos ejecutan DI-150 antes de crear el cliente privilegiado o leer el cuerpo. En `autorizacion.ts` se añade exclusivamente la acción `roles.actualizar` a la lista cerrada; las comprobaciones de identidad, estado, firma, caducidad, AAL2 y factor verificado no se alteran.

El servidor vuelve a verificar claims con el SDK oficial, extrae internamente identidad/sesión/caducidad y nunca acepta ese contexto del cliente. La función SQL revalida el actor actual bajo bloqueo, comprueba una sesión existente AAL2, su factor verificado, `not_after`, caducidad del token y un AMR TOTP cuya `updated_at` esté dentro de los últimos **cinco minutos**. Renovar el token no equivale a realizar un desafío TOTP reciente. La ventana es una decisión propuesta que deberá aceptarse y validarse con Supabase real.

POST exige `Origin` del mismo origen, JSON de hasta 2048 bytes y `Idempotency-Key` UUID. No admite actor, metadatos libres, roles técnicos ni parámetros adicionales. Su cuerpo es:

```json
{
  "usuarioId": "<UUID de cuenta ficticia autorizada>",
  "operacion": "asignar",
  "rol": "paciente",
  "revisionEsperada": 0,
  "asignacionEsperada": null,
  "aprobacionId": "<UUID de aprobación independiente>"
}
```

Los marcadores son explicativos, no un JSON ejecutable con UUID válidos. La revisión y asignación deben proceder del GET protegido inmediato, no de valores inventados ni de un listado antiguo.

El adaptador es `server-only`, no reutiliza la credencial de lectura y permite solamente POST al RPC fijo `dentaia_cambiar_roles_v1`, sin redirects, caché, tablas arbitrarias o reintentos automáticos del SDK. Configuración futura exclusiva del servidor:

- `DENTAIA_ROLE_WRITES_ENABLED=true`: **no configurada ni activada por esta entrega**.
- `DENTAIA_SUPABASE_ROLE_WRITE_SECRET`: credencial privada a provisionar después de aprobación, nunca `NEXT_PUBLIC_*`. El nombre no convierte una clave de servicio en una credencial limitada: sigue siendo privilegiada y requiere custodia/rotación. No se solicita ni publica su valor.
- `NEXT_PUBLIC_SUPABASE_URL`: origen HTTPS existente; la autorización de identidad mantiene su clave publicable existente.

Con bandera apagada, un actor autorizado recibe 503 `ESCRITURAS_DESACTIVADAS`, sin instanciar el adaptador. Un fallo después de enviar el RPC se presenta como 503 `ESTADO_NO_CONFIRMADO`: puede haberse confirmado el commit aunque se pierda la respuesta. Se debe reintentar el mismo cuerpo y clave, sin generar otra operación. Ningún mensaje afirma éxito o rollback sin confirmación.

### 13.4. Transacción, auditoría e idempotencia

La migración propuesta crea el esquema privado `dentaia_admin` y tres tablas con RLS habilitado y sin permisos directos de cliente/servicio:

| Tabla | Función |
| --- | --- |
| `revisiones_roles` | Contador por objetivo; comienza lógicamente en cero y aumenta solo cuando cambia la asignación. |
| `aprobaciones_roles` | Aprobación independiente, transición exacta, caducidad y solicitud que la consumió. |
| `auditoria_roles` | Actor, objetivo, aprobación, solicitud, entrada mínima, asignación anterior/posterior, resultado y fecha. Sin datos clínicos, contraseñas, MFA ni metadatos ajenos. Clave primaria `(actor_id, solicitud_id)`. |

El wrapper público es SECURITY INVOKER y solo ejecutable por `service_role`. Delega a una función privada SECURITY DEFINER del aplicador `postgres`, con `search_path` vacío, sin SQL dinámico y sin permisos sobre tablas para el cliente. La elevación interna es necesaria para acceder al campo Auth y registrar auditoría sin abrir sus tablas; no se modifica ni desactiva RLS. El papel del propietario privilegiado debe revisarse antes del despliegue; no se presenta como una función sin privilegios.

Orden: bloqueo advisory transaccional global del protocolo; aprobación; filas de actor/objetivo/aprobador en orden UUID; revalidación; consulta de idempotencia; comparación de revisión y snapshot; validación de aprobación; UPDATE acotado de Auth; revisión; consumo de aprobación; INSERT de auditoría. La sesión, factor y AMR válidos del actor, y el factor del objetivo en una promoción, se bloquean en modo compartido durante la comprobación para impedir su eliminación concurrente antes del commit. El lock global serializa estas operaciones entre procesos y versiones de Next, a costa de escalabilidad. No es un mutex de memoria ni un bloqueo compartido con HTTP. Los cruces con escrituras externas de Auth pueden producir espera, timeout o deadlock: deben probarse en QA y tratarse como resultado no confirmado con reintento idempotente, sin relajar la validación.

Una misma clave y contenido devuelve el resultado anterior solamente después de reautorizar al actor. Otra entrada con esa clave produce 409 `CLAVE_REUTILIZADA`. Otra clave con revisión/snapshot obsoletos produce 409 `VERSION_OBSOLETA`; la aprobación no se consume. Una repetición no duplica cambios ni el resultado auditado. El resultado idempotente describe el intento original; no sustituye una lectura actual si hubo cambios posteriores.

Si falla el INSERT de auditoría, la transacción revierte también Auth, revisión y consumo de aprobación. La función no atrapa esa excepción para afirmar éxito. Los rechazos de negocio se registran; una pérdida de autorización detectada dentro de SQL puede registrar el rechazo sin revelar el resultado anterior. Los 400/401/403 que se resuelven antes de llamar SQL no generan una auditoría remota por este endpoint; se distinguen de la auditoría de una transición autorizada.

La auditoría no tiene UPDATE/DELETE para el servicio y un trigger impide su edición ordinaria. Esto no impide que un propietario de la base altere triggers o borre tablas: no se declara inmutable frente al propietario. Del mismo modo, el protocolo no puede impedir escrituras privilegiadas externas por Dashboard, SQL o scripts Auth Admin. **Debe acordarse un único escritor para el namespace**; esas vías de mantenimiento requieren procedimiento y auditoría. La comparación del snapshot detecta divergencias de estado, pero no reconstruye cambios externos que luego vuelvan al mismo valor.

### 13.5. Archivos preparados

- `src/features/administracion/cambios-roles.ts`: contrato estricto, especificación de transiciones y API protegida.
- `src/features/administracion/escrituras-roles-supabase.ts`: puerto RPC exclusivo del servidor, validación de respuestas y reintentos SDK desactivados.
- `src/features/administracion/servidor-cambios-roles.ts`: ensamblado con DI-150, claims verificados y bandera cerrada.
- `src/app/api/administracion/roles/route.ts`: GET/POST; no altera la API sintética de propuestas.
- `src/features/autorizacion/autorizacion.ts`: solo nueva acción explícita.
- `src/features/administracion/CambioRolesLocal.tsx` y `src/app/desarrollo/roles-admin/page.tsx`: QA local mediante SDK normal, consentimiento para enviar, conservación del intento para reintento; 404 fuera de desarrollo. No copia tokens al chat ni al almacenamiento propio. No sustituye la interfaz final de DI-152.
- `src/features/administracion/cambios-roles.test.mjs` y `escrituras-roles-supabase.test.mjs`: pruebas aisladas de contrato, API, guard y SDK interceptado.
- `supabase/migrations/20261103012414_di151_roles_auditoria_atomica.sql`: migración generada por CLI y completada localmente, **sin aplicar**. La marca del nombre es UTC; fecha de trabajo 02/11/2026 Lima.
- `supabase/tests/fixtures-auth-local.sql`, `di151-roles.sql`, `di151-concurrencia-preparar.sql`: fixtures desechables y pruebas SQL preparadas, no ejecutadas. La fixture aborta si ya existe `auth.users`.
- `scripts/test-roles-postgres-local.ps1`: ejecutor futuro en contenedor sin puertos/red ni credenciales de la aplicación, con dos sesiones SQL para concurrencia. No acepta URL remota y exige confirmación explícita del carácter desechable.

### 13.6. Resultados ejecutados y pendientes

| Comprobación | Evidencia y alcance |
| --- | --- |
| Catálogo Supabase real | SELECT de nombres/tipos/privilegios/RLS; sin cambios de cuentas, roles o configuración. No verifica mutaciones. |
| Suite Node | **230 aprobadas**, 0 fallidas, 0 omitidas: 213 anteriores y 17 nuevas. Fixtures explícitos y SDK con fetch interceptado; ninguna escritura real. |
| Casos nuevos | Transiciones de paciente y administrativas con condiciones explícitas, cambios propios/superusuario sin aprobación/profesional sin verificar rechazados, último administrador, MFA del objetivo, guard AAL2, pérdida de rol entre solicitudes, origen/JSON/límite, revisión, reintento exacto, respuestas perdidas y errores/contratos mínimos del RPC. |
| Peticiones simultáneas en Node | Se comprueba que ambas llegan al puerto con su clave y versión. **No demuestra serialización, persistencia ni atomicidad PostgreSQL**. |
| SQL y PL/pgSQL | AST SQL analizado con pglast en herramienta temporal, sin instalar dependencias en el proyecto. PL/pgSQL analizado con nombres de esquema y declaraciones compuestas normalizados a records por limitaciones del parser. Es sintaxis, no resolución de objetos, permisos ni ejecución. |
| Script PowerShell | Análisis sintáctico sin errores; no se ejecutó. |
| TypeScript / build / diff | Aprobados tras ampliar las transiciones administrativas aprobadas; suite de 230 repetida, 0 fallos. |
| HTTP contra producción local | GET/POST de roles sin sesión: 401; vista de QA: 404. `/`, `/cuenta`, `/directorio`, `/solicitudes`, `/fotografias`: 200. Esto valida HTML y barreras del servidor, no repite todas las operaciones autenticadas de cada módulo. |
| Aislamiento de configuración | Bandera de escritura apagada y credencial de escritura ausente. Credencial de lectura real y nombre de la variable privada de escritura sin coincidencias en 47 archivos públicos del build. No se imprime ningún valor. |
| PostgreSQL: persistencia, rollback de auditoría, concurrencia e idempotencia | **NO EJECUTADO**. Docker no tiene daemon disponible; además no se aplican migraciones en esta etapa. Pruebas listas para aprobación/entorno desechable. |
| Supabase real: escritura, auditoría, lectura posterior, recencia TOTP y permisos del RPC | **NO EJECUTADO**, sin bandera ni credencial de escritura activadas, sin aprobaciones provisionadas. |

Los resultados reales de lectura de la sección 12 se conservan como evidencia histórica; no se presentan como escrituras exitosas ni se sustituyen por fixtures. Logs de pruebas y build: `%TEMP%/DentaIA-DI151-roles-pruebas.tap` y `%TEMP%/DentaIA-DI151-roles-build.log`.

Evidencia HTTP saneada: `%TEMP%/DentaIA-DI151-roles-http.json`. La comparación SHA-256 de todos los archivos locales previos confirma que ninguno desapareció y que solo se editaron intencionalmente este documento, el anexo de contrato y la lista cerrada de acciones de autorización. Los restantes cambios locales se conservaron byte a byte. No se modificaron dependencias, workflows, `.env.local` ni módulos de otros integrantes. El servidor de desarrollo se reinició después de finalizar el build, sin compilar sobre una instancia de desarrollo activa.

### 13.7. Protocolo posterior de validación controlada (no ejecutado)

1. Revisar y aprobar primero el mecanismo SQL sobre el campo Auth, la ventana TOTP, los permisos, las transiciones permitidas y el procedimiento independiente de aprobaciones. No activar variables como sustituto de esta aprobación.
2. Con Docker disponible y autorización para ejecutar DDL **solo en una base desechable**, desde PowerShell en el repositorio ejecutar:

   ```powershell
   .\scripts\test-roles-postgres-local.ps1 -ConfirmarBaseDesechable
   ```

   El script crea un contenedor PostgreSQL 17 sin puertos publicados, instala la fixture Auth mínima y la migración exclusivamente allí; prueba persistencia, metadatos conservados, idempotencia, promoción/revocación aprobadas, rechazos y fallo de auditoría con rollback/reintento. Dos conexiones prueban una aceptación/otra revisión obsoleta, una clave duplicada sin doble auditoría y revocaciones administrativas mutuas: una aceptación y otro actor ya sin autorización. El contenedor se retira verificando su etiqueta propia. No usa `.env.local`. Esto sigue siendo **PostgreSQL con esquema Auth simulado**, no Supabase real. No ejecutar los SQL de fixture en Dental-IA.
3. Revisar resultados y resolver fallos antes de solicitar aprobación para una instancia Supabase de pruebas. La aplicación remota de la migración es un paso aparte que debe autorizar el propietario; no se proporciona aquí un comando que apunte automáticamente a producción.
4. En esa instancia autorizada, confirmar compatibilidad real de funciones con Auth, propietarios/GRANT/RLS, factor/sesión/AMR y que anon/authenticated no ejecutan el RPC. Usar exclusivamente actor, aprobador y objetivo ficticios previamente autorizados; no crear ni elevar cuentas como parte automática del ensayo.
5. El propietario debe provisionar en la tabla privada una aprobación con los UUID controlados de actor, objetivo y aprobador distinto, operación/rol exactos, revisión y asignación del GET, y caducidad. No pegar secretos ni datos de personas en este documento. El servicio de aplicación no tiene permiso para crear esa aprobación. Su provisión y propósito deben quedar registrados por el procedimiento del propietario.
6. Solo después de esa aprobación, configurar la bandera y la credencial de escritura en el servidor de pruebas. Confirmar que no aparecen en HTML, bundles, logs o respuestas; nunca usar `NEXT_PUBLIC_*` para el secreto. El proyecto real y la configuración de lectura no se cambian automáticamente.
7. El titular inicia sesión y completa un desafío TOTP reciente en `/desarrollo/mfa-admin`. Abre `/desarrollo/roles-admin`, introduce el UUID autorizado, consulta revisión/asignación y aporta el UUID de aprobación. Marca la confirmación y envía la transición aprobada. La sesión se transporta por el SDK normal, sin copiar JWT.
8. Exigir 200 `aplicado` o `sin_cambios`, inspeccionar una sola auditoría mínima, la revisión y los metadatos preservados, y consultar de nuevo el estado y Auth. El 200 del endpoint por sí solo no completa la validación. Ante 503 de estado desconocido, conservar exactamente clave/cuerpo y reintentar; si caduca AAL2/recencia, verificar personalmente MFA y repetir esa misma solicitud. No generar otra clave para resolver un resultado ambiguo.
9. En QA aislado, comprobar rechazo de cambios propios, cambios administrativos sin aprobación independiente, concesiones profesionales sin verificar, aprobaciones caducadas o de otro objetivo, snapshot/revisión obsoletos, rol retirado, sesión expirada/AAL1 y RPC directo desde cliente. Confirmar ausencia de cambios. Validar separadamente una promoción/revocación administrativa expresamente aprobada, con MFA del objetivo cuando corresponda. Ejecutar concurrentemente desde dos sesiones de prueba autorizadas y contrastar auditoría/revisión. La suite SQL preparada no sustituye este recorrido Supabase real.
10. La restauración del rol de la cuenta ficticia exige **otra aprobación independiente** y snapshot/revisión actuales; no se borra evidencia ni se reutiliza la aprobación consumida. Desactivar la bandera al terminar. No retirar MFA ni alterar datos de otras personas.

### 13.8. Criterio para cerrar esta subtarea

Pendientes obligatorios de DI-151: aprobar esta arquitectura o implementar una alternativa equivalente; ejecutar y corregir las pruebas PostgreSQL; validar en Supabase real las escrituras autorizadas, lectura posterior, auditoría atómica, reintentos, recencia y concurrencia; acordar el procedimiento de aprobación y escritor único; contrastar el alcance de las transiciones con los criterios originales de Jira. Las operaciones de superusuario tienen código propuesto pero no aceptación real; la concesión profesional sigue bloqueada por verificación/vínculo pendientes. Ninguna de estas limitaciones se traslada como cumplida a DI-152.

DI-152 conserva integración visual final y sus estados; DI-153 consolida regresión y evidencias, sin sustituir las garantías de escritura exigidas a DI-151. No se cambia Jira. **DI-151 y su Parte 2 siguen abiertas. No hay commit, push ni merge.**

## 14. Revisión final para el registro de DI-151 Parte 2

Fecha de trabajo: 02/11/2026, America/Lima. El responsable confirmó que terminó la validación y autorizó registrar todos los cambios de la Parte 2 en un único commit y publicarlo en `origin/feature/superusuario-admin`. Esa confirmación se registra como declaración del responsable: esta revisión no ejecuta nuevas escrituras o migraciones remotas ni inventa resultados adicionales de integración. El historial de las secciones 1–13 permanece como evidencia de lo comprobado en cada etapa. No se crea una parte adicional ni se marca Jira automáticamente como Listo.

### Comprobaciones repetidas antes del commit

- Suite Node completa: **231 pruebas aprobadas, 0 fallidas y 0 omitidas**. Se añade una regresión para la configuración privada del objetivo de la utilidad de aprovisionamiento. Los tests con fixtures continúan identificados como tales y no se presentan como nuevas operaciones reales.
- TypeScript y `git diff --check`: correctos. Build de producción repetido antes de registrar los cambios; resultado en el registro temporal indicado al final.
- Rama de origen y destino remoto: `feature/superusuario-admin`. Identidad Git local del responsable comprobada. No se modifica `main`, no se crea PR y no se reescribe el historial anterior.
- Inspección de los 51 archivos pendientes: sin archivos `.env`, tokens JWT, claves Supabase, claves privadas, conexiones PostgreSQL con contraseña, correos de usuarios ni valores privados existentes en la configuración local. Las variables de configuración se mencionan por nombre, nunca por su valor.
- Migración y fixtures: el SQL versionable no contiene identidades reales; la fixture usa UUID y datos sintéticos y se niega a inicializar una base donde ya exista `auth.users`. El ejecutor solo crea su contenedor desechable, sin URL remota ni credenciales de la aplicación. Análisis sintáctico de PowerShell correcto. No se aplicó la migración como parte de esta revisión.

### Corrección de privacidad para versionar la utilidad puntual

Se retiró el UUID real fijado anteriormente en `scripts/asignar-superusuario.mjs` y su referencia en una aserción. El UUID exportado para fixtures es ahora inequívocamente sintético. La CLI exige `DENTAIA_BOOTSTRAP_USER_ID` desde configuración privada antes de consultar cualquier cuenta; lo liga a la ejecución, vuelve a verificar identidad y metadatos, restringe su transporte a ese objetivo y conserva la confirmación interactiva explícita. No imprime el identificador ni lo incluye en el resumen público.

El propietario debe configurar esa variable localmente para un eventual uso autorizado de la herramienta; su valor no se añade a esta documentación ni a Git. No se ejecutó el script con servicios reales. Es una utilidad excepcional del propietario, no el flujo administrativo ordinario con aprobación y auditoría transaccional; no debe usarse para eludir ese flujo.

### Alcance del cierre y evidencias

La publicación registra el desarrollo de la Parte 2 y la confirmación de validación del responsable. No equivale a desplegar la migración, activar escrituras en producción, habilitar permisos clínicos ni resolver por sí sola la verificación profesional pendiente para conceder `odontologo`. Las limitaciones arquitectónicas, el protocolo seguro de aprobación y los resultados históricos siguen disponibles para revisión. No se atribuye a esta ejecución una prueba SQL o remota que no se haya repetido.

Evidencias locales sin datos de cuentas ni credenciales: `%TEMP%/DentaIA-DI151-parte2-final-pruebas.tap` y `%TEMP%/DentaIA-DI151-parte2-final-build.log`. Los archivos de entorno, los informes locales y las cachés de herramientas no se incluyen en el commit.
