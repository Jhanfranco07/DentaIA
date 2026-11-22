# Búsqueda BM25 en DentAI

## Auditoría previa a los cambios

| Ruta o módulo | Responsable | Fuente | Campos | Filtros vigentes | Implementación previa | Tipo | Integración |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/directorio`, `/panel/odontologos` | `DirectorioLista` | Supabase `dentists`, sedes verificadas, reseñas publicadas y referencias de demostración. Las fichas ficticias viven en código. | Nombre y especialidad. | Distrito y especialidad exactos, radio opcional, orden por nombre, cercanía o calificación, referencias del mapa. | Descarga de perfiles activos y relaciones. `includes` en el cliente sobre nombre o especialidad. Sin paginación propia. | Mixta | Corpus público compartido, ponderación de nombre, especialidad, servicios publicados, descripción y distrito. Páginas ordenadas en PostgreSQL. |
| Especialidades del directorio | `DirectorioLista`, enlaces de navegación y fichas de perfil | Especialidad textual registrada en cada perfil. | Valor exacto de especialidad. | Selector y accesos rápidos en el panel del paciente. | Igualdad de la opción seleccionada. | Estructurada | Conservar igualdad. Incluir la especialidad en el texto de los perfiles. |
| `/buenas-practicas`, `/paciente/buenas-practicas` | `BuenasPracticas` en la primera ruta. La segunda es una página de recomendaciones con enlaces. | `GUIAS_BUCALES`, seis guías estáticas. | Título, descripción y pasos. | Tema. | `includes` y orden editorial en el carrusel. | Mixta en `/buenas-practicas` | Índice invertido pequeño construido una vez en memoria. Aplicar tema y mantener el orden editorial al limpiar el texto. |
| `/solicitudes` y resumen de `/panel` | `MisSolicitudes`, `obtenerMisSolicitudes` | Supabase `appointment_requests` de demostración y nombre visible de `dentists`. | Profesional, contacto, mensaje y fecha preferida. El resumen compacto no tiene caja de texto. | Estado de solicitud; identidad del propietario; solo solicitudes demo. | Lectura del historial propio por RLS, seguida de `includes`; el resumen corta a tres. | Mixta | Corpus por propietario, búsqueda y paginación en Supabase. Fecha ISO exacta como valor estructurado. Buscar el mensaje dentro de la sesión autorizada sin persistir sus términos. |
| `/administracion`, `/api/administracion/usuarios/reales` | `UsuariosAdministrativos`, `crearProveedorUsuariosReales`, `crearLecturasSupabase` | Supabase Auth Admin + `profiles`. | Nombre y UUID. | Rol, estado de cuenta y tamaño 5/10/20. | El endpoint autorizado escanea hasta 2.000 cuentas, obtiene los perfiles por lotes y aplica `includes`, orden UUID y paginación. | Mixta | Consultar el índice de nombres en servidor para texto. UUID completo exacto. Preservar el contrato, los filtros y la autorización administrativa. |
| Tabla administrativa demo y `/api/administracion/usuarios` | `UsuariosAdministrativosDemo`, `crearProveedorAdministrativoSimulado` | Cuentas sintéticas predefinidas. | Alias y UUID. | Rol, estado, escenario demo y paginación. | `includes` en el proveedor compartido. | Mixta | Índice BM25 reutilizado para alias y UUID completo exacto. |
| Reserva, vinculación, sedes, MFA y cambios de rol | `FormularioSolicitud`, `GestorVinculaciones`, `GestorUbicaciones`, `CambioRolesLocal`, `DesafioMfaAdministrativo`, `MfaAdminLocal` | Opciones autorizadas de Supabase o listas fijas. | Identificadores de odontólogo, clínica, factor, cuenta y rol; fecha/hora. | Elegibilidad y opciones dependientes. | Selectores HTML, fechas e identificadores exactos. | Estructurada | Mantener los controles y su semántica. |
| `/profesional`, `/api/professional/*`, `/api/clinical/*` | `ProfesionalDemo`, `ProfesionalClinico`, `clinica-http` | Datos sintéticos o API clínica filtrada por autorización. | UUID, estado, membresía, cursor y límites. | Acceso clínico y filtros estructurados de cada lectura. | Selectores, GET parametrizados y paginación por cursor. | Estructurada | Mantener consultas y permisos. |
| Perfiles, servicios y moderación | `DentistaDetalle`, `ServiciosPublicados`, `MisServicios`, `ModeracionResenas` | Supabase, por perfil, propietario o rol administrativo. | UUID, publicación y estado. | Visibilidad y relaciones; listados de gestión. | Consultas exactas y controles de publicación. | Estructurada | Los servicios activos alimentan el texto público del perfil. Mantener las pantallas de gestión. |

La landing enlaza al directorio. Los parámetros de retorno, la resolución de perfiles por UUID y la geolocalización del navegador tampoco ejecutan búsqueda textual. Las migraciones previas carecen de RPC de relevancia léxica y las llamadas a Supabase usan principalmente proyecciones y filtros exactos.

## Arquitectura y ranking

| Alternativa evaluada | Decisión para DentAI |
| --- | --- |
| Extensión BM25 en PostgreSQL administrado | El catálogo de extensiones de Supabase no documenta `pg_search` ni `pg_textsearch`. El proyecto DentAI no figuraba en la conexión Supabase disponible para comprobar extensiones instaladas. [Catálogo de extensiones](https://supabase.com/docs/guides/database/extensions) |
| Motor de búsqueda externo | La integración documentada de ParadeDB usa otra instancia y replicación lógica. Eso agrega despliegue, sincronización y una capa de autorización para datos privados. [Integración de ParadeDB](https://supabase.com/partners/paradedb) |
| Motor propio en el PostgreSQL actual | Usa tablas B-tree, funciones SQL y los mecanismos de autorización existentes. Los cambios de los datos y el índice se confirman en la misma transacción. La aplicación sigue usando Supabase. |

La migración mantiene por corpus el número de documentos, la longitud total, la frecuencia documental de cada término y los postings con la frecuencia en cada documento. La consulta recupera los postings de hasta 12 términos únicos y suma sus contribuciones BM25. Para cada término, `IDF = ln(1 + (N - df + 0,5) / (df + 0,5))`. La contribución es `IDF × TF × (k1 + 1) / (TF + k1 × (1 - b + b × L / Lmedia))`. La frecuencia ponderada suma ocurrencias por peso de campo. La longitud usa ocurrencias sin ponderar. `k1 = 1,2` y `b = 0,75` se ajustan en `dentaia_search.bm25` y en la configuración del índice TypeScript para colecciones estáticas. [Robertson y Zaragoza, 2009](https://doi.org/10.1561/1500000019)

PostgreSQL usa Unicode NFKC, minúsculas, normalización de vocales acentuadas y el diccionario español para palabras vacías y flexión. Se conservan la eñe y los números. El mapeo léxico incluye `ortodoncista → ortodoncia` y `odontopediatra → odontopediatría`. Las colecciones estáticas usan un analizador pequeño en TypeScript con normalización Unicode, palabras vacías explícitas y plural regular. Los términos completos reciben puntuación. Los buscadores no generan coincidencias semánticas. [Diccionarios de búsqueda de PostgreSQL](https://www.postgresql.org/docs/current/textsearch-dictionaries.html)

- **Directorio**. Nombre 3, especialidad 2,5, servicios publicados 2, descripción pública 1 y distrito 1. Las referencias demo usan la dirección geográfica de las fichas estáticas. Las sedes verificadas de Supabase se consultan en vivo para mapa y radio, ya que su visibilidad también puede cambiar por el vencimiento de una membresía. Reseñas y coordenadas de sedes se hidratan solo para la página devuelta. Con texto, el orden elegido desempata después de BM25. Sin texto, el orden elegido es el principal. El mapa muestra los perfiles de la página activa. Al activar cercanía o radio, el navegador envía las coordenadas necesarias como parámetros de la consulta.
- **Solicitudes**. El nombre visible del odontólogo y el nombre de contacto se indexan por propietario. Un mensaje puede contener información clínica. El RPC analiza los mensajes del propietario solo durante la consulta y suma su contribución BM25, con estadísticas separadas para ese campo. El mensaje, sus términos y sus estadísticas quedan fuera del índice persistente. La fecha `AAAA-MM-DD` se compara como fecha; el estado se filtra antes de paginar. El resumen compacto pide tres filas.
- **Administración**. El corpus real guarda únicamente términos de `profiles.full_name`. La búsqueda requiere todos los términos del nombre y usa el UUID completo de forma exacta, incluso para cuentas sin perfil. Los estados y roles se derivan de Auth en la misma consulta. La ruta conserva autorización de superusuario activo, AAL2 y factor verificado. Sin texto conserva la lectura administrativa existente. El alias demo usa la misma fórmula con un índice en memoria.
- **Guías**. Las seis guías se indexan una vez, con prioridad de títulos sobre descripción y pasos. El tema limita los candidatos y el carrusel conserva el orden editorial al limpiar la consulta.

## Migración, despliegue y reconstrucción

1. Revisa [la migración versionada](../supabase/migrations/20261122153246_bm25_search.sql) en local o staging. Requiere las migraciones existentes de DentAI, incluidas las tablas de servicios, sedes, reseñas y referencias.
2. Revisa el plan con `supabase db push --remote=<referencia-de-staging> --dry-run --skip-vault`. Aplica las migraciones en staging antes de desplegar la aplicación. Usa el procedimiento de aprobación de DentAI para producción.
3. Verifica el directorio con una sesión visitante, las solicitudes con dos pacientes y la administración con su credencial privada existente y una sesión AAL2 autorizada. La funcionalidad usa las variables de Supabase actuales y el opt-in administrativo existente.

La migración inicializa el índice. Los triggers de `dentists`, `dentist_services`, `appointment_requests` y `profiles` actualizan los documentos afectados. `dentaia_search.postings` usa la clave `(scope, term, id)` para recuperar candidatos y el índice `(scope, id)` para actualizarlos. Las tablas de términos y corpus tienen claves por alcance. Solicitudes añade índices parciales por propietario y fecha. El esquema `dentaia_search` queda fuera de los esquemas expuestos y sus tablas tienen RLS. Las entradas públicas de directorio y solicitudes son `SECURITY INVOKER`. El wrapper de usuarios concede ejecución solo a `service_role` y delega en una función privada que proyecta los campos autorizados de Auth.

Para recalcular tras un cambio de tokenización, pesos o catálogo, ejecuta `select dentaia_search.rebuild();` con el rol propietario de la migración. La operación adquiere bloqueos de escritura sobre las tablas fuente durante el backfill y publica el resultado en una transacción. Programa esa operación en una ventana de baja actividad. Las fichas ficticias versionadas se proyectan a `dentaia_search.directory_demo`. Si cambia `catalogo-demo.ts` o `qa-preview.ts`, versiona su proyección SQL en una nueva migración y ejecuta la reconstrucción en esa misma transacción. El índice de reseñas y la elegibilidad de sedes siguen las tablas y políticas existentes.

Los clientes limitan la longitud, esperan 280 ms al escribir y abortan las solicitudes obsoletas. Los RPC validan filtros, tamaño y número de página. La navegación llega a la página 1.000. Los RPC establecen un plazo de 3 segundos para directorio y solicitudes y de 4 segundos para administración. El directorio muestra fichas demo identificadas si falla el catálogo publicado. Solicitudes y administración muestran un estado de error y permiten reintentar. [Plazos por función en Supabase](https://supabase.com/docs/guides/database/postgres/timeouts)

### Archivos de implementación y verificación

| Área | Archivos |
| --- | --- |
| Motor y transporte | `supabase/migrations/20261122153246_bm25_search.sql`, `src/lib/supabase/database.types.ts`, `src/lib/busqueda/{bm25.ts,useConsultaEstable.ts}` |
| Directorio, guías y solicitudes | `src/features/directorio/{busqueda.ts,DirectorioLista.tsx}`, `src/features/buenas-practicas/BuenasPracticas.tsx`, `src/features/solicitudes/{solicitudes.ts,MisSolicitudes.tsx}` |
| Administración | `src/features/administracion/{api-usuarios-reales.ts,usuarios-reales.ts,lecturas-supabase.ts,pagina-usuarios-reales.ts,cliente.ts,cliente-panel-real.ts,servicios.ts,UsuariosAdministrativos.tsx,UsuariosAdministrativosDemo.tsx,validacion-lectura.ts}` |
| Pruebas nuevas | `src/lib/busqueda/bm25.test.ts`, `supabase/tests/{bm25-environment.mjs,fixtures/bm25-search.sql}`, `scripts/{test-bm25-postgres.mjs,qa-bm25.mjs}` |
| Pruebas actualizadas | `src/features/administracion/lecturas-supabase.test.mjs`, `src/features/directorio/portal-paciente.test.mjs`, `src/features/solicitudes/solicitudes-premium.test.mjs` |

## Pruebas

Vitest y Node pueden ejecutarse con las dependencias del repositorio. Las pruebas de base y Chromium usan PostgreSQL aislado en PGlite con usuarios y perfiles ficticios. PGlite es una dependencia exclusiva de la prueba local, instalada fuera del proyecto.

Validación local de la rama. TypeScript y la compilación de Next.js finalizaron correctamente. Pasaron 96 pruebas de Vitest, 543 de Node y 7 de PostgreSQL. Playwright validó los flujos del directorio a 390 y 1.280 px, el directorio del paciente, las solicitudes, las guías, la tabla administrativa y los rechazos de acceso, con cero errores inesperados de consola. La compilación mostró advertencias de Autoprefixer en hojas de estilo existentes.

```powershell
npm.cmd run typecheck
npm.cmd test
$archivos = rg --files src -g '*.test.mjs'
node --experimental-strip-types --test $archivos

$qa = Join-Path $env:TEMP 'dentaia-bm25-qa'
npm.cmd install --prefix $qa --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.4.6
$env:DENTAIA_PGLITE_MODULE = Join-Path $qa 'node_modules/@electric-sql/pglite/dist/index.js'
node --experimental-strip-types --test scripts/test-bm25-postgres.mjs
```

Para Playwright, inicia Next.js en una terminal con las credenciales ficticias siguientes. En otra terminal, configura `DENTAIA_PGLITE_MODULE` como arriba y ejecuta `node scripts/qa-bm25.mjs`. El navegador redirige las peticiones de Supabase a las funciones PostgreSQL del fixture. La prueba de tabla administrativa simula el transporte autorizado y usa el RPC real en PostgreSQL. La denegación del endpoint de Next.js se prueba con una petición directa sin sesión.

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://bm25-fixtures.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fixture'
npm.cmd run dev -- --hostname 127.0.0.1 --port 3045
```

### Relevancia en el fixture

Cinco consultas sobre 24 perfiles visibles. Se reprodujo la coincidencia previa de texto completo por subcadena en nombre o especialidad y se comparó con BM25 sobre el mismo catálogo.

| Métrica | Anterior | BM25 |
| --- | ---: | ---: |
| Precision@5 | 0,080 | 0,320 |
| Recall@10 | 0,400 | 1,000 |
| MRR | 0,400 | 0,900 |
| nDCG@10 | 0,400 | 0,936 |

En 40 llamadas locales al RPC en PGlite, p50 fue 5,02 ms y p95 fue 5,47 ms. El dato mide la llamada local con sus filtros y proyección. Falta una medición de extremo a extremo en staging con un catálogo representativo. Las consultas a mensajes libres recorren el historial del usuario activo, por lo que su costo aumenta con ese historial.
