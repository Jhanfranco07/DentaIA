import { writeFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { command,sql,status,container } from './local.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const query="SELECT json_object_agg(n.nspname||'.'||p.proname,md5(replace(pg_get_functiondef(p.oid),chr(13),''))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='clinical_service' AND p.proname<>'configuration') OR(n.nspname='public' AND p.proname IN ('grant_clinical_access','revoke_clinical_access','get_authorized_clinical_history'));";
const before=JSON.parse(sql(query,'dentaia_arch_qa_fase3')),after=JSON.parse(sql(query));
const changed=Object.keys(before).filter(k=>before[k]!==after[k]);if(changed.length)throw new Error('RPC_SOURCE_CHANGED');
const envs=JSON.parse(command('docker',['inspect','--format','{{json .Config.Env}}','supabase_auth_DentaIA-arquitectura-fase2-qa']));
const expiry=Number(envs.find(x=>x.startsWith('GOTRUE_JWT_EXP=')).split('=')[1]);if(expiry!==3600)throw new Error('AUTH_EXPIRY_NOT_RESTORED');
const local=status();
const d={node:process.version,docker:command('docker',['info','--format','{{.ServerVersion}}']).trim(),postgresql:sql("SELECT current_setting('server_version');"),apiLocal:local.url,jwtExpiryRestaurada:expiry,
 cuentasSinteticas:Number(sql("SELECT count(*) FROM auth.users WHERE raw_app_meta_data->>'qa_http_phase'='4';")),cuentasNoPropias:Number(sql("SELECT count(*) FROM auth.users WHERE raw_app_meta_data->>'qa_http_phase' IS DISTINCT FROM '4';")),
 fuentesRPCIdenticasFase3:changed.length===0,funcionesComparadas:Object.keys(before).length,
 atencionesFase2:Number(sql('SELECT count(*) FROM clinical.clinical_encounters;','dentaia_arch_qa_fase2')),atencionesFase3:Number(sql('SELECT count(*) FROM clinical.clinical_encounters;','dentaia_arch_qa_fase3')),
 triggersFalloTemporales:Number(sql("SELECT count(*) FROM pg_trigger WHERE tgname='http_qa_failure';")),
 propietarioPrivadoMinimo:sql("SELECT bool_and(proowner='dentaia_clinical_executor'::regrole AND prosecdef) FROM pg_proc WHERE pronamespace='clinical_service'::regnamespace AND proname IN ('grant_access','revoke_access','read_history');")==='t',
 clientesSinSelectClinico:sql("SELECT NOT has_table_privilege('authenticated','clinical.clinical_encounters','SELECT') AND NOT has_table_privilege('authenticated','clinical.clinical_access_audit','SELECT');")==='t',
 wrappers:JSON.parse(sql("SELECT json_agg(r) FROM(SELECT proname,prosecdef,pg_get_userbyid(proowner) AS owner FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('grant_clinical_access','revoke_clinical_access','get_authorized_clinical_history'))r;")),
 contenedores:command('docker',['ps','--format','{{.Names}} {{.Status}}']).trim().split('\n'),credencialesGuardadas:false};
if(d.cuentasNoPropias||d.triggersFalloTemporales||d.wrappers.some(x=>x.prosecdef)||!d.propietarioPrivadoMinimo||!d.clientesSinSelectClinico)throw new Error('UNSAFE_LOCAL_FINAL_STATE');
writeFileSync(join(here,'ENTORNO_VALIDADO.json'),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({jwtExpiry:expiry,cuentas:d.cuentasSinteticas,fuentesRPCComparadas:d.funcionesComparadas,cambiosRPC:changed.length,triggersFallo:d.triggersFalloTemporales}));
