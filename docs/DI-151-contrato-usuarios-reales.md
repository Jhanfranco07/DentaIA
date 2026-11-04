# DI-151 — Contrato de usuarios reales y decisiones de persistencia

Estado: **implementación parcial; DI-151 no está Listo**. Rama `feature/superusuario-admin`, base `e6f6835`. Trabajo de Jhan. No hay cambios remotos, migraciones aplicadas, commits ni push en esta entrega.

Seguimiento: el [protocolo de validación real](DI-151-validacion-lectura-real.md) registra la revisión posterior, ajustes defensivos, 177 tests aislados y configuración local ausente. Las 169 pruebas de la sección 7 corresponden a la entrega anterior; no son aceptación con cuentas reales.

Actualización vigente: la [Parte 2, sección 8](DI-151-administracion-parte2.md#8-credencial-real-aceptada-y-preparación-legítima-de-mfa) registra las cinco comprobaciones de configuración correctas y la credencial privada aceptada por Auth Admin real, sin publicar identidades. La aceptación mediante sesión AAL2 sigue pendiente; se preparó un flujo MFA local con operaciones desactivadas. Este archivo es un anexo técnico de la Parte 2; DI-151 no tiene partes adicionales.

## 1. Alcance y dependencias comprobadas

Se revisaron las descripciones vigentes de [DI-151](https://jhanfranco.atlassian.net/browse/DI-151), [DI-34](https://jhanfranco.atlassian.net/browse/DI-34) y [DI-36](https://jhanfranco.atlassian.net/browse/DI-36), la [matriz DI-148](DI-148-matriz-roles-permisos.md), [DI-150 parte 2](DI-150-autenticacion-parte2.md) y las dos partes locales de DI-151.

- DI-151 exige **listado y actualización controlada de roles/perfiles**, entradas y errores. Una propuesta con `aplicado: false` no satisface una actualización persistida.
- DI-34 exige contratos y relaciones documentadas; DI-36, persistencia autorizada, esquema/migraciones y separación de pruebas reales/simuladas. Ambas historias siguen pendientes: este contrato es un aporte parcial, no su cierre ni una certificación del esquema remoto.
- DI-152 integra el panel con servicios reales; reutilizará la conexión de DI-151 parte 2. No es el destino de la funcionalidad de cambio de roles pendiente de DI-151.
- DI-153 consolida y completa pruebas unitarias, de integración y funcionales, incluida la persistencia real. Las pruebas añadidas durante DI-151 se reutilizan.
- Las referencias anteriores que trasladan la gestión completa de roles a DI-152 quedan corregidas por este documento. Se conservan sin reescribir los diez archivos locales de la parte 2 y sus evidencias históricas.

DI-150 sigue siendo la base de autorización: `getUser(token)` por petición, asignación vigente en `app_metadata.dentaia`, claims verificados, AAL2 y factor verificado. El cierre de Jira recoge validaciones manuales declaradas por el responsable; no se convierten aquí en ejecuciones nuevas.

## 2. Contrato de lectura implementado

Endpoint aditivo: `GET /api/administracion/usuarios/reales`. No sustituye la API sintética, no cambia la UI y no crea `/admin`.

La acción específica `usuarios.consultar_reales` pasa por el mismo guard de DI-150 antes de interpretar la consulta, construir el SDK privilegiado o leer datos. No se habilita ninguna acción de escritura. Respuestas privadas, sin caché compartida y con `Vary: Authorization`.

| Campo | Fuente y regla |
| --- | --- |
| `id` | UUID normalizado de Supabase Auth; clave para buscar `profiles.id`. No es un ID confiable enviado por el operador. |
| `perfil.estado` | `presente` si existe la fila consultada; `ausente` si no existe. No crea ni repara perfiles al leer. |
| `perfil.nombre` | `profiles.full_name`, máximo 120 caracteres; `null` si no hay fila. No usa correo ni `user_metadata` como nombre alternativo. |
| `cuenta` | Estado derivado de Auth: `habilitada`, `suspendida`, `sin_confirmar`, `anonima`, `eliminada`, `inconsistente`. No equivale a permiso administrativo. Fechas inválidas, audiencia inesperada o ausencia de `is_anonymous` se muestran como inconsistencia. |
| `asignacion.estado` | `activa`, `suspendida`, `ausente` o `invalida`, leído exclusivamente de `app_metadata.dentaia`. |
| `asignacion.roles` | Conjunto de `paciente`, `odontologo`, `superusuario`; versión 1 y estado `activo`/`suspendido`. Duplicados, roles desconocidos, lista vacía o estructura incorrecta son inválidos. Ausencia no implica paciente. |
| `origen` | `supabase`, identifica el proveedor implementado. Que una prueba lo invoque con transporte simulado no acredita una consulta real. |
| `consistencia` | `lectura_no_transaccional`. Auth y PostgreSQL no se leen como un snapshot compartido. |

No se devuelven correos, teléfonos, factores MFA, tokens, identidades, metadatos completos ni contenido clínico. Los tipos locales no demuestran la existencia de una FK ni las políticas efectivas; comprobar el vínculo Auth/perfil en el entorno autorizado sigue pendiente.

Consulta admitida:

- `q`: búsqueda por UUID o nombre, máximo 80 caracteres, sin distinguir acentos/mayúsculas.
- `rol`: `todos`, los tres roles, `sin_asignacion` o `asignacion_invalida`. Incluye asignaciones suspendidas cuando contienen el rol; el estado de asignación se devuelve separado.
- `estado`: `todos` o uno de los seis estados de cuenta, no el estado de la asignación.
- `pagina`: entero entre 1 y 1000; `tamano`: 5, 10 o 20. Campos desconocidos y parámetros duplicados se rechazan.

Se recorre Auth en lotes de 100 hasta el final y se consultan perfiles de esos IDs en lotes de hasta 100. Después se aplican filtros globales y orden por UUID; el total corresponde a las filas reunidas y filtradas, no al número de una sola página de Auth. Se requiere conteo exacto de perfiles para detectar truncamientos de PostgREST.

Límite deliberado: 2000 cuentas. Si hay más, se devuelve 503 `LIMITE_LECTURA_REAL`, sin truncamiento silencioso ni datos parciales. Duplicados durante la paginación producen `LECTURA_INESTABLE`. No se detectan todas las carreras posibles: una inserción, eliminación o cambio de nombre/rol entre páginas puede alterar el conjunto. **Este listado nunca sirve de autorización, conteo del último administrador ni precondición de escritura.** Para crecer, diseñar una proyección administrativa consultable en servidor con filtros/paginación de base de datos.

Errores: 400 consulta inválida; 401 sin identidad válida; 403 sin permiso/AAL2; 503 proveedor/configuración/lectura inconsistente; 500 ante una excepción inesperada de operación. Un fallo de Auth o perfiles no se convierte en lista vacía ni activa fixtures. No se publican mensajes internos del proveedor.

## 3. Aislamiento y configuración no aplicada

`lecturas-supabase.ts` y la composición de servidor llevan `server-only`. El núcleo puro `usuarios-reales.ts` permite pruebas con puertos inyectados, sin credenciales. La instancia real expone únicamente `listarCuentas` y `consultarPerfiles`; no expone el SDK ni métodos de mutación.

La creación requiere simultáneamente, en entorno exclusivamente servidor:

- `DENTAIA_ADMIN_READS_ENABLED=true`.
- `DENTAIA_SUPABASE_ADMIN_READ_SECRET`: credencial administrativa del proyecto, provisionada por el propietario mediante un gestor de secretos, **sin prefijo NEXT_PUBLIC**.
- La URL HTTPS del mismo proyecto que usa el guard (`NEXT_PUBLIC_SUPABASE_URL`).

No se creó ni modificó ningún archivo de entorno. No se reutiliza automáticamente `SUPABASE_SECRET_KEY` del script local. Una credencial administrativa de Supabase conserva privilegios amplios; el nombre de la variable no la convierte en una credencial restringida a lectura. El puerto, los endpoints permitidos y el transporte GET limitan su uso en esta implementación. Debe revisarse su provisión, rotación y registro de acceso antes de activar el proveedor, especialmente en producción.

El transporte permite exclusivamente GET al origen configurado y a `/auth/v1/admin/users` o `/rest/v1/profiles`; rechaza redirecciones y caché. Timeout de ocho segundos por solicitud y veinte segundos para toda la instancia por petición. No hay caché de usuarios, singleton con sesión ni reintentos automáticos. No se amplían RLS ni permisos del navegador. Sin configuración se devuelve 503 después de autorizar, sin consultar datos ni publicar secretos.

## 4. Contrato de cambios de roles: definido, no habilitado

La API actual de propuestas conserva su contrato sintético y no debe reutilizarse como una escritura real. No existe endpoint nuevo de asignación/revocación.

Decisiones funcionales para la próxima implementación de DI-151:

1. Operaciones explícitas de asignar/revocar **un rol**, no reemplazo de todo el conjunto ni aceptación de `app_metadata`/`profiles` arbitrarios. Preservar roles independientes y metadatos ajenos a `dentaia`.
2. Actor derivado de la sesión de servidor por petición; negar cambios propios, objetivos inexistentes y cuentas no habilitadas. Revalidar actor y objetivo dentro de la unidad de escritura, no confiar en un listado previo.
3. Promoción a superusuario y modificación de una cuenta que ya tenga ese rol permanecen prohibidas desde el panel hasta existir aprobación independiente. No introducir una excepción para retirar al último administrador.
4. La asignación de odontólogo requiere verificación profesional independiente. No existe hoy un vínculo verificado entre `dentists` y Auth ni contrato de clínicas; no habilitar esa concesión hasta resolverlo. Ningún rol administrativo concede acceso clínico.
5. Requerir sesión AAL2 vigente y definir una ventana de reautenticación reciente para mutaciones. Tener un token AAL2 por sí solo no prueba recencia.
6. Versionado por usuario e idempotencia por solicitud. Una versión obsoleta o clave reutilizada con otro contenido debe rechazar la operación, no sobrescribir un cambio concurrente.
7. Conservar al menos un administrador activo; validar también suspensiones/deshabilitaciones y el procedimiento externo de provisión. Prohibir cambios de administradores en este primer alcance reduce riesgos, pero no sustituye la garantía de concurrencia del mecanismo definitivo.
8. Auditoría mínima: solicitud, actor, objetivo, acción, roles anteriores/nuevos, versión, instante y resultado. No incluir secretos, factores, correos ni datos clínicos; no permitir que el actor altere su evidencia.

La edición arbitraria del nombre privado de terceros está denegada por DI-148; no implementar un CRUD global de perfiles bajo este título. Los campos administrativos adicionales requieren contrato explícito, no se inventan columnas.

## 5. Consistencia Auth/auditoría: decisión arquitectónica y bloqueo

> Evolución dentro de la Parte 2: la sección 13 de [DI-151-administracion-parte2.md](DI-151-administracion-parte2.md) prepara una alternativa SQL transaccional, sin aplicar ni activar. Mantiene Auth como autoridad y añade revisión/auditoría en la misma base. Prepara cambios de paciente y superusuario con aprobación independiente y MFA; permite revocar odontólogo, pero bloquea concederlo sin verificación profesional. Requiere aprobar expresamente la actualización acotada de una tabla Auth gestionada y validar permisos/compatibilidad; no utiliza el par de llamadas HTTP descrito aquí. Los párrafos siguientes conservan el análisis y la propuesta previa de outbox como antecedente, no describen la implementación nueva ni una migración aprobada.

**Situación actual:** roles canónicos en Auth `app_metadata.dentaia`. Una llamada `auth.admin.updateUserById()` y otra escritura de auditoría en PostgreSQL no forman una transacción. Escribir primero o después, usar un mutex de proceso o intentar restaurar metadatos no resuelve fallos parciales, carreras entre instancias ni auditoría atómica. Tampoco se modifica directamente `auth.users` desde SQL.

**Diseño recomendado para aprobar antes de habilitar escrituras:** autoridad de asignaciones administrativas en un esquema privado de PostgreSQL. En una única transacción, una operación restringida valida actor/sesión/AAL/recencia, bloquea el ámbito administrativo y el objetivo, comprueba versión e invariantes, cambia la asignación y registra auditoría más un evento de sincronización (outbox). La operación no debe ser un RPC público invocable sin esos controles; sus GRANT, RLS, propietario y contexto de sesión requieren revisión y pruebas en entorno dedicado.

Auth seguirá siendo autoridad de identidad. `app_metadata.dentaia` pasaría a ser una **proyección**, no una segunda autoridad. El guard deberá consultar la asignación canónica vigente antes de habilitar cualquier mutación y antes de depender del nuevo modelo. Esto exige adaptar y volver a probar DI-150, no eliminar sus controles.

Un trabajador exclusivo de servidor sincronizaría el namespace con Auth Admin, preservando los metadatos ajenos mediante lectura fresca y cambio acotado. Procesaría eventos serializados por usuario y versión, con reintentos durables y reconciliación. Auth Admin no ofrece aquí un CAS transaccional conjunto con PostgreSQL: toda vía externa que modifique ese namespace debe quedar controlada y acordada. No permitir roles efectivos desde una copia atrasada ni reactivar un rol revocado por reordenamiento de eventos.

Si Auth falla, la asignación y auditoría canónicas permanecen consistentes y el evento queda pendiente; la respuesta distingue `persistido_pendiente_sincronizacion` de `sincronizado`, sin afirmar éxito de Auth. Una revocación se aplica en la autoridad consultada por el guard aun con una proyección Auth antigua. Para concesiones se puede exigir sincronización confirmada antes de hacerlas efectivas; acordar esta semántica y probarla.

Esta decisión requiere aprobación del cambio de autoridad, diseño/versionado del esquema, procedimiento de provisión y entorno autorizado. **No está implementada ni aprobada por este documento.** No se añadió SQL, trabajador, endpoint de escritura, bandera para saltarse la auditoría ni acceso remoto. Si se decide conservar Auth como autoridad única, se necesita otra propuesta que demuestre los mismos invariantes; un simple par de llamadas SDK no basta para cumplir DI-148.

## 6. Pruebas verificables y límites

Pruebas nuevas aisladas en `usuarios-reales.test.mjs` y `lecturas-supabase.test.mjs`: 23 casos. Cubren proyección mínima; perfiles ausentes; asignaciones inválidas/ausentes/suspendidas; estados Auth; búsqueda después de la primera página; orden/paginación/vacío; consultas inválidas; errores sin datos parciales; duplicados/límite; aislamiento entre lecturas concurrentes; guard/AAL2; consultas manipuladas; escritura no registrada; `server-only`; activación y credencial; SDK instalado con fetch interceptado y recorrido API → guard → proveedor → SDK interceptado.

Los dobles no hacen peticiones a Supabase. La prueba concurrente es de **lecturas aisladas**, no valida concurrencia de escrituras ni atomicidad remota. `origen: supabase` es el contrato del adaptador, no una afirmación de backend vivo en esos tests.

| Escenario futuro | Evidencia exigida antes de aceptar | Estado |
| --- | --- | --- |
| Lectura real autorizada | Administrador de prueba AAL2; Auth y perfiles conocidos; respuesta mínima y filtros/páginas contrastados. | Pendiente de entorno/credencial autorizados. |
| Rechazos reales | Visitante, paciente, odontólogo, AAL1, rol retirado, suspensión, JWT inválido/caducado; ninguna lectura privilegiada tras denegar. | Pendiente en el nuevo endpoint. |
| Escritura permitida | Cuenta ficticia, transición aprobada, auditoría, versión y lectura posterior; restauración controlada de la asignación de prueba. | Bloqueada por diseño/configuración de persistencia. |
| Escritura rechazada | Autoelevación, objetivo/rol inválido, metadatos extra, administrador protegido y profesional sin verificar; sin cambios. | Bloqueada; hoy no hay operación real habilitada. |
| Último administrador/concurrencia | Dos instancias/solicitudes simultáneas; al menos un administrador activo; una versión aceptada y conflicto controlado; auditoría correspondiente. | Pendiente; fixtures no certifican la base de datos. |
| Fallos y recuperación | Caída antes/después del commit, auditoría fallida, Auth caído, respuesta perdida, evento duplicado/fuera de orden; reintento idempotente sin pérdida de metadatos. | Pendiente; solo en entorno dedicado. |
| Integración visual | Panel conectado al contrato real; carga/vacío/error; navegación/teclado/móvil y limpieza tras logout. | DI-152; reutilizar parte 2, sin reescribirla. |
| Regresión y consolidación | Suite, typecheck, build y permisos del resto de módulos; comandos, versión y resultados separados por entorno. | DI-153 reutiliza pruebas de DI-151. |

Las integraciones reales usarán otra convención/comando, nunca credenciales en el patrón aislado `src/features/**/*.test.mjs`. No se necesita instalar un ejecutor nuevo.

## 7. Verificación de esta entrega

Entorno de ejecución: Windows, Node.js `v22.18.0`, Next.js `15.5.28`, Supabase JS `2.118.0`. Versión probada: base `e6f6835` más los diez archivos locales previos y los cambios sin commit de esta entrega.

| Comprobación ejecutada | Resultado |
| --- | --- |
| `npm run typecheck` | Aprobado. |
| `npm run build` | Aprobado; el nuevo Route Handler se incluye como ruta dinámica de servidor. |
| `node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"` | **169 aprobadas, 0 fallidas, 0 omitidas**: 146 existentes y 23 nuevas. Tests aislados, sin credenciales ni backend remoto. |
| HTTP contra `next start` local, sin bearer | GET real: 401, privado/no-store; encabezados falsos de rol/AAL tampoco dan acceso. POST al endpoint de lectura: 405. |
| Rutas no habilitadas en producción local | `/api/administracion/roles/asignar`: 404; `/admin` y `/desarrollo/panel-admin`: 404. |
| Rutas de los módulos existentes | `/`, `/cuenta`, `/directorio`, `/solicitudes`, `/fotografias`: HTTP 200. Esto comprueba entrega de HTML, no sus operaciones autenticadas con Supabase. |
| Aislamiento del secreto | Prueba `server-only` aprobada; no aparece el identificador de configuración privilegiada en `.next/static`. No se configuró ninguna credencial real. |
| Conservación del trabajo previo | Los diez archivos de DI-151 parte 2 coinciden byte a byte con sus hashes SHA-256 iniciales. |
| Diff | `git diff --check` aprobado; sin cambios a dependencias, workflows, módulos ajenos ni políticas. El archivo auxiliar `next-env.d.ts` regenerado por el build se devolvió a su contenido inicial. |

Logs locales temporales: `%TEMP%/DentaIA-DI151-lectura-real-pruebas.tap` y `%TEMP%/DentaIA-DI151-lectura-real-build.log`. No contienen sesiones ni credenciales reales. Node emite el aviso existente de detección automática de módulos en el proyecto; no se cambió el tipo de paquete para silenciarlo.

**No ejecutado:** listado positivo de usuarios reales, AAL2 real contra el nuevo endpoint, escrituras/lectura posterior, auditoría persistida, concurrencia de escrituras, sincronización Auth ni recorrido visual del contrato real. No se ha activado el proveedor ni se han modificado datos remotos. No se ejecutó GitHub Actions porque no hay commit/push.

Para cerrar DI-151 faltan la activación/aceptación de lectura real, aprobar e implementar el mecanismo consistente de roles/auditoría, sus pruebas reales y las transiciones autorizadas correspondientes. No se trasladan esos pendientes a DI-152 ni se declara la subtarea finalizada.

Referencias técnicas consultadas: [listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers), [updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) y [changelog](https://supabase.com/changelog). Se revisó el aviso de cambio TLS de octubre de 2026; no requiere modificar estas llamadas del SDK instalado ni desactivar TLS. No se actualizaron dependencias.
