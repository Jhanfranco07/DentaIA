[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$container = 'supabase_db_DentaIA'
$expected = @(
  @{ name='20261103235358_di36_dentalia_01_administracion.sql'; hash='8f5117d6040e6db4190e9e66cd2198bb26f62d6da96065521e51bc505a7c8181' },
  @{ name='20261103235408_di36_dentalia_02_modelo_clinico.sql'; hash='19c3253d3b4655e3a812a1740fb8757071dcdab7a2d6d7b812478ea3648cb6f1' },
  @{ name='20261103235409_di36_dentalia_03_rpc_clinicos.sql'; hash='c32fb15e0d7e774d322a1fcf019a5b35d1317ce8b9ba43895d028fe5f36f4eb9' },
  @{ name='20261103235411_di36_dentalia_04_workspace.sql'; hash='12cdef6a52dd03821a53aa295ead67b6cf39f7c97ad1f5ad0b6a0d6f176156ad' }
)
$sourceDir = Join-Path $root 'docs\arquitectura\integracion_fase8\migraciones'
if ((docker ps --format '{{.Names}}') -notcontains $container) { throw 'LOCAL_SUPABASE_CONTAINER_REQUIRED' }
if ((docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $container) -notmatch '^172\.') { throw 'LOCAL_DOCKER_DESTINATION_REQUIRED' }
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('dentaia-di36-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$completed = $false
try {
  docker exec $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "comment on database postgres is 'DENTAIA_PHASE8_SYNTHETIC_ONLY'" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'DI36_LOCAL_MARKER_FAILED' }
  foreach ($entry in $expected) {
    $name = $entry.name
    $source = Join-Path $sourceDir $name
    if ((Get-FileHash $source -Algorithm SHA256).Hash.ToLower() -ne $entry.hash) { throw "DI36_HASH_MISMATCH:$name" }
    $sql = (Get-Content -Raw $source).Replace("`r`n", "`n")
    $old = "IF current_database()='postgres' THEN`n  IF current_setting('dentaia.integration_target',true) IS DISTINCT FROM 'vwmdknzjyvmsdqpepykz'`n   OR current_setting('dentaia.integration_approval',true) IS DISTINCT FROM 'fase8_final_approved' THEN`n   RAISE EXCEPTION 'EXPLICIT_TARGET_AND_FINAL_APPROVAL_REQUIRED'; END IF;"
    $new = "IF current_database()='postgres' THEN`n  IF current_setting('dentaia.integration_approval',true) IS DISTINCT FROM 'fase8_local_simulation'`n   OR (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM 'DENTAIA_PHASE8_SYNTHETIC_ONLY' THEN`n   RAISE EXCEPTION 'LOCAL_QA_APPROVAL_REQUIRED'; END IF;"
    if (-not $sql.Contains($old)) { throw "DI36_GUARD_NOT_FOUND:$name" }
    $adapted = $sql.Replace($old, $new)
    $target = Join-Path $tmp $name
    $log = Join-Path $tmp ($name + '.log')
    [IO.File]::WriteAllText($target, $adapted, [Text.UTF8Encoding]::new($false))
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = "set dentaia.integration_approval='fase8_local_simulation';`n$adapted" |
      docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - 2>&1
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorAction
    $output | Tee-Object -FilePath $log
    if ($exitCode -ne 0) { throw "DI36_APPLY_FAILED:${name}:exit=$exitCode:diagnostic=$log" }
  }
  $completed = $true
} finally {
  if ($completed) {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  } else {
    Write-Warning "DI36_DIAGNOSTICS_PRESERVED:$tmp"
  }
}
