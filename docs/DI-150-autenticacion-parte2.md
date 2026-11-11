# DI-150 — Autenticación y autorización, parte 2

- Historia: DI-144. Rama exclusiva: `feature/superusuario-admin`.
- Fecha del trabajo solicitada: 01/11/2026. Ejecución y verificación en este entorno: 02/11/2026 UTC.
- Base revisada: `9d4409a12481416867a30483d8df6213156ecf28`; contiene DI-148 y ambas partes de DI-149. HEAD local/remoto coincidían antes de trabajar.
- **Estado: implementación técnica ampliada y verificada localmente, pendiente de validaciones reales esenciales. DI-150 no se declara Listo.** Registro como commit independiente y publicación en esta rama autorizados por el usuario; sin merge ni Pull Request.

## 1. Arquitectura y decisiones

Se conservan [la matriz DI-148](DI-148-matriz-roles-permisos.md) y la base de [la parte 1](DI-150-autenticacion-parte1.md). No se vuelve a implementar el login ni se crean sesiones adicionales. El transporte sigue siendo el access token de Supabase Auth en `Authorization: Bearer`, por HTTPS en un despliegue real; el servidor no acepta sesión por cookies, query, perfil, email o encabezados de rol. El contexto de paciente y los módulos existentes no se modifican.

En cada solicitud administrativa:

1. Se valida el bearer y se crea un adaptador aislado con clave **publicable**, sin persistencia, refresh, SQL, Storage ni Auth Admin. El código de integración está protegido con `server-only`.
2. `auth.getUser(token)` verifica la identidad contra Auth y obtiene la asignación actual en `app_metadata.dentaia`. No se usa `getSession`, ni el rol de un JWT decodificado, ni `user_metadata` como autoridad. Se conservan confirmación, audiencia, anonimato, eliminación y suspensión de cuenta cuando Auth la informa.
3. Se exige el contrato `version: 1`, `estado: "activo"` y el rol `superusuario`. Ausencia, revocación, suspensión o metadatos incompletos/desconocidos deniegan acceso. El rol administrativo no hereda permisos clínicos.
4. **Nuevo control de servidor:** `auth.getClaims(token)` verifica firma y caducidad mediante el SDK. Se exige que el sujeto coincida con la identidad anterior, rol técnico `authenticated`, expiración vigente, identificador de sesión presente y `aal === "aal2"`. También debe existir un factor verificado en la respuesta actual de Auth. Un factor enrolado por sí solo no demuestra una sesión MFA.
5. **Nuevo contrato de ejecución:** el servicio se invoca únicamente después de autorizar. No se construye su respuesta privada antes de ese punto. Los fallos devuelven mensajes mínimos; los errores del servicio no revelan excepciones. Todas las respuestas del contrato imponen `private, no-store`, `CDN-Cache-Control: no-store` y `Vary: Authorization`.

No se cachean identidades ni asignaciones. El SDK puede cachear claves **públicas** de firma/JWKS para `getClaims`; eso no reemplaza la consulta fresca de roles mediante `getUser`. La revocación de roles no depende del refresco de los claims del token.

`GET /api/administracion/acceso` conserva su respuesta mínima `{"autorizado":true}` y ahora exige también la comprobación AAL2. No devuelve identidad, roles, tokens ni contenido clínico. Se mantienen 401 para autenticación inválida, 403 para autorización insuficiente y 503 para indisponibilidad; los fallos internos del servicio se convierten en 500 genérico. Los métodos de escritura de esta ruta siguen rechazados por Next con 405. El panel DI-149 conserva su restricción de desarrollo.

### MFA: alcance exacto

Está implementado y probado localmente el **control de AAL2 en el servidor**. No se ha configurado, enrolado ni validado MFA de extremo a extremo con una cuenta real; por tanto **MFA no se declara habilitado ni aceptado para producción**. No se modifican login, sesiones personales o configuración remota. Sin una sesión AAL2 y un factor verificado, incluso una cuenta con rol administrativo queda denegada.

El propietario debe verificar que el proyecto permita enrolamiento/challenge/verificación TOTP u otro factor admitido, y proporcionar un flujo autorizado de enrolamiento, challenge, recuperación y retirada de factores. `aal2` acredita la garantía del token; no demuestra reautenticación reciente para cada operación. El control de recencia y las políticas de operaciones sensibles deben definirse antes de habilitar gestión real.

Se contrastaron las referencias actuales de [getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims) y [MFA](https://supabase.com/docs/guides/auth/auth-mfa) mediante el conector, y el SDK instalado (`@supabase/supabase-js@2.118.0`). La consulta directa al changelog devolvió HTTP 403; no se afirma haberlo revisado. No se añaden dependencias ni migraciones.

## 2. Procedimiento restringido de aprovisionamiento (documentado, NO ejecutado)

No hay un formulario, script automático de bootstrap o endpoint de asignación en esta entrega. Los siguientes pasos requieren intervención del propietario fuera de la aplicación:

1. Confirmar el proyecto y la identidad **preexistente** mediante su UUID de Auth y un procedimiento independiente de identificación. No confiar en un ID/email enviado por el solicitante como aprobación. Exigir aprobación independiente del operador; no autoaprobar cambios de privilegios. Verificar confirmación de identidad y acordar enrolamiento MFA antes de habilitar acceso.
2. Usar exclusivamente la API **Auth Admin** (`auth.admin.updateUserById`) desde un entorno operativo restringido, o una herramienta administrativa de Supabase que edite expresamente `app_metadata`. Una clave privilegiada se obtiene del gestor de secretos del entorno, nunca del navegador, de variables `NEXT_PUBLIC_*`, del repositorio ni de un formulario. La aplicación sigue sin disponer de esa clave. No utilizar el script de cuentas de prueba para crear un superusuario.
3. Leer los metadatos actuales en ese entorno restringido y conservar las claves ajenas a `dentaia` y los roles de negocio ya aprobados. Para la asignación administrativa, establecer el namespace revisado:

   ```json
   {"dentaia":{"version":1,"estado":"activo","roles":["superusuario"]}}
   ```

   Es solo un ejemplo de estructura, sin identidad real. **No copiarlo en `user_metadata`, `signUp.options.data`, `profiles` o claims manipulables.** La actualización se enviaría como `app_metadata` de Auth Admin, no como datos de perfil. Trabajar con un solo operador y cambios serializados: esta API no aporta por sí sola aprobación/auditoría transaccional ni comparación atómica de versiones. No escribir una copia antigua completa de todos los metadatos.
4. Registrar fuera del repositorio la aprobación, operador, UUID objetivo, motivo, fecha y cambio de asignación, sin contraseñas, claves, access tokens o información clínica. Releer y comprobar el resultado. Verificar que existe un procedimiento de recuperación y que no se pierde al último administrador operativo. No automatizar promociones concurrentes sin resolver estas garantías.
5. Con una identidad de prueba autorizada, comprobar el endpoint con su sesión real AAL2; comprobar también que un paciente y un odontólogo sin rol son rechazados. Nunca poner tokens en URLs, capturas, logs o argumentos registrados por herramientas de diagnóstico. Estas pruebas reales **no se ejecutaron** aquí.

Este procedimiento prepara el uso controlado de Auth Admin; no implementa la gestión de roles de DI-152, ni inventa una tabla administrativa existente.

## 3. Revocación de rol, suspensión y sesión

- **Revocar privilegio administrativo:** mediante el mismo procedimiento restringido, retirar `superusuario` de los roles conservando los demás. Si no queda ninguna asignación de este namespace, retirar `dentaia` por completo. La lectura fresca debe denegar la siguiente comprobación, aunque el bearer conserve claims antiguos. Los usos personales de la cuenta no cambian por retirar el rol administrativo.
- **Suspender administración:** establecer `app_metadata.dentaia.estado` en `"suspendido"` conservando la asignación para su revisión posterior. El parser ya exige `"activo"`, por lo que deniega mientras esté suspendida. Se prueba esta semántica, sin afirmar haber suspendido una cuenta remota.
- **Invalidar sesión:** cerrar/revocar sesiones o bloquear una cuenta en Auth es un control distinto. Revocar refresh tokens no acredita que todos los access tokens emitidos queden inutilizables inmediatamente. `session_id` presente **no es** una consulta a `auth.sessions`. Esta entrega no implementa ni certifica invalidación inmediata de sesiones globales en el despliegue.
- Ante compromiso administrativo, retirar/suspender primero la asignación y después aplicar el procedimiento de sesiones de Auth, verificando el resultado con tokens previos en un entorno autorizado. No depender únicamente de cerrar el navegador. Los factores MFA y sus recuperaciones requieren revisión independiente.

Las pruebas con fixtures distinguen 403 por rol revocado/suspendido de 401 por sesión rechazada. Una autorización ya comprobada es una instantánea: una retirada posterior no cancela una operación que ya está en curso. DI-151/DI-152 deberán resolver carreras, autorización por acción, transacciones y auditoría antes de ejecutar mutaciones. No se afirma garantía transaccional mediante `app_metadata`.

## 4. Contrato para DI-151/DI-152

`conAccesoAdministrativo(request, accion, operacion)` en `src/features/autorizacion/servidor.ts` liga el adaptador real al núcleo comprobable. `operacion` es un callback perezoso que recibe un contexto inmutable mínimo (`usuarioId`, `accion`), solo después de verificar identidad, rol y AAL2. La comprobación se repite para cada petición; no se debe almacenar el contexto ni tratar el booleano del navegador como permiso.

La lista de acciones es cerrada: **solo `comprobar_acceso`**. Acciones no registradas —incluidas gestión de usuarios, roles y cualquier acción clínica— se deniegan aun con superusuario AAL2. El endpoint existente consume este mismo núcleo mediante `responderComprobacionAdministrativa`. No se añaden rutas ni operaciones de DI-151/DI-152.

Para integrar futuras operaciones se deberá añadir una acción específica y revisada, pasar el servicio sin iniciarlo de antemano y validar de nuevo objetivo, campos y permiso específico dentro de la operación. No etiquetar una escritura como `comprobar_acceso`. El helper no sustituye validación del cuerpo, RLS, reglas de último administrador, MFA/reauth reciente, aprobación o auditoría atómica. No contiene cliente privilegiado ni concede acceso a fotografías o historiales. El guard anterior `exigirAccesoAdministrativo` se conserva; quien lo utilice debe inspeccionar explícitamente su resultado discriminado antes de acceder a datos.

## 5. Verificaciones ejecutadas

| Evidencia | Resultado y límite |
| --- | --- |
| Rama y base | Rama correcta, árbol limpio inicial; commit de parte 1 presente y HEAD local/remoto coincidentes. |
| `npm run typecheck` | Aprobado. |
| `npm run build` | Aprobado con Next.js 15.5.28. |
| `node --experimental-strip-types --test --test-reporter=tap 'src/features/**/*.test.mjs'` | **119 aprobadas, 0 fallidas, 0 omitidas**: 104 anteriores (fixtures positivos actualizados para AAL2) y 15 nuevas. |
| Fixtures de autorización/servicio | Sin sesión, token/sesión rechazado, paciente/odontólogo sin rol, rol válido, autoasignación, rol retirado/suspendido, metadatos manipulados, fallos de Auth, claims caducados/incompletos, AAL1, AAL2, factor retirado, sujeto distinto y acciones desconocidas. Ningún servicio privado se invoca antes de resolver la autorización ni tras denegación. |
| SDK real con fetch interceptado | Cliente y `getClaims` reales verifican JWT ES256 con clave generada únicamente en memoria: acepta la prueba AAL2 y rechaza modificación sin firma, caducidad y sujeto distinto. También verifica rol suspendido y factor retirado. **No es Supabase remoto ni un enrolamiento real.** No se persisten claves. |
| HTTP, build de producción local | `GET /api/administracion/acceso`: 401 sin bearer, con Basic o token sintético inválido; rol/AAL en URL/cookies/headers no concede acceso. Respuesta mínima sin caché. |
| HTTP, métodos no habilitados | POST/PUT/PATCH/DELETE sobre `/api/administracion/acceso`: 405. |
| HTTP, panel y rutas no habilitadas | `/desarrollo/panel-admin`, `?demo=1`, `/admin`, `/api/admin`, `/api/administracion/usuarios`: 404. |
| Rutas existentes | `/`, `/privacidad`, `/analisis/demo`, `/cuenta`, `/directorio`, `/solicitudes`, `/fotografias`: HTTP 200 al solicitar HTML. No se repiten operaciones privadas contra datos reales. |
| Dependencias | `package.json`/lockfile coherentes y sin cambios; `npm ls --depth=0` confirma las versiones declaradas. Los paquetes auxiliares extraneous del entorno no se incorporan al proyecto. No es una auditoría de vulnerabilidades. |
| `git diff --check` | Sin errores. |

La comprobación HTTP utilizó `NODE_USE_ENV_PROXY=1 npm run start -- --hostname 127.0.0.1 --port 3022` para respetar el proxy del entorno. El bearer inválido es sintético y no identifica a una persona. Solo ese rechazo utiliza el servicio Auth real; no se usan sesiones reales de pacientes, odontólogos o administradores. Los resultados positivos, 403 de roles/MFA y revocación/suspensión son pruebas aisladas con fixtures. No se consultan filas clínicas, se asignan roles ni se alteran políticas/configuración remotas. La inspección de RLS de parte 1 es evidencia histórica y no se presenta como una auditoría repetida en esta entrega.

## 6. Criterios y bloqueos de cierre

| Criterio | Estado |
| --- | --- |
| Reutilizar Auth; identidad en servidor y rol fuera del control del usuario | Implementado; conserva la base y añade comprobación de claims firmados. |
| Denegación por defecto y ninguna respuesta privada antes de autorizar | Implementado y probado con servicios sintéticos, HTTP negativo y acciones cerradas. |
| Revocación/suspensión de la asignación sin caché de roles | Implementado y probado con fixtures; falta verificación de propagación en Auth real. |
| Aprovisionamiento seguro y revocación restringida | Procedimiento documentado; pendiente de aprobación operativa y ejecución controlada fuera de esta entrega. |
| MFA | Control de AAL2/factor verificado implementado y probado localmente. Configuración, enrolamiento, recuperación y aceptación MFA reales pendientes. **No se declara MFA completo.** |
| Invalidación inmediata de sesiones previas | No certificada. Requiere pruebas reales y decidir si se necesita comprobación adicional de sesión antes de operaciones sensibles. |
| Contrato reutilizable y separación clínica | Preparado; no habilita gestión de usuarios/roles ni permisos clínicos. |
| Sin regresiones observadas en el alcance probado | TypeScript/build/suite y rutas revisadas aprobados; no acredita todos los flujos privados productivos. |
| Cierre de DI-150 | **Pendiente:** aceptación real de paciente/odontólogo/admin AAL2, rol retirado/suspendido, sesiones caducadas/cerradas y políticas efectivas. No se dispone de identidades de prueba autorizadas ni permiso para aprovisionarlas/modificarlas en esta tarea. |

No se puede declarar «Listo» a partir de fixtures o del HTTP 200 de páginas públicas. El bloqueo real es disponer de un entorno y cuentas controladas con autorización para enrolar MFA, asignar/retirar roles y verificar sesiones sin tocar datos reales. No se requiere una clave privilegiada en la aplicación para resolverlo. El panel permanece limitado a desarrollo hasta su integración segura; la gestión de cuentas, auditoría y reglas de asignación de DI-151/DI-152 siguen fuera de esta entrega.

## 7. Archivos y registro del avance

Modificados: `src/features/autorizacion/autorizacion.ts`, `src/features/autorizacion/servidor.ts`, `src/lib/supabase/server.ts`, `src/features/autorizacion/autorizacion.test.mjs`, `src/features/autorizacion/servidor.test.mjs`.

Nuevos: `src/features/autorizacion/controles.test.mjs` y este documento. No se modifican los módulos de cuenta, directorio, solicitudes, fotografías, panel DI-149, cliente Supabase de navegador, modelos, dependencias o rutas existentes.

Mensaje autorizado para registrar únicamente la segunda parte:

```text
DI-150 feat(auth): reforzar acceso administrativo y verificación AAL2
```

## 8. Revalidación antes del registro

Se repitieron `npm run typecheck`, `npm run build`, la suite completa de Node y `git diff --check`: aprobados, con **119 pruebas correctas, 0 fallidas y 0 omitidas**. Se revisaron los siete archivos de esta entrega: alcance exclusivo de DI-150, sin secretos, datos clínicos personales, archivos de entorno ni temporales. No se modifican dependencias, el panel de diseño u otras funcionalidades.

Se mantiene denegación por defecto, comprobación de identidad y claims en servidor, asignación actual leída desde `app_metadata.dentaia` de Auth y ejecución del servicio únicamente tras autorizar. Los datos editables del usuario no conceden roles ni AAL2. Las pruebas positivas, de retirada/suspensión y del control AAL2 usan fixtures y claves de firma efímeras locales; **no certifican MFA ni revocación real en Supabase**.

Durante este registro no se repitieron las comprobaciones HTTP de la implementación ni se realizaron consultas o cambios remotos en Supabase. Los resultados HTTP y sus límites de la sección 5 corresponden a la implementación anterior. No se crearon cuentas ni se asignaron privilegios. Los criterios esenciales pendientes de la sección 6 permanecen abiertos después de publicar este avance.
