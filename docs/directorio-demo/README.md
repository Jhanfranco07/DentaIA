# Directorio de demostración · Sprint 6

## Alcance y arquitectura

El catálogo `src/features/directorio/catalogo-demo.ts` contiene exactamente 20 identidades inventadas, con UUID y slug estables, nombre, especialidad, descripción, distrito, nombre de punto académico, coordenadas aproximadas y fuente `directorio-demo-2026-11-v1`. No contiene colegiaturas, fotografías, teléfonos, correos, horarios ni disponibilidad. Los nombres y puntos no representan profesionales ni establecimientos verificables.

El modelo existente separa deliberadamente `public.directory_demo_locations` de `public.dentists`, `clinical.clinics`, membresías y `public.dentist_public_locations`. Esta última tabla solo expone ubicaciones publicadas de profesionales **no demo** con membresía verificada y RLS. Por ello, el seed inserta exclusivamente 20 filas en `directory_demo_locations`; el cliente une por `slug` el catálogo estático con los puntos publicados. No se crean cuentas Auth, roles, clínicas ni filas de `dentists`. El directorio y la ficha muestran los perfiles únicamente cuando su punto demo está publicado. Cada ficha y marcador indica que la coordenada es representativa y no ofrece indicaciones de ruta ni solicitud de atención para estos 20 perfiles.

## Generación, carga y limpieza

Desde la raíz del repositorio:

```powershell
node --experimental-strip-types scripts/directorio-demo.mjs check
node --experimental-strip-types scripts/directorio-demo.mjs seed
node --experimental-strip-types scripts/directorio-demo.mjs cleanup
```

El generador valida cantidad, unicidad de identificadores y slugs, campos, siete especialidades, variedad de distritos, coordenadas dentro de Lima y versión de fuente. Genera `supabase/demo-data/seed_directorio_20_sprint6.sql` y `supabase/demo-data/cleanup_directorio_20_sprint6.sql`. Revisar el diff de ambos archivos antes de ejecutarlos.

Solo en una base PostgreSQL **local o de pruebas autorizada** con la migración `20261105223000_directory_demo_locations.sql` aplicada:

```powershell
psql -X -v ON_ERROR_STOP=1 -d dentaia_local -f supabase/demo-data/seed_directorio_20_sprint6.sql
psql -X -v ON_ERROR_STOP=1 -d dentaia_local -f supabase/demo-data/seed_directorio_20_sprint6.sql
psql -X -v ON_ERROR_STOP=1 -d dentaia_local -c "select count(*) from public.directory_demo_locations where slug like 'odontologo-demo-s6-%' and is_demo and is_published;"
psql -X -v ON_ERROR_STOP=1 -d dentaia_local -f supabase/demo-data/cleanup_directorio_20_sprint6.sql
```

El resultado esperado es 20 tras ambas ejecuciones y 0 tras la limpieza. El SQL corre en transacción, detecta colisiones no demo y comprueba la cantidad final. `ON CONFLICT (slug)` actualiza solo filas demo del catálogo. La limpieza requiere simultáneamente slug reservado, `is_demo`, solicitudes deshabilitadas y nombre del punto académico; no afecta al punto demo anterior `clinica-demo-la-molina` ni a datos reales. No ejecutar estos archivos contra Supabase de producción. Una carga remota requiere identificar el destino y autorización expresa.

## Directorio y mapa

Los 20 perfiles se incorporan a la lista y a los filtros existentes por nombre, especialidad y distrito. Cada marcador MapLibre procede de una fila demo publicada, enlaza a la ficha por UUID estable y se oculta al aplicar filtros que excluyan el perfil. El botón «Ver en mapa» selecciona el marcador; en móvil cambia a la pestaña mapa. La ficha usa el mismo punto demo y suprime precios, rutas y solicitudes para estos 20 perfiles. El aviso visible dice: «Perfiles de demostración. No representan profesionales verificados ni consultorios disponibles para atención».

## Pruebas y límites

La prueba `catalogo-demo.test.mjs` verifica las 20 uniones, identificadores únicos, filtros básicos, duplicación de puntos y rechazo de puntos ocultos o alterados. Ejecutar además `npm run typecheck`, `npm run build`, pruebas Node y revisión visual responsive. Registrar por separado pruebas con fixtures y cualquier comprobación en PostgreSQL real. Si la base de datos de un entorno no recibe el seed, estos 20 perfiles no aparecen: el código por sí solo no afirma que los puntos estén publicados. Para incorporar profesionales reales en el futuro se deben usar los flujos de verificación y membresía existentes, sin reutilizar estas identidades ni sus coordenadas.

### Evidencia local de esta entrega

- TypeScript y build de Next.js: correctos.
- Suite Node completa: 457 pruebas aprobadas, 0 fallidas. `npm audit --audit-level=high`: 0 vulnerabilidades.
- Playwright con respuestas Supabase simuladas: lista de 20, filtros de distrito/especialidad/búsqueda, estado vacío, navegación Tab, marcador, ficha y ausencia de desbordamiento en 320, 390, 768, 1024 y 1440 px. Capturas en `evidencia/`. Esto valida la interfaz con fixtures, no una carga remota.
- PostgreSQL 16 en un contenedor aislado `dentaia-demo-s6-pg`: migración existente aplicada; dos ejecuciones del seed devolvieron 20 filas y 20 slugs únicos. La limpieza eliminó las 20; el punto previo `clinica-demo-la-molina` permaneció (1 fila). Estado final del contenedor: 0 puntos del dataset nuevo. No se escribieron datos remotos.


## Centros dentales con dirección pública: candidatos para reemplazar los puntos aproximados

**Estado: investigación documental, NO cargados ni geocodificados.** Los perfiles de personas del catálogo siguen siendo completamente ficticios; no son empleados, integrantes ni profesionales asociados a las siguientes clínicas. La dirección de un centro real es una referencia geográfica independiente. Antes de publicar un punto como ubicación real, contrastar coordenadas con una fuente cartográfica actual, verificar que corresponda al local y conservar la atribución. No sustituir coordenadas de distrito por coordenadas supuestamente exactas.

| N.º | Centro real (sede) | Dirección publicada | Fuente |
| --- | --- | --- | --- |
| 01 | Cerdent San Isidro | Calle Almirante Lord Cochrane 240, San Isidro | [Cerdent](https://cerdentperu.com/sedes/) |
| 02 | Cerdent La Molina | Av. Javier Prado Este 6210, oficina 301, La Molina | [Cerdent](https://cerdentperu.com/sedes/) |
| 03 | Cerdent Los Olivos | Av. Carlos Izaguirre 1122, Los Olivos | [Cerdent](https://cerdentperu.com/sedes/) |
| 04 | Cerdent Jesús María | Av. Sánchez Carrión 615, Jesús María | [Cerdent](https://cerdentperu.com/sedes/) |
| 05 | Cerdent Surco | Calle Los Antares 320, torre A, oficina 801, Santiago de Surco | [Cerdent](https://cerdentperu.com/sedes/) |
| 06 | Cerdent San Borja | Av. San Borja Sur 781, San Borja | [Cerdent](https://cerdentperu.com/sedes/) |
| 07 | Cerdent San Miguel | Av. Parque de las Leyendas 210, oficina 402A, San Miguel | [Cerdent](https://cerdentperu.com/sedes/) |
| 08 | Cerdent Miraflores San Antonio | Av. Benavides 1555, oficina 303, Miraflores | [Cerdent](https://cerdentperu.com/sedes/) |
| 09 | Cerdent Lince | Av. General César Canevaro 116, oficina 301, Lince | [Cerdent](https://cerdentperu.com/sedes/) |
| 10 | Cerdent La Encalada | Jr. Paramonga 311, oficina 201, Santiago de Surco | [Cerdent](https://cerdentperu.com/sedes/) |
| 11 | Resocentro Dental Miraflores | Av. Petit Thouars 4453, Miraflores | [Resocentro](https://www.resocentro.com/Paciente/Sedes) |
| 12 | Resocentro San Isidro | Av. Javier Prado Este 499, San Isidro | [Resocentro](https://www.resocentro.com/Paciente/Sedes) |
| 13 | Resocentro El Polo | Av. El Polo 434, Santiago de Surco | [Resocentro](https://www.resocentro.com/Paciente/Sedes) |
| 14 | Romandent Miraflores | Av. Alfredo Benavides 2921, Miraflores | [Romandent](https://romandent.com.pe/sedes/) |
| 15 | Romandent San Isidro | Av. Augusto Pérez Araníbar 1764, San Isidro | [Romandent](https://romandent.com.pe/sedes/) |
| 16 | MUNIDENT Miraflores | Av. José Larco 742, oficina A, Miraflores | [MUNIDENT](https://munident.com/ubicacion) |
| 17 | MUNIDENT Surco | Jr. Vulcano, Mz. A, lote 15, Urb. La Libertad, Santiago de Surco | [MUNIDENT](https://munident.com/ubicacion) |
| 18 | Clínica Dental BOE | Av. Antonio José de Sucre 161, Pueblo Libre | Ficha pública del establecimiento |
| 19 | Mundoral San Borja | Jr. Simoni 151, San Borja | Ficha pública del establecimiento |
| 20 | Impacto Dental Jesús María | Jr. Huiracocha 1683, Jesús María | Ficha pública del establecimiento |

### Decisión de seguridad y producto
- **No asociar** nombres inventados de odontólogos a clínicas reales como si ejercieran allí: no se ha acreditado esa relación. Un perfil de simulación debe mantener un aviso inequívoco y no ofrecer reservas ni rutas a nombre del profesional ficticio.
- Si se desea mostrar centros reales, modelarlos como establecimientos públicos independientes y mostrar sus fuentes; no trasladar esa información a `clinical.clinics` ni a `public.dentist_public_locations` sin verificación y autorización.
- Mantener los veinte puntos sintéticos vigentes hasta completar verificaciones cartográficas y aprobar una migración de datos compatible con el esquema existente.
- Los íconos de diente del PR sustituyen la palabra visible «DEMO» en los marcadores; **no suprimen el aviso de demostración de fichas y listados**.



## Dataset v2: veinte referencias geográficas documentadas

La versión v2 conserva exactamente veinte personas ficticias y sus UUID/slugs; cambia las ubicaciones a centros dentales con dirección y coordenadas **registradas en fichas que citan RENIPRESS/MINSA**. La fuente consultada es un portal informativo independiente, no una validación oficial o presencial de apertura actual. No atribuir personal ficticio al establecimiento. Esta documentación no certifica capacidad de atención.

| # | Centro de referencia | Dirección publicada | Distrito | Latitud | Longitud | Fuente |
|---|---|---|---|---:|---:|---|
| 01 | Cerdent San Borja | Av. San Borja Sur 781, piso 2 | San Borja | -12.100849 | -76.999601 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/consultorio-medico-cerdent-san-borja/) |
| 02 | Cerdent Jesús María | Av. Faustino Sánchez Carrión 615, of. 303 | Jesús María | -12.089279 | -77.058167 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/consultorio-medico-cerdent-jesus-maria/) |
| 03 | Cerdent La Molina | Av. Javier Prado Este 6210, of. 301 | La Molina | -12.070348 | -76.95249 | [Ficha](https://www.establecimientosdesalud.info/lima-este/centro-odontologico-cerdent-sac-la-molina/) |
| 04 | Romandent Miraflores | Av. Alfredo Benavides 2921 | Miraflores | -12.128138 | -77.005019 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-romandent-eirl-miraflores/) |
| 05 | Romandent San Isidro | Av. Augusto Pérez Araníbar 1764 | San Isidro | -12.106403 | -77.054749 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-romandent-san-isidro/) |
| 06 | Romandent Surco | Jr. El Polo 348 | Santiago de Surco | -12.105931 | -76.973386 | [Ficha](https://www.establecimientosdesalud.info/lima-sur/centro-odontologico-romandent-santiago-de-surco/) |
| 07 | Dental Científica (Universidad Científica del Sur) | Av. Paseo de la República 5514 | Miraflores | -12.119411 | -77.026132 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-de-la-universidad-cientifica-del-sur-dental-cientifica-miraflores/) |
| 08 | Clínica Dental Smile Perfection | Calle Coronel Inclán 235, piso 3, of. 307 | Miraflores | -12.117637 | -77.031481 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/consultorio-medico-clinica-dental-smile-perfection-miraflores/) |
| 09 | Centro Odontológico Universidad Wiener | Av. Arequipa 440-444 | Lima | -12.069504 | -77.037002 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-de-la-universidad-wiener-lima/) |
| 10 | Vital Dent Integral | Av. Salaverry 1071, primer piso | Jesús María | -12.07 | -77.0453 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-integral-vital-dent-sac-jesus-maria/) |
| 11 | Centro Odontológico Americano Primavera | Av. Primavera 643, interior 503 | San Borja | -12.110287 | -76.986509 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-americano-primavera-san-borja/) |
| 12 | Dental Procare | Calle Alcanfores 142, interior 303 | Miraflores | -12.12096 | -77.027807 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-dental-procare-miraflores/) |
| 13 | Bogdent | Jr. Subteniente Alejandro Tirado 318, int. 201 | Lima | -12.074412 | -77.034597 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-bogdent-lima/) |
| 14 | Odontosalud Chorrillos | Av. El Sol 1242, La Campiña | Chorrillos | -12.177811 | -76.997082 | [Ficha](https://www.establecimientosdesalud.info/lima-sur/centro-odontologico-odontosalud-chorrillos/) |
| 15 | Centro Odontológico Americano Los Olivos | Av. Carlos Alberto Izaguirre 1268 | Los Olivos | -11.995633 | -77.080356 | [Ficha](https://www.establecimientosdesalud.info/lima-norte/centro-odontologico-americano-los-olivos-los-olivos/) |
| 16 | Multident Chorrillos | Av. Defensores del Morro 714, interiores 208-209 | Chorrillos | -12.17101 | -77.022508 | [Ficha](https://www.establecimientosdesalud.info/lima-sur/centro-odontologico-multident-chorrillos/) |
| 17 | Centro Especializado en Odontoestomatología | Av. Simón Bolívar 165 | Pueblo Libre | -12.074555 | -77.054864 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-centro-especializado-en-odontoestomatologia-pueblo-libre/) |
| 18 | Dental Max San Miguel | Calle Contisuyo 299, piso 2, int. 202 | San Miguel | -12.071798 | -77.098367 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-dental-max-san-miguel/) |
| 19 | Centro Odontológico Americano El Campillo | Calle Ayarsa de Morales 237 | San Miguel | -12.079831 | -77.079575 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-americano-san-miguel-el-campillo-san-miguel/) |
| 20 | Mueca Lince | Av. Julio César Tello 615 | Lince | -12.086597 | -77.039917 | [Ficha](https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-mueca-lince/) |

**La tabla existente obliga a conservar el literal histórico `public_label = 'DEMO — Clínica ficticia, no ofrece atención real'` por un CHECK.** Es un atributo técnico legado, no descripción fiel de la institución real de referencia. El frontend ya no lo expone en los marcadores. Para modelar formalmente centros reales separados de perfiles ficticios, se necesitaría una migración específica posteriormente, no parte de este cambio.

**Publicación:** ejecutar el nuevo seed transaccional e idempotente SOLO tras revisar el diff, verificar los veinte puntos y autorizar la sustitución de los veinte slugs reservados en producción. El script actualizado de limpieza solo puede eliminar los veinte slugs y nombres aceptados. Mantener siempre sin cambios `clinica-demo-la-molina`.
