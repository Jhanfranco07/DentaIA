# DI-172 — Preparación de validación

Estado: **pruebas preparadas; RLS real y navegador no ejecutados**. No se instalaron herramientas, no se inició Supabase/Next, no se aplicó la migración ni se usó un servicio remoto.

## Hallazgo previo a correcciones

La migración define `patient_routine_completions.patient_id` con FK a `auth.users(id)`. Se retiró de [database.types.ts](../src/lib/supabase/database.types.ts) la metadata incorrecta `referencedRelation: "users"`: no hay tabla `public.users` en los tipos públicos y esta FK apunta al esquema `auth`. La FK SQL y las políticas no se modificaron.

El cliente usa `upsert(..., ignoreDuplicates: true)` sobre la clave paciente/actividad/fecha. El test SQL cubre tanto el conflicto único directo como esa semántica de idempotencia. La política de inserción valida `auth.uid()`, el rol/estado del JWT, la fecha Lima y la vigencia de la versión.

## Prueba real de RLS — solo Supabase local

Archivo preparado: [di172_rutinas_rls.sql](../supabase/tests/di172_rutinas_rls.sql).

El archivo utiliza `pgTAP`, claims sintéticos y `SET ROLE` para ejecutar las políticas PostgreSQL con dos identidades paciente, una cuenta autenticada sin rol paciente y el rol `anon`. Crea sus filas dentro de una transacción y termina con `ROLLBACK`. No genera JWT firmados ni prueba el flujo HTTP de GoTrue; verifica las políticas RLS reales y los privilegios en PostgreSQL.

Cobertura preparada:

- RLS activado en las tres tablas, FK compuesta y unicidad diaria.
- Lectura del catálogo publicado; catálogo no publicado invisible y no editable por pacientes.
- Inserción de actividad propia vigente, rechazo de `patient_id` elegido por cliente y acceso anónimo denegado.
- Aislamiento de lectura y borrado entre pacientes A y B; lectura propia e historial.
- Conflicto único, repetición idempotente y desmarcado propio del día.
- Rechazo de fechas pasadas/futuras, planes futuros/vencidos y versión sustituida; conservación de la fila histórica vinculada a su plan.
- Aceptación de la versión vigente y conversión de los dos instantes alrededor de medianoche UTC a `America/Lima`.
- Lecturas vacías y escritura denegada para una cuenta sin rol paciente.

### Requisitos para ejecutar

Docker Engine accesible, Supabase CLI `3.0.0` (versión fijada en la guía local del repositorio), Node/npm y descarga de imágenes oficiales. Docker, CLI y PostgreSQL cliente no están disponibles en el entorno actual. `supabase/config.toml` no existe en el repositorio.

Cuando se autorice instalar/arrancar el entorno, crear un proyecto temporal nuevo y sin vincular desde la raíz del repositorio. El siguiente procedimiento copia **solo** la migración y el test DI-172; no copia el resto de migraciones ni los tests SQL del equipo:

```powershell
$repo = (Get-Location).Path
$qa = Join-Path $env:TEMP ("di172-rutinas-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $qa | Out-Null
Push-Location $qa
npx.cmd --yes supabase@3.0.0 init
New-Item -ItemType Directory -Force .\supabase\migrations, .\supabase\tests | Out-Null
Copy-Item "$repo\supabase\migrations\20261116090000_di172_rutinas.sql" .\supabase\migrations\
Copy-Item "$repo\supabase\tests\di172_rutinas_rls.sql" .\supabase\tests\
npx.cmd --yes supabase@3.0.0 start --exclude realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npx.cmd --yes supabase@3.0.0 db reset --local
npx.cmd --yes supabase@3.0.0 test db --local
Pop-Location
```

El nombre aleatorio da un proyecto/volumen separado. `db reset --local` es destructivo para ese stack temporal, que solo contiene DI-172. No ejecutar `supabase link`, `supabase login`, `--linked`, `--remote` ni `--db-url`; inspeccionar la línea `Target` de CLI antes de continuar. Los comandos `db reset --local` y `test db --local` se documentan explícitamente como destino local; Supabase CLI ejecuta `test db` sobre PostgreSQL local y usa pgTAP ([referencia CLI](https://supabase.com/docs/reference/cli/introduction), [reset local](https://supabase.com/docs/reference/cli/supabase-db-reset)).

La prueba SQL usa el rol propietario local solo para insertar fixtures en `auth.users` y en el catálogo. Las operaciones bajo prueba cambian a `authenticated`/`anon` con claims sintéticos. No necesita claves de producción ni clave `service_role` en el navegador. Todas las cuentas y filas son sintéticas y se revierten al acabar.

### Resultados esperados

`supabase test db --local` debe terminar con `ok` para `di172_rutinas_rls.sql`, sin errores TAP ni SQL. Las marcas, planes y cuentas sintéticas no deben permanecer después de la transacción. Una falla de la prueba cuenta como hallazgo; no se debe editar la migración para hacerla pasar sin revisión.

La conversión de instantes fijos prueba la semántica de zona horaria; la aceptación/rechazo RLS usa el día Lima calculado por la misma transacción. No equivale a congelar el reloj de PostgreSQL ni a validar un JWT firmado justo en el instante de cambio de fecha.

## Prueba visual — fixture sintético con APIs interceptadas

Archivo preparado: [qa-di172-rutinas-visual.py](../scripts/qa-di172-rutinas-visual.py). Usa el patrón del harness visual existente, pero solo permite Next en loopback, intercepta el host ficticio `ux-fixtures.supabase.co` y aborta cualquier otro host externo. Emplea un usuario y marcas sintéticos. El token de fixture no es un JWT firmado: este recorrido **no prueba Auth real ni RLS**.

Escenarios preparados: `contenido` (navegación, marca/desmarca, progreso, historial, teclado), `vacio` y `error` (reintento). Cada escenario inspecciona cinco anchos (320, 390, 768, 1024 y 1440 px); contenido captura además móvil/escritorio en temas claro y oscuro. El script verifica desbordamiento, actividades, porcentaje derivado de marcas, historial de solo lectura y tamaño táctil básico.

Requisitos pendientes: Python, Playwright Python y Chrome/Chromium local. No están instalados; el harness no se ha ejecutado. No agregué dependencias al proyecto. Tras autorizar esa preparación, iniciar Next en una terminal con configuración ficticia:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://ux-fixtures.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fixture'
npm.cmd run dev -- --hostname 127.0.0.1 --port 3180
```

En otra terminal, con Python/Playwright y un navegador local ya disponibles, usar un directorio temporal nuevo para las capturas:

```powershell
$salida = Join-Path $env:TEMP ("di172-visual-" + [guid]::NewGuid().ToString("N"))
py -3 scripts/qa-di172-rutinas-visual.py --browser 'C:\ruta\a\chrome.exe' --output $salida --scenario contenido
py -3 scripts/qa-di172-rutinas-visual.py --browser 'C:\ruta\a\chrome.exe' --output "$salida-vacio" --scenario vacio
py -3 scripts/qa-di172-rutinas-visual.py --browser 'C:\ruta\a\chrome.exe' --output "$salida-error" --scenario error
```

Las capturas y `resultado.json` van fuera del repositorio. El modo `contenido` prueba la interfaz contra fixtures interceptados, no persistencia real. La experiencia con dos sesiones Auth locales reales requiere una fase E2E adicional después de habilitar Supabase local; no debe sustituirse por cuentas del proyecto configurado de Jhan.

## Estado de ejecución

| Verificación | Estado actual |
|---|---|
| Preparar SQL para RLS con cuatro contextos | Preparada; no ejecutada |
| Aplicar migración DI-172 en Supabase local | Pendiente: no hay Docker/CLI y no se aplicó SQL |
| Consultas/inserciones/eliminaciones con políticas reales | Pendientes |
| Interfaz visual móvil/escritorio y temas | Harness preparado; no ejecutado |
| Auth HTTP con JWT firmado y dos sesiones | Pendiente; no cubierto por mocks/claims SQL |
| QA remoto | No identificado ni autorizado; no usar el proyecto configurado sin confirmación de Jhan |

No se modificó la migración ni el código de aplicación. No se instalaron dependencias, iniciaron servicios, crearon cuentas, ejecutaron migraciones ni se tocaron Supabase remoto, Jira, main o módulos ajenos a DI-172.
