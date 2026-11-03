// Solo epílogo de bancos locales. No acepta URLs, nombres de bases o secretos externos.
import{readFileSync,writeFileSync}from'node:fs';
import{join,dirname}from'node:path';
import{fileURLToPath}from'node:url';
import{sql,command,container}from'../http_jwt/local.mjs';
const here=dirname(fileURLToPath(import.meta.url));
if(sql("SELECT count(*) FROM pg_namespace WHERE nspname='dentaia_http_qa' AND obj_description(oid,'pg_namespace')='DENTAIA_PHASE4_SYNTHETIC_ONLY';")!=='1')throw new Error('QA_MARKER_REQUIRED');
const text=readFileSync(join(here,'../servicios_clinicos/sql/08_identidad_y_privilegios.sql'),'utf8');
const source=/CREATE FUNCTION clinical_service\.configuration\(\) RETURNS jsonb[\s\S]*?\$\$;/.exec(text)?.[0];
if(!source?.includes('"enabled":false'))throw new Error('CLOSED_DEFAULT_REQUIRED');
sql(source.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
command('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','dentaia_arch_qa_fase5','-Atq','-v','ON_ERROR_STOP=1'],{input:source.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION')});
const disabled=sql("SELECT clinical_service.configuration()->>'enabled';")==='false';
const mvpDisabled=command('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','dentaia_arch_qa_fase5','-Atq'],{input:"SELECT clinical_service.configuration()->>'enabled';"}).trim()==='false';
const env=JSON.parse(command('docker',['inspect','--format','{{json .Config.Env}}','supabase_auth_DentaIA-arquitectura-fase2-qa']));
const expiry=env.find(x=>x.startsWith('GOTRUE_JWT_EXP='))?.split('=')[1];
const result={fecha:'2026-11-03',remoto:false,clinicaHttpDesactivada:disabled,clinicaMvpDesactivada:mvpDisabled,jwtExpiry:Number(expiry),basesAnteriores:[2,3].map(n=>({fase:n,atenciones:Number(sql('SELECT count(*) FROM clinical.clinical_encounters;',`dentaia_arch_qa_fase${n}`))})),sinUsuariosAjenos:sql("SELECT count(*) FROM auth.users WHERE raw_app_meta_data->>'qa_http_phase' IS DISTINCT FROM '4';")==='0'};
writeFileSync(join(here,process.argv.includes('--fase7')?'../qa_fase7/QA_CERRADO.json':'QA_CERRADO.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
if(!disabled||!mvpDisabled||expiry!=='3600'||!result.sinUsuariosAjenos)process.exitCode=1;
