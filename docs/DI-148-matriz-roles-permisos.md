# DI-148 — Análisis de roles y permisos

| Dato | Valor |
| --- | --- |
| Historia relacionada | DI-144 — Superusuario y panel administrativo |
| Responsable del análisis | Jhan |
| Inicio y finalización del entregable | 30/10/2026 |
| Estado del entregable | Análisis técnico documentado, pendiente de revisión |
| Repositorio local inspeccionado | `DentaIA` |
| Rama inspeccionada | `feature/jhan-rediseño-ui-global` |
| Commit de referencia local | `9b5ceabb567a11dbaeb15c176a280f1cad72517a` |

## 1. Objetivo y alcance

Definir los roles, permisos y límites de seguridad necesarios para incorporar el superusuario de DentaIA sin cambiar las funcionalidades de cuenta, directorio, solicitudes y fotografías. Se aplica mínimo privilegio: **administrar la plataforma no concede acceso automático a información clínica de otras personas**.

Este entregable es una revisión estática del repositorio local y una propuesta de arquitectura. No implementa roles, tablas, políticas, endpoints ni interfaces. No consulta GitHub, Jira o Supabase remoto, ni verifica qué versión está desplegada. La fecha indicada corresponde al análisis; no representa una modificación de fechas o estados en Jira.

Las referencias `[E01]` a `[E24]` se resuelven en la sección 9. Distinguir:

- **Implementado:** comportamiento identificable en el código local.
- **Contrato documentado:** comportamiento del servidor descrito en documentación local, sin comprobarlo contra la base de datos durante DI-148.
- **Propuesto / pendiente:** diseño que requerirá implementación y pruebas posteriores.

## 2. Diagnóstico de la arquitectura y autenticación actuales

### 2.1. Framework y organización

El proyecto declara Next.js **15.5.28**, React **19.1.8**, TypeScript **5.9.3** y `@supabase/supabase-js` **2.118.0**, con Node.js `>=22.9.0`. Emplea App Router en `src/app`, componentes compartidos en `src/components`, módulos funcionales en `src/features` y utilidades en `src/lib`. TypeScript está configurado con `strict: true` y alias `@/*` hacia `src/*`. [E01, E02, E03]

Las páginas componen componentes cliente que consultan directamente Supabase desde el navegador. El layout global aporta navegación y presentación; el grupo `(modulos)` solo envuelve su contenido, **no constituye una barrera de autorización**. En el inventario local de `src/app` no hay Route Handlers `route.ts`, carpeta administrativa ni endpoints propios para administrar usuarios. Tampoco se encontró middleware, cliente Supabase de servidor o integración `@supabase/ssr` en los archivos inspeccionados. Esta ausencia describe esta copia local, no otros repositorios o ramas. [E01–E04, E16, E17]

### 2.2. Autenticación y sesión

- `Cuenta` utiliza `auth.signUp`, `auth.signInWithPassword` y `auth.signOut`. En el registro únicamente envía `full_name` como metadato del usuario; no asigna roles de negocio. La confirmación de correo puede ser requerida por Auth según el contrato documentado; su configuración remota actual no se inspeccionó. [E05, E07, E15]
- `getSupabaseBrowserClient()` crea una instancia compartida con URL y clave publicable obtenidas de la configuración del proceso. Impide su uso fuera del navegador. No se reprodujeron valores de configuración en este documento. [E04]
- `useSesion()` llama a `auth.getUser()`, escucha `onAuthStateChange`, limpia el usuario al cerrar sesión y controla respuestas desactualizadas. Es reutilizable para experiencia de usuario, pero **no autentica una petición de servidor ni acredita un rol administrativo**. [E06]
- `leerPerfil()` y `guardarPerfil()` verifican con `getUser()` que la identidad coincida con el ID esperado. La lectura filtra por `profiles.id` y la edición envía únicamente `full_name`. `PerfilPaciente` puede tomar el nombre inicial de `user_metadata.full_name`; no lo usa como permiso. [E08, E09]
- Existe una herramienta `/desarrollo/acceso`: su página devuelve `notFound()` fuera de `NODE_ENV=development`. Su componente usa `getSession()` para mostrar estado y el SDK para iniciar/cerrar sesión. **No es un panel administrativo** ni debe convertirse en la fuente de autorización de DI-144. [E18]

No hay una autorización RBAC de negocio en la lógica inspeccionada. El estado de sesión y los filtros de propietario son controles existentes, pero no sustituyen la autorización efectiva del servidor. [E05, E06, E08, E10, E11]

`next.config.ts` configura cabeceras como `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`. Son medidas de seguridad existentes, pero no verifican identidad ni permisos. El cliente obtiene su configuración desde el proceso y `.gitignore` excluye los archivos de entorno salvo la plantilla; no se leyeron sus valores privados. [E04, E21, E24]

### 2.3. Datos, usuarios y límites del esquema conocido

El archivo de tipos describe estas cinco tablas del esquema `public`; no equivale a un volcado de SQL ni acredita los privilegios efectivos. [E03]

| Entidad | Relación con identidad y uso comprobable localmente | Límite para administración |
| --- | --- | --- |
| Usuario de Supabase Auth | El SDK entrega `user.id`; el código lo utiliza para identidad y propiedad. No hay un modelo local del esquema `auth`. [E05, E06] | No se puede afirmar desde estos tipos la estructura o configuración completa de `auth.users`. |
| `profiles` | Campos `id`, `full_name`, `created_at`; la aplicación usa `id = user.id`. [E03, E08] | No contiene `role`, clínica ni estado administrativo. No se acredita una FK hacia Auth mediante los tipos públicos. |
| `dentists` | Directorio con nombre, especialidad, distrito, precio, `is_active` e `is_demo`. [E03, E13, E14] | No tiene `user_id` ni `clinic_id` en el tipo local: aparecer en el directorio no permite iniciar sesión como odontólogo. |
| `appointment_requests` | Propietario `user_id`, `dentist_id`, contacto, fechas, estado e `is_demo`. Hay relación tipada con `dentists`. [E03, E10] | Solicitudes de demostración, no historia clínica ni agenda confirmada. |
| `patient_consents` | Propietario `user_id`, texto, finalidad, versión y fechas de aceptación/revocación. [E03, E11] | La finalidad usada es `academic_photo_storage`, no atención clínica, intercambio entre clínicas o procesamiento por IA. |
| `dental_photos` | `user_id`, `consent_id`, bucket, ruta y metadatos. La relación tipada con consentimiento utiliza `user_id` y `consent_id`. [E03, E11, E12] | La propiedad de una imagen no concede acceso clínico a otro usuario ni a un administrador. |

No se encontraron tablas de roles, clínicas, membresías profesionales, autorizaciones clínicas, historial clínico o resultados de inferencia en el esquema público tipado. Sus secciones de funciones, vistas y enumeraciones están vacías. Es una limitación de la evidencia local: podría existir configuración remota no representada por estos tipos. [E03]

La demostración contiene tres casos fijos en `casos.ts`. `Demostracion` reconoce muestras y presenta resultados educativos; `pdf.ts` genera el reporte en el navegador. No constituyen resultados clínicos personales ni un historial persistente. [E19]

### 2.4. Autorización existente y RLS

Las solicitudes verifican `getUser()`, filtran por propietario e `is_demo` y solo cancelan una fila en estado `requested`. El formulario vuelve a validar la identidad antes de insertar. [E10]

Fotografías valida la sesión, consulta datos propios, solicita consentimiento y usa Storage. `eliminarFotografia()` verifica identidad, propietario, bucket y ruta; comprueba la ausencia del archivo antes de eliminar metadatos y permite reintentos. No utiliza una clave privilegiada ni restaura archivos para completar el borrado. [E11, E12]

La documentación atribuye a RLS la protección de registros propios y del bucket privado `dental-photos`. `RECUPERACION.md` describe políticas de lectura/borrado por propietario y subida con consentimiento vigente. **Esto es un contrato documentado previamente, no una auditoría actual del servidor.** No se encontraron archivos SQL o migraciones versionadas que permitan reconstruir y certificar todas las políticas, GRANT, restricciones o triggers. Los tipos `Insert`/`Update` tampoco prueban que una columna sea modificable por un usuario. [E03, E15, E20]

Existe `scripts/create-test-users.mjs`, una utilidad local del propietario que invoca `auth.admin.createUser` con una clave secreta del proceso. No se ejecutó. Su existencia no implementa un superusuario de aplicación, una API administrativa ni una autorización reutilizable para pacientes. [E21]

### 2.5. Rutas actuales

| Ruta | Acceso identificado en el código | Protección y evidencia |
| --- | --- | --- |
| `/`, `/privacidad` | Página pública | Sin comprobación de sesión en la página. [E16, E17] |
| `/directorio`, `/directorio/[id]` | Consulta pública de profesionales activos | Componentes cliente consultan `dentists` sin exigir login. Filtros visibles no sustituyen RLS. [E13, E14, E16] |
| `/analisis/demo` | Demostración pública | Resultados educativos fijos y PDF local, sin cuenta obligatoria. [E19] |
| `/cuenta` | Entrada pública; perfil propio tras autenticación | El componente alterna acceso/registro y perfil según sesión; no hay guard de servidor para datos privados. [E05, E06, E09, E16] |
| `/solicitudes` | Pantalla accesible; registro y datos propios requieren sesión | Formulario bloqueado sin usuario y operaciones con `getUser()` y propietario. [E10, E16] |
| `/fotografias` | Pantalla accesible; galería y mutaciones requieren sesión | Sin usuario muestra acceso a cuenta; comprobaciones de identidad, consentimiento y propiedad en operaciones. [E11, E12] |
| `/desarrollo/acceso` | Solo entorno de desarrollo | Restricción de entorno en servidor, no control de rol. [E18] |
| `/admin`, `/api/admin/*` | **No existen en este inventario** | Rutas propuestas para trabajo posterior; no asumir que ya están protegidas. [E16] |

Una ruta que muestra una invitación a iniciar sesión no es una ruta privada protegida por servidor. La autorización final de datos debe mantenerse en Supabase y, para el panel futuro, también en cada operación del servidor.

## 3. Roles existentes y propuestos

| Perfil | Estado actual | Definición técnica propuesta |
| --- | --- | --- |
| Visitante | Implementado como ausencia de sesión; no es una fila ni un rol persistido. [E05, E11, E13, E19] | Solo recursos públicos y registro/login. Ningún dato privado. |
| Paciente | Implementado funcionalmente mediante usuario autenticado, perfil y recursos propios; no hay un campo de rol `paciente`. [E03, E05–E12] | Capacidades sobre recursos propios. El registro público nunca concede privilegios profesionales o administrativos. |
| Odontólogo | Solo existe su ficha de directorio; el rol autenticado está pendiente. [E03, E13, E14] | Identidad profesional verificada, vinculada a ficha y clínica, con membresía activa. Acceso clínico exclusivamente a pacientes y recursos expresamente autorizados. |
| Superusuario | Pendiente: no se encontró rol persistido, panel ni operaciones administrativas propias. [E03, E16, E17] | Administración de cuentas, roles y configuración no clínica según permisos explícitos y con auditoría. No es `service_role`, propietario de Supabase ni un permiso universal sobre datos. |

**Los roles no forman una jerarquía clínica.** El superusuario no hereda permisos de odontólogo. Si una misma persona también es profesional, su acceso clínico exige una asignación profesional independiente y cumple exactamente las mismas restricciones. Tener sesión o un rol técnico de infraestructura no determina por sí solo el rol de negocio.

## 4. Matriz de permisos propuesta

La siguiente matriz es el **objetivo de autorización**, no una afirmación de funcionalidades ya disponibles. `Propio` exige identidad verificada y coincidencia de propietario. `Autorizado` exige membresía profesional activa, clínica correcta, relación asistencial y autorización específica vigente. `No` significa denegar por defecto.

| Recurso o acción | Visitante | Paciente | Odontólogo | Superusuario |
| --- | --- | --- | --- | --- |
| Inicio, privacidad y directorio público | Sí | Sí | Sí | Sí |
| Demostración, recomendaciones y PDF educativos públicos | Sí | Sí | Sí | Sí |
| Registro público / login | Sí; sin elegir privilegios | Login de su cuenta | Login de cuenta verificada | Login de cuenta previamente habilitada |
| Consultar/editar perfil personal básico | No | Propio | Propio | Propio |
| Registrar, consultar o cancelar solicitudes de demostración | No | Propias | Solo las propias si usa este flujo; no las de pacientes ajenos | Solo las propias si usa este flujo; no acceso global |
| Consentir almacenamiento, ver/subir/eliminar imágenes propias | No | Propias; subida con consentimiento vigente | Propias si usa el flujo personal; sin acceso a otras por su rol | Propias si usa el flujo personal; sin acceso a otras por su rol |
| Consultar resultados o recomendaciones personales futuros | No | Propios cuando se implemente | Solo autorizados para atención | No por condición de administrador |
| Acceder al historial clínico futuro y fotos compartidas para atención | No | Propio según el módulo que se implemente | Solo autorizados, con alcance y vigencia | No por condición de administrador |
| Registrar una anotación clínica futura | No | No; puede aportar información si se habilita una función distinta | Solo en atención autorizada; con trazabilidad | No por condición de administrador |
| Cambiar información clínica o borrar anotaciones de otro profesional | No | No | No por defecto; correcciones futuras versionadas, sin sobrescritura destructiva | No |
| Administrar ficha pública del profesional | No | No | Solo su ficha verificada, si se habilita; sin cambiar identidad validada ni roles | Datos públicos y estado del directorio, por endpoint autorizado |
| Consultar registro mínimo de cuentas para administración | No | No | No | ID, contacto estrictamente necesario, estado y asignaciones; sin contenido clínico |
| Habilitar/invitar/suspender cuentas | No | No | No | Sí, con verificación, propósito, auditoría y protección de sesiones |
| Cambiar nombre/perfil privado de otra persona | No | No | No | No por defecto; cualquier soporte excepcional requiere un permiso y procedimiento separado |
| Asignar o revocar roles y membresías | No | No | No | Solo mediante operación controlada; sin autoasignación ni modificación directa de tablas |
| Acceder al panel administrativo futuro `/admin` | No | No | No | Sí, sesión y rol vigentes comprobados en servidor |
| Ejecutar API administrativa futura | No | No | No | Solo acciones expresamente permitidas y validadas en servidor |
| Consultar auditoría administrativa | No | No | No | Sí, mínima y sin imágenes, resultados o texto clínico |
| Acceder a pacientes de otra clínica | No | Solo sus propios datos | No sin nueva autorización y membresía correspondiente | No por administrar las clínicas |

El uso de funciones personales por un odontólogo o superusuario no concede capacidades sobre terceros. En la implementación inicial se deben conservar las operaciones personales actuales; cualquier exclusión de perfiles del flujo de paciente requeriría una decisión adicional, no se deduce de esta matriz.

## 5. Reglas de seguridad para el diseño administrativo

Todas las reglas siguientes son **requisitos pendientes**, salvo los controles existentes indicados en la sección 2.

### 5.1. Sesión y autorización de servidor

1. Verificar una sesión auténtica en el servidor y obtener la identidad antes de consultar roles. No aceptar como prueba un ID, email, rol o clínica enviados por React, por parámetros de URL o por almacenamiento del navegador.
2. Resolver permisos vigentes desde una fuente de roles controlada por el servidor; comprobar además estado de cuenta y membresía para cada operación sensible. Denegar si la comprobación falla, expira la sesión o se revoca el rol.
3. Proteger tanto la entrada de `/admin` como cada Route Handler o Server Action futura. Ocultar enlaces, un layout o un middleware solo mejoran navegación; no autorizan por sí mismos una mutación.
4. Responder sin datos protegidos: petición sin sesión válida, 401; identidad sin permiso, 403. Para recursos privados, evitar que las respuestas permitan enumerar información de terceros.
5. No confiar en `getSession()` del navegador ni limitarse a decodificar un JWT. La autenticidad y vigencia de la identidad deben comprobarse mediante mecanismos de servidor compatibles con Supabase. `useSesion()` seguirá siendo una ayuda de interfaz, no un guard administrativo.
6. Definir transporte antes de programar: cliente de servidor y cookies seguras compatibles con Auth, o validación de un token de usuario por petición. No asumir que el servidor ya recibe la sesión del cliente actual. Con cookies, aplicar protección CSRF y comprobación de origen en mutaciones; impedir caché compartida de respuestas privadas.

### 5.2. Roles y prevención de escalamiento

7. No guardar el rol administrativo en un campo editable de `profiles` ni confiar en `user_metadata` o en datos aportados durante `signUp`. El nombre personal editable no debe abrir acceso a una asignación de privilegios.
8. Mantener una fuente canónica de asignaciones fuera de la escritura de pacientes y profesionales. Si posteriormente se reflejan permisos en claims controlados por servidor, considerar su desactualización: una revocación no debe esperar únicamente al refresco del JWT.
9. El alta pública concede únicamente capacidades personales. La habilitación de odontólogos y superusuarios exige un proceso separado de verificación. Un registro en `dentists` no basta para conceder ese rol.
10. El primer superusuario se aprovisionará mediante un procedimiento restringido del propietario, con evidencia y sin credenciales embebidas. El script de cuentas de prueba no se usará como endpoint ni como bootstrap automático del administrador.
11. Prohibir autoascensos y cambios de privilegios propios. Exigir reautenticación y MFA para administración sensible como requisito de diseño, aún no implementado en la interfaz inspeccionada. Las promociones a superusuario requieren aprobación independiente y trazable; hasta contar con ese proceso, denegarlas desde el panel.
12. Impedir deshabilitar al último superusuario activo. Validar concurrencia; el cambio de asignación y su evento de auditoría deben confirmarse de forma atómica en PostgreSQL. Una suspensión debe impedir operaciones con sesiones anteriores, no asumir que borrar una cuenta invalida inmediatamente todo token emitido.

### 5.3. Datos, RLS, claves y separación clínica

13. Mantener RLS y restricciones del servidor para datos privados. Autorizar mediante propietario o combinación explícita de clínica, profesional, paciente y recurso; estar autenticado no basta. Aplicar condiciones de lectura, escritura y nuevos valores para impedir reasignar un recurso a otra persona o clínica.
14. Usar el contexto del usuario para las operaciones sujetas a RLS. Si una función de administración de Auth necesita SDK privilegiado, aislarla en servidor, con permiso comprobado, acciones limitadas, validación de campos y auditoría. **No utilizar ese cliente para búsquedas clínicas generales** ni exponerlo como CRUD arbitrario.
15. No exponer claves secretas, `service_role`, tokens, contraseñas o valores de configuración en navegador, repositorio, respuestas o logs. El código actual usa un cliente publicable de navegador; conservar ese límite. [E04, E21]
16. No extender el consentimiento `academic_photo_storage` para conceder acceso a odontólogos, compartir entre clínicas o procesar IA. La autorización clínica futura debe identificar destinatario, clínica, finalidad, recursos, vigencia y revocación. La base jurídica y el texto de consentimiento requieren revisión correspondiente antes de utilizar datos reales.
17. Aislar clínicas: comprobar membresía activa, relación asistencial y autorización vigente del paciente en servidor y políticas de datos. Elegir otra clínica en la interfaz no cambia el alcance autorizado. La atención en dos clínicas exige asignaciones independientes; no compartir automáticamente el historial completo.
18. Mantener los archivos privados sin URL pública. Una autorización clínica futura para una imagen exige controlar también descarga y acceso en Storage; autorizar solo su fila de metadatos es insuficiente. No relajar las políticas actuales antes de diseñar y probar el acceso compartido.
19. La revocación de almacenamiento actual bloquea nuevas cargas según el contrato, pero no elimina por sí sola las fotos existentes. No confundirla con revocar una autorización clínica futura. Conservar la eliminación progresiva y reintentable: Storage y PostgreSQL no se consideran una misma transacción. [E11, E12, E15, E20]
20. Registrar acciones administrativas con actor, acción, objetivo mínimo, fecha, resultado e identificador de solicitud. No registrar texto clínico, imágenes, credenciales ni reportes completos; el administrador no podrá alterar la evidencia de sus propias acciones.

## 6. Archivos y componentes reutilizables

| Elemento existente | Reutilización prevista | Límite |
| --- | --- | --- |
| `Cuenta`, `PerfilPaciente`, `useSesion`, validaciones de cuenta | Login común, perfil, estados de sesión y errores de interfaz. [E05–E09] | Agregar autorización de servidor separada; no duplicar Auth ni convertir un booleano de React en permiso. |
| `getSupabaseBrowserClient`, tipos `Database` | Mantener flujos personales y tipos existentes. [E03, E04] | El cliente actual no es un cliente de servidor; los tipos deben regenerarse si después cambia el esquema. |
| `perfiles.ts`, `solicitudes.ts`, `eliminar.ts` | Patrones de identidad esperada, propiedad, validación y comprobación de filas afectadas. [E08, E10, E12] | No quitar filtros para habilitar al administrador ni presentar estos helpers cliente como autorización de servidor. |
| `DirectorioLista`, `DentistaDetalle`, formato y tipos | Lectura del directorio y presentación de profesionales. [E13, E14] | Administración futura necesita un servicio de escritura autorizado, no modificar los componentes públicos para saltar permisos. |
| `Encabezado`, `Identidad`, `Pie`, estilos globales | Identidad visual, navegación, foco y estados compartidos. [E17] | Mostrar un enlace administrativo dependerá del permiso, pero la seguridad se comprobará nuevamente en servidor. |
| Pruebas aisladas existentes | Conservar regresión de perfil propio, solicitudes y eliminación. [E22] | Clientes simulados no prueban políticas RLS ni aislamiento real entre clínicas. |

## 7. Cambios técnicos necesarios para próximas subtareas

No se implementa ninguno en DI-148. El repositorio no contiene las descripciones ni criterios específicos de DI-149 y DI-150 identificados con esos códigos; por ello **no se les atribuyen títulos ni un alcance supuesto**. Las siguientes decisiones son dependencias para ambas, sujetas a revisión de sus criterios.

### 7.1. Modelo de autorización propuesto

- Conservar `profiles` para información personal editable. Mantener la equivalencia funcional de paciente para cuentas ordinarias, sin conceder automáticamente otros roles.
- Definir un registro canónico de roles de plataforma, por ejemplo `private.platform_user_roles`, vinculado a identidad de Auth, con asignaciones de superusuario, estado, autor y fecha. Es un nombre **propuesto**, no una tabla existente. No exponer escritura desde la Data API pública. Un esquema privado también necesita permisos de acceso explícitos y una vía de servidor cuidadosamente limitada.
- Para el rol profesional y múltiples clínicas, diseñar entidades de clínica, membresías y vínculo verificado entre cuenta y ficha de `dentists`. Acordar cardinalidades e integridad antes de modificar esa tabla o agregar `clinic_id`.
- Para funcionalidades clínicas posteriores, diseñar recursos clínicos y autorizaciones delimitadas por paciente, clínica y profesional. No usar `appointment_requests` como historia clínica ni una solicitud de demostración como autorización asistencial. Crear auditoría separada con acceso mínimo.
- No agregar una condición global «es administrador» a las políticas de fotos, consentimiento o futuros historiales. RLS debe conservar la separación entre administración y asistencia clínica.

### 7.2. Implementación y secuencia futura

1. Revisar la matriz y los criterios de DI-149/DI-150; aprobar la fuente de roles, bootstrap, responsabilidades de verificación profesional y límites del panel inicial.
2. Inspeccionar autorizadamente el esquema, políticas y GRANT reales; contrastarlos con los tipos. Preparar migraciones versionadas y pruebas antes de aplicar cualquier cambio. Esta inspección remota no se realizó en DI-148.
3. Incorporar el mecanismo de sesión de servidor y un servicio de autorización, por ejemplo `exigirPermiso()`, con lectura de asignación vigente. Separar operaciones de identidad administrativa de las clínicas.
4. Implementar primero un panel no clínico mínimo y operaciones explícitas, por ejemplo `/admin` y `/api/admin/*`, si esos nombres se aprueban. Validar cada acción; no crear una ruta genérica que acepte nombres de tablas o roles del cliente.
5. Proteger asignaciones y auditoría; habilitar promociones desde la interfaz solo después de implementar las garantías de aprobación, MFA, concurrencia y último administrador.
6. Diseñar por separado acceso profesional y entre clínicas. Hasta implementar y validar membresías y autorización clínica, **denegar todo acceso clínico de terceros**.
7. Conservar módulos y pruebas del equipo. Añadir pruebas negativas de sesión/rol inválidos, autoascenso, campos inesperados, acceso por URL directa/API, revocación, clínica ajena y cuenta suspendida. Ejecutar pruebas reales controladas con identidades distintas; no presentar mocks como validación RLS.

### 7.3. Riesgos y decisiones bloqueantes

| Riesgo o dependencia para DI-149/DI-150 | Consecuencia | Tratamiento requerido |
| --- | --- | --- |
| Rama inspeccionada de rediseño, no `main` | El estado local podría diferir de la base que se elija después. | Revalidar base y contrato antes de implementar; no cambiar ni actualizar ramas en esta subtarea. |
| No hay roles de negocio ni vínculo cuenta–odontólogo | Suplantación si se infieren de una ficha o del email. | Asignación controlada, identidad verificada y vínculos íntegros. |
| Solo existe cliente Auth de navegador | Un panel oculto podría ser accesible por petición directa. | Sesión y autorización de servidor para lectura y mutación. |
| RLS/GRANT sin DDL versionado en el inventario | No se puede acreditar el estado vigente ni reproducirlo solo con tipos. | Inspección autorizada, migraciones y pruebas de acceso real. |
| Claims o sesión con privilegios antiguos | Un rol revocado podría seguir operando. | Fuente canónica vigente y control efectivo de suspensión/revocación. |
| SDK privilegiado usado como cliente general | Exposición clínica o salto de restricciones. | Servicio administrativo separado y mínimo, nunca una autorización clínica implícita. |
| No hay clínicas, historial o consentimiento asistencial modelados | Fuga de datos al incorporar atención real. | Mantener denegación por defecto y diseñar membresías/autorizaciones antes de abrir acceso. |
| Demostración confundida con resultado clínico | Atribución de diagnósticos o permisos inexistentes. | Mantener sus avisos y separación de datos; no usar casos fijos como historial. |
| Alcance de DI-149 y DI-150 no disponible localmente | Implementación anticipada que no cumpla sus criterios. | Revisar sus especificaciones antes de comenzar, sin dar por realizadas esas subtareas. |

## 8. Criterios de aceptación y conclusión

### 8.1. Criterios de DI-148

- [x] Arquitectura y autenticación identificadas desde archivos reales, con referencia de rama y commit.
- [x] Visitante y paciente funcional diferenciados de los roles profesional y administrativo pendientes.
- [x] Matriz de permisos con propiedad, acceso clínico condicionado y superusuario sin acceso clínico automático.
- [x] Medidas implementadas separadas de contratos documentados y requisitos futuros.
- [x] Rutas, controles cliente y ausencia de autorización administrativa de servidor identificados.
- [x] Reutilización, cambios posteriores y dependencias de DI-149/DI-150 documentados sin implementar código.
- [x] Alcance limitado a este Markdown, sin cambios de rama, commits, publicación ni modificaciones de datos/configuración.
- [ ] Revisión de la matriz y aceptación por el responsable de DI-144/equipo antes de pasar DI-148 a «Listo» en Jira.

### 8.2. Criterios de seguridad para las siguientes implementaciones

Un usuario sin sesión no accederá al panel/API; un paciente y un odontólogo sin permiso administrativo serán rechazados aunque invoquen directamente los endpoints. Un superusuario gestionará solo los datos administrativos permitidos y no podrá leer contenido clínico ajeno. Un profesional de otra clínica o sin autorización vigente no verá datos del paciente. Una revocación o suspensión surtirá efecto en operaciones sensibles. No se admitirán autoascensos, modificación de roles desde el perfil, pérdida del último administrador ni cambios sin auditoría. Estos son criterios futuros, **no pruebas ejecutadas ni capacidades actuales**.

**Conclusión:** la aplicación local dispone de autenticación Supabase y flujos personales orientados al propietario. El superusuario requiere una capa nueva de autorización de negocio y servidor, separada del acceso clínico. DI-148 deja esa decisión técnica documentada y lista para revisión; no certifica el servidor remoto, la seguridad clínica ni la finalización de DI-149/DI-150. Solo se verificará la integridad del Markdown y su correspondencia con los archivos locales; no es necesario ejecutar build, modificar dependencias ni realizar operaciones reales para este entregable documental.

## 9. Índice de evidencia del repositorio

Referencias relativas al directorio de este documento. La ausencia de rutas/modelos se determinó mediante el inventario local de archivos y búsquedas en `src`, `scripts`, `package.json` y documentación; no se infirió de una pantalla.

| Referencia | Archivos inspeccionados y aspecto respaldado |
| --- | --- |
| E01 | [package.json](../package.json): framework, versiones, SDK y scripts. |
| E02 | [tsconfig.json](../tsconfig.json): TypeScript estricto, alias y compilación. |
| E03 | [database.types.ts](../src/lib/supabase/database.types.ts): cinco tablas, campos, relaciones tipadas y secciones públicas vacías. |
| E04 | [browser.ts](../src/lib/supabase/browser.ts): cliente publicable exclusivo del navegador. |
| E05 | [Cuenta.tsx](../src/features/cuenta/Cuenta.tsx): registro, login, logout, metadatos y representación según sesión. |
| E06 | [useSesion.ts](../src/features/cuenta/useSesion.ts): identidad, eventos y estado de sesión cliente. |
| E07 | [validaciones.ts](../src/features/cuenta/validaciones.ts): validación y traducción de errores; no autorización de roles. |
| E08 | [perfiles.ts](../src/features/cuenta/perfiles.ts): verificación de identidad, lectura y escritura del perfil propio. |
| E09 | [PerfilPaciente.tsx](../src/features/cuenta/PerfilPaciente.tsx): presentación/edición de nombre y metadato inicial. |
| E10 | [FormularioSolicitud.tsx](../src/features/solicitudes/FormularioSolicitud.tsx), [solicitudes.ts](../src/features/solicitudes/solicitudes.ts) y [MisSolicitudes.tsx](../src/features/solicitudes/MisSolicitudes.tsx): registro, consulta, cancelación, identidad y limpieza de estado. |
| E11 | [fotografias/page.tsx](../src/app/(modulos)/fotografias/page.tsx): sesión, finalidad y consentimiento, carga, galería y revocación. |
| E12 | [eliminar.ts](../src/features/fotografias/eliminar.ts): propiedad, ruta, validaciones de sesión y borrado progresivo. |
| E13 | [DirectorioLista.tsx](../src/features/directorio/DirectorioLista.tsx): consulta pública, filtros y profesionales ficticios. |
| E14 | [DentistaDetalle.tsx](../src/features/directorio/DentistaDetalle.tsx) y [tipos.ts](../src/features/directorio/tipos.ts): detalle y modelo de profesional del directorio. |
| E15 | [DESARROLLO.md](DESARROLLO.md), sección «Contrato real de datos y operaciones»: contrato documentado de Auth, propiedad, solicitudes y Storage; no DDL. |
| E16 | Páginas en [src/app](../src/app), especialmente [cuenta](../src/app/(modulos)/cuenta/page.tsx), [directorio](../src/app/(modulos)/directorio/page.tsx), [detalle](../src/app/(modulos)/directorio/[id]/page.tsx), [solicitudes](../src/app/(modulos)/solicitudes/page.tsx) y [layout de módulos](../src/app/(modulos)/layout.tsx): inventario y composición de rutas. |
| E17 | [layout global](../src/app/layout.tsx), [inicio](../src/app/page.tsx), [privacidad](../src/app/privacidad/page.tsx), [Encabezado](../src/components/Encabezado.tsx), [Identidad](../src/components/Identidad.tsx), [Pie](../src/components/Pie.tsx) y [globals.css](../src/app/globals.css): presentación y navegación compartida. |
| E18 | [desarrollo/acceso/page.tsx](../src/app/desarrollo/acceso/page.tsx) y [DevAccess.tsx](../src/app/desarrollo/acceso/DevAccess.tsx): restricción de entorno y herramienta de prueba. |
| E19 | [analisis/demo/page.tsx](../src/app/analisis/demo/page.tsx), [Demostracion.tsx](../src/features/analisis/Demostracion.tsx), [casos.ts](../src/features/analisis/casos.ts) y [pdf.ts](../src/features/analisis/pdf.ts): ejemplos educativos y reporte local. |
| E20 | [RECUPERACION.md](../src/features/fotografias/RECUPERACION.md): contrato documentado de políticas, reintento y límites de Storage/PostgreSQL. |
| E21 | [create-test-users.mjs](../scripts/create-test-users.mjs) y [.gitignore](../.gitignore): utilidad privilegiada local del propietario y exclusión de archivos de entorno; no se ejecutó ni se leyeron secretos. |
| E22 | [perfiles.test.mjs](../src/features/cuenta/perfiles.test.mjs), [solicitudes.test.mjs](../src/features/solicitudes/solicitudes.test.mjs) y [eliminar.test.mjs](../src/features/fotografias/eliminar.test.mjs): pruebas con clientes simulados, inspeccionadas sin ejecutarlas en DI-148. |
| E23 | [check-supabase.mjs](../scripts/check-supabase.mjs): comprobador que haría consultas reales si se ejecutara; no ejecutado en esta revisión local. |
| E24 | [next.config.ts](../next.config.ts): cabeceras de seguridad y configuración; no implementa un guard administrativo. |
