# DI-150 — Autenticación y autorización, parte 1

- Historia: DI-144. Rama: `feature/superusuario-admin`.
- Fecha de trabajo solicitada: 31/10/2026. Verificación en este entorno: 01/11/2026 (UTC).
- Fecha final prevista de DI-150: 01/11/2026. **Esta entrega es solo la parte 1; DI-150 no se declara completa.**
- Base: `12d54fb9f77109ec354c2b74e3dae72276740353`, que contiene DI-148 (`f6221d9`) y ambas partes de DI-149 (`3576c13`, `12d54fb`). Registro del avance como commit independiente y publicación en esta rama autorizados por el usuario.

## Arquitectura y código funcional

Se reutiliza Supabase Auth 2.118.0 y el login existente. La aplicación mantiene sesiones en el navegador; no hay transporte de cookies SSR. Se elige `Authorization: Bearer <access_token>` por petición HTTPS, compatible con el token de la sesión actual. No se crea login, contraseña, emisor de tokens o sesión administrativa adicional. No se modifica `Cuenta`, `useSesion` ni el cliente de navegador.

El nuevo `GET /api/administracion/acceso` valida en servidor mediante `auth.getUser(token)` y devuelve únicamente `{"autorizado":true}` si se cumplen todas las condiciones. Sin identidad válida: 401; identidad sin autorización: 403; fallo de configuración/red/proveedor: 503. Las respuestas privadas llevan `no-store`, también para CDN, y `Vary: Authorization`. No hay mutaciones ni listado de usuarios. Next rechaza POST con 405.

El cliente de servidor se instancia por petición, usa exclusivamente la URL y clave **publicable** existentes, no persiste sesión ni la refresca y deshabilita detección de sesión en URL. Su fetch utiliza `no-store` y un límite de 8 segundos por intento de red. Solo expone `auth.getUser`, sin acceso a tablas, Storage o Auth Admin. Los adaptadores están protegidos por `server-only@0.0.1`, única dependencia añadida y fijada en lockfile. El núcleo separado permite pruebas sin sustituir el adaptador de producción.

### Fuente canónica de la asignación

Los roles tipados son `visitante`, `paciente`, `odontologo` y `superusuario`; no hay herencia clínica. Visitante no es una asignación persistida. Las cuentas ordinarias conservan sus funciones personales actuales sin exigirles un rol nuevo.

Para esta parte se utiliza el almacenamiento existente `auth.users.raw_app_meta_data`, recibido como `user.app_metadata` desde **la respuesta fresca de Auth**, con contrato específico:

```json
{"dentaia":{"version":1,"estado":"activo","roles":["superusuario"]}}
```

Es un ejemplo de estructura, **no una asignación aplicada**. No se presupone que exista en ninguna cuenta. Falta de namespace, versión/estado incorrectos, array vacío o roles desconocidos deniegan acceso. También se exige identidad confirmada, audiencia `authenticated`, cuenta no anónima ni eliminada y ausencia de suspensión vigente cuando Auth informa `banned_until`.

Se elige este mecanismo compatible con Auth frente a crear ahora la tabla privada propuesta como ejemplo en DI-148: reduce cambios de infraestructura y evita introducir un cliente privilegiado en la aplicación. No requiere migraciones nuevas ni políticas nuevas. No se modifica `profiles`, que solo contiene `id`, `full_name` y `created_at`. No se toma autoridad de `user_metadata`, JWT decodificado, email, ficha de directorio, perfil, cookies, cuerpo, query o encabezados de rol. Copiar el ejemplo a `signUp.options.data` o `updateUser.data` no concede permisos.

Solo el propietario o un proceso de infraestructura restringido podrá aprovisionar/revocar `app_metadata` mediante mecanismos administrativos de Supabase, con aprobación y evidencia. **Esta entrega no implementa ni ejecuta ese proceso**, ni crea cuentas, claves o asignaciones. No hay endpoint de autoasignación. La aplicación no usa `service_role`. La lectura fresca permite observar cambios de asignación sin confiar en claims de rol antiguos; su comportamiento se probó con proveedor simulado, no mediante cambios de roles remotos.

El guard de servidor devuelve una unión discriminada: cada consumidor futuro debe comprobar `autorizado === true` antes de operar. El resultado del endpoint o el estado del navegador nunca sustituyen esa nueva comprobación. Esta base verifica acceso; no habilita por sí misma operaciones sensibles sin MFA, auditoría y permisos específicos.

## Revisión existente, RLS y dependencias

Se revisaron [DI-148](DI-148-matriz-roles-permisos.md), el cliente, sesiones, perfiles, tipos, rutas, contratos de solicitudes y fotografías. No se encontraron documentos o implementaciones identificados como DI-145/DI-146 en esta rama. Para DI-145 permanece pendiente el vínculo entre identidad profesional, `dentists` y membresías clínicas; una ficha pública no otorga acceso profesional. Para DI-146 se conserva el perfil y las operaciones personales existentes, autorizadas por propietario. No se cambian módulos de Anelis, Angie o Stephan.

Se inspeccionó el catálogo del proyecto Dental-IA mediante consultas **SELECT de solo metadatos**, sin leer filas de usuarios o información clínica y sin ejecutar DDL/DML:

- RLS habilitado en `profiles`, `dentists`, `appointment_requests`, `patient_consents`, `dental_photos` y `storage.objects`.
- Políticas observadas: perfiles por `auth.uid() = id`; solicitudes, consentimientos y metadatos de fotos por propietario; profesionales públicos activos; Storage restringido al bucket y carpeta del propietario, con consentimiento vigente en la subida. Ninguna política observada concede un bypass por superusuario.
- No se observaron triggers personalizados en `auth.users`/`public.profiles`, GRANT directos de INSERT/UPDATE/DELETE sobre `auth.users` a `anon`, `authenticated` o `PUBLIC`, ni funciones en `public` que mencionen `app_metadata`/`raw_app_meta_data`.

Esto acredita configuración observada, **no una auditoría completa** de privilegios efectivos, roles heredados, permisos de columnas, funciones en otros esquemas, hooks Auth o todas las rutas de escritura. No sustituye pruebas RLS con dos identidades reales, Storage ni auditoría de infraestructura. No se aplicó ninguna migración ni se modificaron usuarios, roles, políticas o datos remotos.

Documentación contrastada mediante el conector de Supabase: [RLS y diferencia entre metadatos](https://supabase.com/docs/guides/database/postgres/row-level-security) y [gestión de usuarios](https://supabase.com/docs/guides/auth/managing-user-data). También se revisó la implementación instalada de `getUser(jwt)`: llama al endpoint Auth `/user`. La consulta directa al changelog devolvió HTTP 403 por la política de red; no se afirma haberlo verificado.

## Verificaciones y resultados reales

| Comprobación | Resultado |
| --- | --- |
| Rama, historial y remoto leído | `feature/superusuario-admin`; HEAD local/remoto coincide con `12d54fb` antes de trabajar. |
| `npm run typecheck` | Aprobado. |
| `npm run build` | Aprobado, Next.js 15.5.28; endpoint dinámico de servidor. |
| `node --experimental-strip-types --test --test-reporter=tap 'src/features/**/*.test.mjs'` | **104 aprobadas, 0 fallidas, 0 omitidas:** 89 existentes y 15 nuevas. |
| Casos nuevos con proveedor simulado | Sin sesión, bearer ambiguo/inválido, usuario inexistente, paciente/profesional sin privilegio, autoasignación vía `user_metadata`/petición, contrato inválido, cuenta inhabilitada, fuente confiable válida, revocación entre peticiones, errores del proveedor, caché, respuesta mínima y concurrencia. |
| Adaptador real con fetch interceptado | SDK llama `/auth/v1/user` con bearer y clave publicable de prueba, `no-store` y señal de timeout; instancias aisladas; superficie sin tablas/Admin. No se crea cuenta real. |
| Barrera de servidor | Importación ordinaria del adaptador rechazada por `server-only`; build válido en contexto de servidor. |
| HTTP contra `next start` | Sin bearer, esquema Basic o token sintético inválido: 401 con mensaje genérico y sin caché. Query/cookies/`X-Role` no conceden acceso. POST con autoasignación: 405. |
| Panel DI-149 en producción local | `/desarrollo/panel-admin`, `?demo=1`, `/admin` y `/api/admin`: 404. La vista de diseño sigue limitada a desarrollo. |
| Compatibilidad HTML | `/`, `/cuenta`, `/directorio`, `/solicitudes`, `/fotografias`: 200; no equivale a probar sus operaciones privadas reales. |
| Diff y alcance | `git diff --check` sin errores. Módulos existentes, autorización clínica y rutas del panel sin cambios. |

No se ejecutaron acceso positivo con superusuario real, paciente autenticado real contra el endpoint, modificación/autoascenso remoto, revocación de rol/sesión real, cuenta suspendida real o pruebas cruzadas de RLS. No se dispone de identidades controladas y asignaciones autorizadas para estos escenarios; la credencial de lectura de catálogo no equivale a una sesión de prueba ni autoriza crearlas. Los casos positivos y de roles anteriores usan fixtures sintéticos. Durante QA HTTP se corrigió únicamente la lectura de cabeceras del arnés para conservar su insensibilidad a mayúsculas.

## Pendientes para la segunda parte del 01/11

1. Acordar y documentar aprovisionamiento restringido del primer administrador, revocación, auditoría y responsable; comprobar el contrato de `app_metadata` en un entorno de prueba autorizado. Evaluar tabla privada si se requieren aprobación, concurrencia y auditoría transaccional; no improvisar ese flujo con metadatos editables.
2. Ejecutar escenarios Auth reales con identidades controladas, incluyendo sesión caducada/cerrada, rol revocado y suspensión. `getUser` verifica con Auth, pero esta entrega no certifica las garantías de revocación inmediata de todas las sesiones/JWT del despliegue.
3. Completar MFA/reauth, control de sesiones, limitación de peticiones y requisitos de operación antes de permitir acciones sensibles. No existen operaciones de gestión de cuentas o roles en esta parte.
4. Diseñar el consumo del bearer desde la sesión actual sin logs/URLs ni persistencia adicional. Si se requiere navegación SSR a un panel real, definir transporte de cookies y protecciones CSRF aparte; no basta con este endpoint. Conservar el bloqueo del panel DI-149 hasta completar su integración segura.
5. Completar auditoría de privilegios/hook Auth y pruebas RLS/Storage con identidades distintas. Coordinar DI-145/DI-146 y sus contratos sin inferir permisos profesionales o clínicos del rol administrativo.

No se implementan DI-151, DI-152 o DI-153. La autorización administrativa no incorpora lectura de fotografías, resultados, consentimientos, historiales o perfiles ajenos.

## Archivos y registro del avance

Nuevos: `src/lib/supabase/server.ts`, `src/features/autorizacion/autorizacion.ts`, `src/features/autorizacion/servidor.ts`, `src/features/autorizacion/autorizacion.test.mjs`, `src/features/autorizacion/servidor.test.mjs`, `src/app/api/administracion/acceso/route.ts` y este documento. Modificados: `package.json`, `package-lock.json` (solo `server-only@0.0.1`).

Mensaje autorizado para registrar exclusivamente la parte 1:

```text
DI-150 feat(auth): incorporar autorización de superusuario en servidor
```

## Revalidación previa al registro

Se repitieron TypeScript, build y la suite completa: aprobados, con **104 pruebas correctas, 0 fallidas y 0 omitidas**. Se revisaron los nueve archivos de DI-150, sin credenciales, datos personales ni temporales; `package.json` y el lockfile coinciden y solo incorporan `server-only@0.0.1`. No se modifican DI-151/DI-152, el panel DI-149, módulos personales, datos clínicos ni políticas remotas.

Cada petición con bearer consulta `auth.getUser(token)` y usa `app_metadata.dentaia` de su respuesta actual; no hay caché local de roles ni confianza en los metadatos incluidos en un JWT antiguo. La vigencia depende de que la asignación canónica en Auth sea correcta y se revoque mediante un procedimiento autorizado. Continúan pendientes la comprobación con identidades reales y las garantías de revocación de sesión del despliegue.

La repetición HTTP detectó que Node necesitaba habilitar el proxy heredado del entorno mediante `NODE_USE_ENV_PROXY=1`: sin esa opción Auth devolvía `AuthRetryableFetchError` con status 0 y el endpoint denegaba con 503. Con el proxy habilitado, el token sintético inválido fue rechazado por Auth con `bad_jwt` y el endpoint respondió **401**. Se confirmaron también 401 sin sesión o con roles solo en URL/cookies, POST 405 y panel de diseño 404. Es un ajuste del proceso de QA en este entorno, sin cambio del código ni de la verificación TLS. La denegación 403 y la revocación entre solicitudes se revalidaron en las pruebas con proveedor simulado; no se aprovisionaron cuentas reales.
