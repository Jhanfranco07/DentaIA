import{readFileSync,writeFileSync}from'node:fs';
import{join,dirname}from'node:path';
import{fileURLToPath}from'node:url';
import{command,sql,container,workdir}from'../http_jwt/local.mjs';
const here=dirname(fileURLToPath(import.meta.url)),load=name=>JSON.parse(readFileSync(join(here,name),'utf8'));
// Finaliza la activación de fixtures: únicamente los dos bancos clínicos locales propios.
if(sql("SELECT count(*) FROM pg_namespace WHERE nspname='dentaia_http_qa' AND obj_description(oid,'pg_namespace')='DENTAIA_PHASE4_SYNTHETIC_ONLY';")!=='1')throw new Error('QA_MARKER_REQUIRED');
const source=readFileSync(join(here,'../servicios_clinicos/sql/08_identidad_y_privilegios.sql'),'utf8');
const defaultConfig=/CREATE FUNCTION clinical_service\.configuration\(\) RETURNS jsonb[\s\S]*?\$\$;/.exec(source)?.[0];
if(!defaultConfig?.includes('"enabled":false'))throw new Error('DEFAULT_CONFIG_REQUIRED');
sql(defaultConfig.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
command('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','dentaia_arch_qa_fase5','-Atq','-v','ON_ERROR_STOP=1'],{input:defaultConfig.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION')});
if(sql("SELECT clinical_service.configuration()->>'enabled';")!=='false')throw new Error('CLINICAL_QA_NOT_CLOSED');
// Selecciona exclusivamente configuración no secreta: nunca publica Config.Env completo.
const env=JSON.parse(command('docker',['inspect','--format','{{json .Config.Env}}','supabase_auth_DentaIA-arquitectura-fase2-qa']));
const allowed=['GOTRUE_JWT_EXP','GOTRUE_MFA_TOTP_ENROLL_ENABLED','GOTRUE_MFA_TOTP_VERIFY_ENABLED'];
const config=Object.fromEntries(env.filter(x=>allowed.includes(x.split('=')[0])).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)];}));
const text=readFileSync(join(workdir,'supabase/config.toml'),'utf8'),totp=text.split('[auth.mfa.totp]')[1].split('[')[0];
if(config.GOTRUE_JWT_EXP!=='3600'||config.GOTRUE_MFA_TOTP_ENROLL_ENABLED!=='false'||config.GOTRUE_MFA_TOTP_VERIFY_ENABLED!=='false'||!/enroll_enabled\s*=\s*false/.test(totp)||!/verify_enabled\s*=\s*false/.test(totp))throw new Error('QA_AUTH_NOT_RESTORED');
const query="SELECT json_object_agg(n.nspname||'.'||p.proname,md5(replace(pg_get_functiondef(p.oid),chr(13),''))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='clinical_service' AND p.proname NOT IN ('configuration','workspace')) OR(n.nspname='public' AND p.proname IN ('grant_clinical_access','revoke_clinical_access','get_authorized_clinical_history'));";
const before=JSON.parse(sql(query,'dentaia_arch_qa_fase3')),after=JSON.parse(sql(query));
if(Object.keys(before).some(k=>before[k]!==after[k]))throw new Error('PRIOR_RPC_CHANGED');
const state=JSON.parse(sql("SELECT json_build_object('cuentas',(SELECT count(*) FROM auth.users),'cuentasNoQA',(SELECT count(*) FROM auth.users WHERE raw_app_meta_data->>'qa_http_phase' IS DISTINCT FROM '4'),'factoresTOTP',(SELECT count(*) FROM auth.mfa_factors WHERE factor_type='totp'),'superusuarios',(SELECT count(*) FROM auth.users WHERE raw_app_meta_data->'dentaia'->'roles' @> '[\"superusuario\"]'::jsonb),'odontologos',(SELECT count(*) FROM auth.users WHERE raw_app_meta_data->'dentaia'->'roles' @> '[\"odontologo\"]'::jsonb),'triggersFallo',(SELECT count(*) FROM pg_trigger WHERE tgname IN ('mvp_fail','mvp_admin_fail')),'fotosQAActivas',(SELECT count(*) FROM public.dental_photos WHERE original_filename='qa-backend.png'),'rls',(SELECT bool_and(relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','clinical','dentaia_admin') AND relkind='r'),'sinSelectClinico',NOT has_table_privilege('authenticated','clinical.clinical_encounters','SELECT'),'sinContactoEjecutor',NOT has_column_privilege('dentaia_clinical_executor','public.appointment_requests','contact_email','SELECT'));"));
if(state.cuentas!==6||state.cuentasNoQA||state.factoresTOTP||state.superusuarios!==1||state.odontologos!==2||state.triggersFallo||state.fotosQAActivas||!state.rls||!state.sinSelectClinico||!state.sinContactoEjecutor)throw new Error('UNEXPECTED_QA_FINAL_STATE');
const last=new Map();const attempts=load('INTENTOS_HTTP_MVP.json');attempts.forEach((a,index)=>a.pruebas.forEach(p=>last.set(p.nombre,{...p,intento:index+1,alcance:a.alcance??'integral'})));
const latest=[...last.values()];if(latest.some(x=>!x.aprobada))throw new Error('UNRESOLVED_HTTP_SCENARIO');
const report={fecha:'2026-11-03',clinicaQACerradaAlFinal:true,regresionF4:load('REGRESION_HTTP_F4.json').aprobadas,escenariosMVPUnicos:latest.length,aprobadosMVP:latest.filter(x=>x.aprobada).length,metodo:'Última ejecución real por escenario; no una única batería integral sin fallos. Se conservan todos los intentos y sus fallos.',escenarios:latest,intentos:attempts.map((x,i)=>({numero:i+1,alcance:x.alcance??'integral',aprobadas:x.aprobadas,fallidas:x.fallidas,bloqueo:x.bloqueo??null})),restauracion:{...config,archivoTOTPDesactivado:true,recuperacion:'El wrapper agotó el timeout al reiniciar; se repitió start local sin borrar volúmenes y se verificaron estas variables de Auth. No se atribuye éxito al wrapper fallido.'},estadoFinal:state,funcionesAnterioresIdenticas:Object.keys(before).length,basesAnteriores:[2,3].map(n=>({fase:n,atenciones:Number(sql('SELECT count(*) FROM clinical.clinical_encounters;',`dentaia_arch_qa_fase${n}`))})),produccion:load('PRODUCCION_CERRADA.json'),remoto:false,produccionLista:false};
writeFileSync(join(here,'CIERRE_INTEGRACION.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({mvp:latest.length,regresionF4:report.regresionF4,produccionCerrada:report.produccion.aprobadas,estadoFinal:state,authRestaurado:true}));
