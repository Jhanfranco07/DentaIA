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

