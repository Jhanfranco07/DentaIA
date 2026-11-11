param([switch]$ConfirmarBaseDesechable)
$ErrorActionPreference = 'Stop'
if (-not $ConfirmarBaseDesechable) { throw 'Requiere -ConfirmarBaseDesechable. Solo ejecuta SQL en un contenedor local aislado.' }

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$nombre = 'dentaia-demo-qa-' + [Guid]::NewGuid().ToString('N').Substring(0,12)
$etiqueta = [Guid]::NewGuid().ToString('N')
$base = 'dentaia_demo_qa'
$imagen = 'postgis/postgis:17-3.6'

function Invoke-SqlDesechable([string]$sql) {
  $salida = & docker exec $nombre psql -X -U postgres -d $base -v ON_ERROR_STOP=1 -Atq -c $sql
  if ($LASTEXITCODE -ne 0) { throw 'Falló una consulta SQL auxiliar en PostgreSQL local desechable.' }
  return $salida
}

function Invoke-ArchivoSqlDesechable([string]$archivo) {
  & docker cp $archivo "${nombre}:/tmp/dentaia-demo-fixture.sql" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar el fixture al contenedor aislado.' }
  & docker exec $nombre psql -X -U postgres -d $base -v ON_ERROR_STOP=1 -f /tmp/dentaia-demo-fixture.sql
  if ($LASTEXITCODE -ne 0) { throw "Falló el fixture local: $(Split-Path -Leaf $archivo)" }
}

& docker version --format '{{.Server.Version}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker no está disponible.' }
& docker pull $imagen *> $null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo obtener la imagen local PostGIS 17; no se contactó Supabase.' }

try {
  & docker run --detach --name $nombre --label "dentaia.demo.qa=$etiqueta" --network none --tmpfs /var/lib/postgresql/data:rw,size=2g -e POSTGRES_HOST_AUTH_METHOD=trust $imagen | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL/PostGIS local.' }
  $listo = $false
  for ($i = 0; $i -lt 90; $i++) {
    $registroInicio = (& docker logs $nombre 2>&1 | Out-String)
    if ($registroInicio.Contains('PostgreSQL init process complete; ready for start up.')) {
      & docker exec $nombre pg_isready -U postgres *> $null
      if ($LASTEXITCODE -eq 0) { $listo = $true; break }
    }
    Start-Sleep -Seconds 1
  }
  if (-not $listo) { throw 'PostgreSQL local no inició a tiempo.' }
  & docker exec $nombre createdb -U postgres $base
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base desechable de pruebas.' }

  $versionPostgres = Invoke-SqlDesechable "select current_setting('server_version_num');"
  Write-Output "PostgreSQL aislado: $($versionPostgres -join ' | ')"
  $archivos = @(
    (Join-Path $repo 'supabase/tests/fixtures/directorio-local-base.sql'),
    (Join-Path $repo 'supabase/migrations/20261105210643_add_dentist_locations_and_reviews.sql'),
    (Join-Path $repo 'supabase/migrations/20261105223000_directory_demo_locations.sql'),
    (Join-Path $repo 'supabase/demo-data/seed_clinica_demo_la_molina.sql'),
    (Join-Path $repo 'supabase/tests/directory-demo-locations-local.sql')
  )
  foreach ($archivo in $archivos) {
    if (-not (Test-Path -LiteralPath $archivo)) { throw "No existe el archivo SQL local: $archivo" }
    Write-Output "Ejecutando fixture aislado: $(Split-Path -Leaf $archivo)"
    Invoke-ArchivoSqlDesechable $archivo
    if ($archivo.EndsWith('directorio-local-base.sql')) {
      $versionPostgis = Invoke-SqlDesechable "select extensions.postgis_full_version();"
      Write-Output "PostGIS aislado: $($versionPostgis -join ' | ')"
    }
  }
  Write-Output 'APROBADO: migración, semilla idempotente, lectura pública DEMO, denegación de escrituras, aislamiento de asociaciones y limpieza en base desechable. No se utilizó Supabase remoto.'
} catch {
  & docker inspect --format 'Estado del contenedor QA: {{.State.Status}} / {{.State.ExitCode}}' $nombre 2>$null
  & docker logs $nombre 2>$null
  throw
} finally {
  $propia = & docker inspect --format '{{index .Config.Labels "dentaia.demo.qa"}}' $nombre 2>$null
  if ($LASTEXITCODE -eq 0 -and $propia -eq $etiqueta) { & docker rm --force --volumes $nombre | Out-Null }
}
