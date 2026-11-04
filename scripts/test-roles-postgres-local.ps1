param([switch]$ConfirmarBaseDesechable)
$ErrorActionPreference = 'Stop'
if (-not $ConfirmarBaseDesechable) { throw 'Requiere -ConfirmarBaseDesechable. No admite URL ni credenciales remotas.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migration = Join-Path $repo 'supabase/migrations/20261103012414_di151_roles_auditoria_atomica.sql'
$tests = Join-Path $repo 'supabase/tests'
$nombre = 'dentaia-di151-qa-' + [Guid]::NewGuid().ToString('N').Substring(0,12)
$etiqueta = [Guid]::NewGuid().ToString('N')
& docker version --format '{{.Server.Version}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker no disponible. No se ejecutaron migraciones ni pruebas SQL.' }
function Invoke-FixtureSql([string]$sql) {
  $salida = $sql | & docker exec -i $nombre psql -X -U postgres -v ON_ERROR_STOP=1 -Atq
  if ($LASTEXITCODE -ne 0) { throw 'Fallo SQL en la base desechable. Revisar salida.' }
  return $salida
}
function Invoke-Paralelo([string]$a,[string]$b) {
  $jobs=@()
  try {
    foreach($sql in @($a,$b)) {
      $jobs += Start-Job -ArgumentList $nombre,$sql -ScriptBlock {
        param($container,$consulta)
        $r=$consulta | & docker exec -i $container psql -X -U postgres -v ON_ERROR_STOP=1 -Atq
        if($LASTEXITCODE -ne 0){throw 'Fallo en sesión SQL de QA'}
        $r
      }
    }
    $jobs | Wait-Job -Timeout 30 | Out-Null
    if(@($jobs | Where-Object State -ne 'Completed').Count){throw 'La prueba concurrente no completó correctamente'}
    return @($jobs | Receive-Job -ErrorAction Stop)
  } finally {
    $jobs | Stop-Job -ErrorAction SilentlyContinue
    $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
  }
}
try {
  # Sin puertos publicados, sin red, sin datos reales y sin credenciales del repositorio.
  & docker run --detach --name $nombre --label "dentaia.di151.qa=$etiqueta" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el contenedor desechable' }
  $listo=$false
  for($i=0;$i -lt 30;$i++) {
    & docker exec $nombre pg_isready -U postgres *> $null
    if($LASTEXITCODE -eq 0){$listo=$true;break}
    Start-Sleep -Seconds 1
  }
  if(-not $listo){throw 'PostgreSQL local no inició'}
  foreach($archivo in @((Join-Path $tests 'fixtures-auth-local.sql'),$migration,(Join-Path $tests 'di151-roles.sql'),(Join-Path $tests 'di151-concurrencia-preparar.sql'))) {
    Invoke-FixtureSql (Get-Content -LiteralPath $archivo -Encoding UTF8 -Raw) | Out-Null
  }
  $a="select public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,20),public.qa_id(30))->>'status';"
  $b="select public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,21),public.qa_id(31))->>'status';"
  $r=@(Invoke-Paralelo $a $b | Where-Object {$_ -match '^(200|409)$'} | Sort-Object)
  if(($r -join ',') -ne '200,409'){throw 'Se esperaba un commit y un conflicto de revisión'}
  $igual="select public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(4,22),public.qa_id(32))->>'status';"
  $r=@(Invoke-Paralelo $igual $igual | Where-Object {$_ -match '^(200|409)$'} | Sort-Object)
  if(($r -join ',') -ne '200,200'){throw 'La repetición simultánea no fue idempotente'}
  $conteo=Invoke-FixtureSql "select count(*) from dentaia_admin.auditoria_roles where objetivo_id=public.qa_id(4);"
  if([string]$conteo -ne '1'){throw 'La solicitud duplicada generó auditoría duplicada'}
  $snapshot='''{"version":1,"estado":"activo","roles":["superusuario"]}'''
  $a="select public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(2,23,0,$snapshot) || '{`"operacion`":`"revocar`",`"rol`":`"superusuario`"}',public.qa_id(33))->>'status';"
  $contexto2="jsonb_build_object('actorId',public.qa_id(2),'sesionId',public.qa_id(12),'expira',floor(extract(epoch from clock_timestamp()))::bigint+3600)"
  $b="select public.dentaia_cambiar_roles_v1($contexto2,public.qa_peticion(1,24,0,$snapshot) || '{`"operacion`":`"revocar`",`"rol`":`"superusuario`"}',public.qa_id(34))->>'status';"
  $r=@(Invoke-Paralelo $a $b | Where-Object {$_ -match '^(200|403)$'} | Sort-Object)
  if(($r -join ',') -ne '200,403'){throw 'La pérdida concurrente de autorización no se rechazó'}
  $administradores=Invoke-FixtureSql "select count(*) from auth.users where raw_app_meta_data->'dentaia'->'roles' @> '[`"superusuario`"]'::jsonb;"
  if([string]$administradores -ne '2'){throw 'Invariante de administradores incumplida'}
  Write-Output 'APROBADO: SQL con fixtures locales, rollback, auditoría y dos conexiones concurrentes. No acredita Supabase real.'
} finally {
  # Solo retira el contenedor propio, comprobado por etiqueta aleatoria; ningún volumen del proyecto.
  $propia=& docker inspect --format '{{index .Config.Labels "dentaia.di151.qa"}}' $nombre 2>$null
  if($LASTEXITCODE -eq 0 -and $propia -eq $etiqueta){& docker rm --force --volumes $nombre | Out-Null}
}
