# DI-151 — Funcionalidades de administración, parte 1

- Historia: DI-144. Rama exclusiva: `feature/superusuario-admin`.
- Fecha de trabajo solicitada: 01/11/2026. Ejecución y verificaciones en este entorno: 02/11/2026 UTC.
- Finalización prevista de la subtarea: 02/11/2026. **Esta entrega es solo la parte 1; DI-151 no se declara completada.**
- Base revisada: `fa841a79ae7a1642f9057587035f408afc8904f7`; rama local/remota coincidentes y árbol limpio inicial. Registro como commit independiente y publicación en esta rama autorizados por el usuario; sin merge ni Pull Request.

## Revisión y decisiones

Se revisaron [DI-148](DI-148-matriz-roles-permisos.md), los componentes de DI-149, [DI-150 parte 2](DI-150-autenticacion-parte2.md), el cliente Supabase y los modelos/operaciones personales. El tipo real de `profiles` solo incluye `id`, `full_name` y `created_at`; no hay roles administrativos en esa tabla. Las consultas personales actuales comprueban identidad y filtran por propietario. `dentists` no aporta una relación autenticada con el profesional. No se infieren privilegios de esas entidades.

El adaptador de identidad de DI-150 únicamente expone `getUser` y `getClaims`. No ofrece un listado global de Auth ni escritura de roles. Tampoco se ha completado su aceptación real con administrador AAL2, revocación o sesiones controladas. Abrir lectura global de `profiles` o incorporar una clave privilegiada sin el servicio y auditoría correspondientes no es una integración válida.

Se elige por ello un **proveedor sintético sustituible**. No se crean tablas, cuentas, claves o asignaciones; no se consultan filas privadas de Supabase. El listado real y los cambios persistidos requieren un servicio administrativo de servidor, aprobación, auditoría, reglas de último administrador y validaciones de DI-150 pendientes. Esas funciones no se improvisan ni se implementa anticipadamente DI-152.

## Funcionalidad implementada

### Usuarios e interfaz local

La sección Usuarios de `/desarrollo/panel-admin` reutiliza `LayoutAdministrativo`, navegación, encabezado, tarjetas, estilos y `EstadoAdministrativo` de DI-149. Se incorporan:

- 13 cuentas sintéticas con alias “Cuenta de prueba”, UUID válidos, asignaciones y estados de ejemplo. Sin nombres personales, correos, teléfonos ni información clínica.
- Búsqueda por alias o UUID; filtros combinados de rol y estado. El filtro “Sin asignación” identifica ejemplos sin roles, no personas sin privilegios reales.
- Paginación estable de cinco filas en la interfaz; el servicio admite tamaños 5, 10 o 20. La búsqueda/filtros reinician página; la paginación enfoca el resumen actualizado.
- Carga asíncrona simulada, resultados vacíos, error y recuperación; selector explícito de escenarios. Se descartan respuestas antiguas al cambiar filtros o desmontar el componente.
- Tabla con encabezados, región desplazable accesible por teclado y controles etiquetados. Los roles y estados llevan etiquetas de **simulados/no persistidos**.
- Formulario para validar una propuesta sobre una cuenta sintética, con foco desde la fila y mensajes de resultado/error. No se edita el listado ni se simula un guardado exitoso.

La demo local consume el proveedor en memoria y **no llama a los endpoints ni verifica una identidad real**. El operador ficticio Cuenta de prueba 01 solo sirve para ensayar el rechazo de cambios propios. Este ID no es una fuente de autoridad en las rutas de servidor. El formulario advierte que su validación local no acredita autorización. El código de la demo no recibe tokens o claves.

No hay un listado real ni roles persistidos presentados como datos de producción. El contrato distingue `origen` (`sintetico`/`supabase`) y `origenRoles` (`sintetico`/`persistido`/`sin_asignacion`) para una integración futura; la implementación actual **solo devuelve origen sintético**. La referencia de roles de DI-148 sigue disponible en la sección Roles y permisos.

### Propuestas de rol, sin escritura

`validarPropuesta` acepta exclusivamente `{ operacion: "validar_cambio_rol", usuarioId, rol }`. Comprueba:

- UUID del objetivo y del operador; el operador del endpoint procede del contexto verificado por DI-150, nunca del JSON del cliente.
- Rechazo de acciones y campos desconocidos, incluidos campos de autoridad como `actorId` o `app_metadata`.
- Roles de negocio estrictos. `visitante`, roles técnicos, arrays, valores desconocidos y tipos inválidos se rechazan.
- Prohibición de cambiar privilegios propios. Promociones a superusuario y cambios sobre una cuenta superusuario se deniegan por requerir revisión independiente. No se habilita un camino para sortear la aprobación o la protección del último administrador.
- Existencia del objetivo en el proveedor sintético. Paciente y odontólogo pueden validarse como propuesta, sin conceder membresías o acceso clínico.

Una propuesta válida devuelve `modo: "solo_validacion"`, `aplicado: false` y un mensaje explícito de que **no se aplicó ni guardó nada en Supabase**. El proveedor carece de método de escritura. Ni siquiera cambia roles en memoria; una consulta posterior devuelve las asignaciones originales.

### API protegida y servicios sustituibles

| Ruta | Comportamiento |
| --- | --- |
| `GET /api/administracion/usuarios` | Lista paginada y filtrada del proveedor sintético; parámetros admitidos: `q`, `rol`, `estado`, `pagina`, `tamano`. Rechaza desconocidos, duplicados, tipos y límites inválidos. |
| `POST /api/administracion/roles/validar` | Validación sin aplicar cambios. Requiere JSON; lectura de cuerpo acotada a 2048 bytes, identificadores y roles validados. |

Ambas rutas usan `conAccesoAdministrativo` de DI-150 **antes de parsear/consultar servicios**. Conservan verificación de identidad/rol actual mediante Auth y firma/caducidad/AAL2/factor verificado. Se añaden únicamente las acciones `usuarios.consultar_demo` y `roles.validar_propuesta` a su lista cerrada. Las acciones de escritura real como `roles.asignar` o las acciones clínicas permanecen denegadas.

`crearApiAdministrativa` recibe el ejecutor de autorización y la interfaz `ProveedorAdministrativo`, lo que permite probar el flujo e integrar un proveedor real posteriormente. En producción, `servidor.ts` fija el ejecutor real de DI-150 y el proveedor sintético. No se puede seleccionar otro proveedor, escenario o identidad mediante una petición. Las respuestas proyectan campos mínimos y excluyen propiedades privadas adicionales de objetos de proveedor; el contrato DI-150 impone `private, no-store`, también para CDN.

La API es funcional con un bearer autorizado, pero **los casos positivos se verificaron con identidad/Auth simulados**, sin cuentas reales. No se abre `/admin`, ni se añade una ruta de asignación. La página de demo continúa devolviendo 404 fuera de desarrollo. Publicar estos endpoints protegidos no publica usuarios reales ni vuelve productiva la interfaz de demostración.

## Seguridad y límites

- No se confía en `user_metadata`, perfil, email, formulario, filtros o rol enviado por cliente para conceder autoridad. El campo de rol propuesto es un dato a validar, nunca un permiso del operador.
- Se conserva la autorización de servidor y la denegación de visitantes, pacientes, odontólogos sin administración y sesiones sin AAL2. No se devuelven filas ni se consume el cuerpo de una propuesta antes de autorizar.
- Sin Auth Admin, clave `service_role`, migraciones, escritura remota, cuentas reales o asignación de privilegios en esta entrega.
- No se modifica RLS ni se consulta contenido clínico. Administrar no concede acceso a fotografías, consentimientos, solicitudes ajenas o historiales.
- La interfaz local no es una barrera de seguridad; solo representa datos sintéticos, con avisos visibles. La conexión futura a la API deberá transportar el bearer de la sesión existente y manejar 401/403/503 sin repetir autenticación ni guardar tokens en URLs o logs.
- No se certifican MFA, revocación real, integración con Auth Admin o aislamiento RLS productivo. Las limitaciones de DI-150 siguen vigentes. No se modifica funcionalidad de cuenta, directorio, solicitudes o fotografías del equipo.

## Verificaciones realizadas

| Comprobación | Resultado y alcance |
| --- | --- |
| `npm run typecheck` | Aprobado. |
| `npm run build` | Aprobado, Next.js 15.5.28. Incluye las dos rutas dinámicas protegidas y mantiene la demo restringida. |
| `node --experimental-strip-types --test --test-reporter=tap 'src/features/**/*.test.mjs'` | **136 aprobadas, 0 fallidas, 0 omitidas:** 119 anteriores y 17 nuevas. |
| Servicios, 9 pruebas nuevas | Búsqueda, filtros, paginación, proyección mínima, UUID, tipos malformados, roles, campos inesperados, cambios propios, promociones denegadas, ausencia de persistencia, vacío/error y copias aisladas. |
| API + guard DI-150, 8 pruebas nuevas | Consulta/validación autorizada con fixtures AAL2, denegación sin sesión/token inválido/paciente/odontólogo/AAL1 antes del servicio, campos privados excluidos, operador del contexto, JSON/cuerpo acotado, parámetros desconocidos/duplicados y errores mínimos. |
| HTTP, producción local | GET usuarios sin bearer o con rol solo en cabecera: 401; bearer sintético inválido: 401. POST de propuesta sin sesión: 401, sin datos. POST usuarios y PATCH validar: 405. `/api/administracion/roles/asignar`: 404. |
| Bloqueo del panel, producción local | `/desarrollo/panel-admin`, `?demo=1` y `/admin`: 404, sin panel representado. |
| Compatibilidad HTML | `/`, `/cuenta`, `/directorio`, `/fotografias`, `/solicitudes`: 200. No equivale a ejecutar flujos privados contra Supabase real. |
| Chromium aislado, desarrollo | Listado, búsqueda sin coincidencias, filtros combinados, paginación y foco, error/reintento, vacío, propuesta válida sin modificar roles, promoción/autoasignación/UUID inválido rechazados. Menú móvil mediante teclado conserva Escape y retorno de foco. |
| Responsive/accesibilidad automatizada | Sin desbordamiento horizontal de página a 1440, 768, 390 y 320 px; tabla con scroll interno. Axe detectó 0 infracciones WCAG A/AA dentro del panel en los estados revisados. No es una certificación ni prueba con lector de pantalla. |
| Aislamiento del recorrido de demo | 0 errores de ejecución de React, 0 peticiones a Supabase y 0 llamadas a la API administrativa desde la UI local. Un `main` y un `h1`. |
| Dependencias y diff | Sin cambios de dependencias; `git diff --check` aprobado. |

La consulta HTTP con token inválido utilizó Auth real solo para el rechazo de un token sintético sin identidad. Las consultas positivas, roles y propuestas usan fixtures: **no son pruebas de integración real con cuentas Supabase**. No se crearon cuentas, se asignaron privilegios ni se efectuaron consultas de datos reales. El servidor de producción local se inició con `NODE_USE_ENV_PROXY=1` para utilizar el proxy configurado, sin alterar TLS ni credenciales.

Playwright, axe y capturas se utilizaron temporalmente fuera del repositorio, sin añadir dependencias de QA al proyecto. Se ajustaron en el arnés la localización de selects y la espera del foco movido con `requestAnimationFrame`; no eran fallos de la aplicación. La inspección de React comprobó efectos con limpieza de respuestas antiguas y separación de código de servidor. Se reforzó la validación de tipos de los filtros antes de la ejecución final de la suite/build.

## Pendientes para la segunda parte del 02/11

1. Revisar y aceptar el flujo sintético. Completar un adaptador cliente para consumir la API protegida con la sesión existente cuando haya identidades de prueba autorizadas; no confundir la demo local con ese flujo autenticado.
2. Completar las verificaciones reales pendientes de DI-150: administrador AAL2, paciente/odontólogo sin administración, caducidad, retirada/suspensión de rol y sesiones. No aprovisionar personas reales como atajo de QA.
3. Acordar el servicio de listado real (Auth Admin y/o proyección administrativa mínima), aislamiento privilegiado, auditoría y tratamiento de roles persistidos. No intentar listar globalmente `profiles` con el cliente personal ni relajar RLS para conseguirlo.
4. Antes de escrituras reales, definir aprobación independiente, protección de cambios propios/último administrador, concurrencia, auditoría y reautenticación. La gestión completa de asignaciones corresponde al alcance posterior de DI-152; la validación de esta entrega no la sustituye.
5. Repetir pruebas del flujo autenticado y del proveedor real en un entorno controlado, manteniendo las mismas proyecciones, paginación, errores y controles clínicos. Confirmar criterios de aceptación antes de declarar completa DI-151.

## Archivos de la entrega

Modificados:

- `src/features/administracion/PanelAdministrativoDemo.tsx`: reutiliza el nuevo listado en la estructura existente y actualiza los avisos de alcance.
- `src/features/administracion/administracion.module.css`: filtros, tabla desplazable, formulario y paginación.
- `src/features/autorizacion/autorizacion.ts`: solo añade dos acciones explícitas; no cambia las verificaciones de identidad, roles o AAL2.

Nuevos:

- `src/features/administracion/servicios.ts`: tipos, contrato sustituible, proveedor sintético y validaciones.
- `src/features/administracion/api.ts`: consultas/propuestas protegidas, parseo acotado y proyecciones.
- `src/features/administracion/servidor.ts`: ensamblado `server-only` con DI-150.
- `src/features/administracion/UsuariosAdministrativosDemo.tsx`: listado funcional local.
- `src/features/administracion/PropuestaRolDemo.tsx`: revisión local sin aplicar cambios.
- `src/features/administracion/servicios.test.mjs` y `api.test.mjs`: pruebas nuevas con fixtures.
- `src/app/api/administracion/usuarios/route.ts` y `src/app/api/administracion/roles/validar/route.ts`: Route Handlers protegidos.
- `docs/DI-151-administracion-parte1.md`: este documento.

Mensaje autorizado para registrar únicamente la primera parte:

```text
DI-151 feat(admin): incorporar listado simulado y validación de propuestas
```

## Revalidación previa al registro

Se revisaron los 13 archivos de DI-151 y se repitieron `npm run typecheck`, `npm run build`, la suite completa de Node y `git diff --check`: aprobados, con **136 pruebas correctas, 0 fallidas y 0 omitidas**. No se detectaron credenciales, datos clínicos personales ni temporales en la entrega. No hay cambios de dependencias o de módulos personales del equipo.

Los endpoints mantienen autorización de servidor y AAL2 antes de invocar servicios. En el contrato existente de DI-150 solo se registran las dos acciones acotadas de DI-151; no se altera su lógica de identidad, rol o MFA. Los datos llevan origen sintético y las propuestas válidas devuelven `aplicado: false`: no modifican usuarios reales, no asignan privilegios y no cambian siquiera los roles en memoria.

Las pruebas positivas y de denegación con roles/AAL2 siguen utilizando fixtures; no certifican integración productiva. Durante el registro no se repitieron las comprobaciones de navegador/HTTP ni se realizaron consultas o cambios en Supabase. La evidencia de navegador/HTTP anterior corresponde a la implementación, con los límites indicados. Los pendientes de la segunda parte permanecen abiertos: **publicar este avance no completa DI-151**.
