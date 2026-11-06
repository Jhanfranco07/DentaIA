// Generación LOCAL revisable. No abre conexiones remotas ni aplica migraciones.
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { cli, command, assertLocal } from '../http_jwt/local.mjs';

const here=dirname(fileURLToPath(import.meta.url)), arch=dirname(here), root=join(arch,'../..');
const target='vwmdknzjyvmsdqpepykz';
const evidence=JSON.parse(readFileSync(join(here,'CONTROL_DESTINO.json'),'utf8'));
if(evidence.ref!==target || evidence.aprobacionEscriturasRemotas!==false) throw new Error('REVIEW_STATE_REQUIRED');
assertLocal();
const output=join(here,'migraciones'), staging=join(tmpdir(),'DentaIA-fase8-generador');
mkdirSync(output,{recursive:true});mkdirSync(join(staging,'supabase/migrations'),{recursive:true});
writeFileSync(join(staging,'supabase/config.toml'),'project_id = "DentaIA-fase8-generador"\n');
const fingerprint=readFileSync(join(here,'huella_publica.sql'),'utf8').trim().replace(/;$/,'');
const guard=`SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
DO $fase8$ DECLARE signature text; BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'TRUSTED_MIGRATION_OPERATOR_REQUIRED'; END IF;
 IF current_database()='postgres' THEN
  IF current_setting('dentaia.integration_target',true) IS DISTINCT FROM '${target}'
   OR current_setting('dentaia.integration_approval',true) IS DISTINCT FROM 'fase8_final_approved' THEN
   RAISE EXCEPTION 'EXPLICIT_TARGET_AND_FINAL_APPROVAL_REQUIRED'; END IF;
 ELSIF current_database()='dentaia_arch_qa_fase8' THEN
  IF current_setting('dentaia.integration_approval',true) IS DISTINCT FROM 'fase8_local_simulation'
   OR (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM 'DENTAIA_PHASE8_SYNTHETIC_ONLY'
  THEN RAISE EXCEPTION 'LOCAL_SIMULATION_MARKER_REQUIRED'; END IF;
 ELSE RAISE EXCEPTION 'TARGET_DATABASE_NOT_APPROVED'; END IF;
 SELECT f.fingerprint INTO signature FROM (${fingerprint}) f;
 IF signature IS DISTINCT FROM '__EXPECTED_PUBLIC_FINGERPRINT__' THEN RAISE EXCEPTION 'PUBLIC_SCHEMA_DRIFT_ABORT'; END IF;
END $fase8$;
`;

function body(path){
 let s=readFileSync(join(root,path),'utf8').replace(/\r\n/g,'\n');
 s=s.replace(/^\s*BEGIN;\s*$/im,'').replace(/^\s*COMMIT;\s*$/im,'');
 const start=s.search(/DO \$\$ BEGIN/i), ending=start<0?null:/END \$\$;/i.exec(s.slice(start)),end=ending?start+ending.index:-1;
 if(start<0||end<0)throw new Error('SOURCE_GUARD_NOT_FOUND:'+path);
 const block=s.slice(start,end+7);
 if(path.endsWith('08_identidad_y_privilegios.sql')){
  const old="IF current_database() NOT LIKE 'dentaia_arch_qa_%' OR current_setting('dentaia.architecture_draft',true) IS DISTINCT FROM 'qa_only' THEN RAISE EXCEPTION 'DRAFT_TARGET_NOT_ISOLATED'; END IF;";
  if(!s.includes(old))throw new Error('IDENTITY_GUARD_CHANGED');s=s.replace(old,'-- Atestación de destino y huella en la guarda Fase 8 exterior.');
 }else s=s.slice(0,start)+s.slice(end+7);
 if(s.includes("current_setting('dentaia.architecture_draft'"))throw new Error('UNREVIEWED_LOCAL_GUARD');
 return s.trim();
}
const files=[
 ['di36_dentalia_01_administracion',['supabase/migrations/20261103012414_di151_roles_auditoria_atomica.sql']],
 ['di36_dentalia_02_modelo_clinico',[1,2,3,4].map((n)=>'docs/arquitectura/borradores_sql/'+['01_clinical_identidad.sql','02_clinical_contenido.sql','03_clinical_permisos_auditoria.sql','04_clinical_integridad.sql'][n-1])],
 ['di36_dentalia_03_rpc_clinicos',['08_identidad_y_privilegios.sql','09_autorizaciones.sql','10_historial_autorizado.sql'].map(n=>'docs/arquitectura/servicios_clinicos/sql/'+n)],
 ['di36_dentalia_04_workspace',['docs/arquitectura/backend_mvp/20261103195335_di36_servicios_comunes_mvp.sql']],
];
const result={fecha:'2026-11-03',target,estado:'PROPUESTO_NO_APLICADO',fuentesHistoricasSinModificar:true,autodespliegue:false,migraciones:[]};
for(const[name,paths]of files){
 let existing=readdirSync(output).find(n=>n.endsWith('_'+name+'.sql'));
 if(!existing){
  command(cli(),['migration','new',name,'--workdir',staging],{cwd:staging});
  existing=readdirSync(join(staging,'supabase/migrations')).find(n=>n.endsWith('_'+name+'.sql'));
  if(!existing)throw new Error('CLI_FILENAME_REQUIRED');
 }
 const prerequisites=name.includes('_01_')?"IF to_regnamespace('dentaia_admin') IS NOT NULL THEN RAISE EXCEPTION 'ADMIN_SCHEMA_ALREADY_EXISTS'; END IF;":name.includes('_02_')?"IF to_regnamespace('clinical') IS NOT NULL THEN RAISE EXCEPTION 'CLINICAL_SCHEMA_ALREADY_EXISTS'; END IF;":name.includes('_03_')?"IF to_regnamespace('clinical_service') IS NOT NULL THEN RAISE EXCEPTION 'CLINICAL_SERVICE_ALREADY_EXISTS'; END IF;":"IF to_regprocedure('public.get_clinical_workspace(text,uuid,uuid,integer,text)') IS NOT NULL THEN RAISE EXCEPTION 'WORKSPACE_ALREADY_EXISTS'; END IF;";
 const expected=name.includes('_04_')?evidence.huellaPublicaTrasRPC:evidence.huellaPublica;
 if(!/^[a-f0-9]{32}$/.test(expected??''))throw new Error('EXPECTED_STEP_FINGERPRINT_REQUIRED');
 const sql='-- FASE 8: PROPUESTA. Requiere respaldo verificado y aprobación final externa.\n-- No aplicar por db push. GUC de aprobación es una guarda operativa, NO prueba criptográfica del proyecto.\nBEGIN;\n'+guard.replace('__EXPECTED_PUBLIC_FINGERPRINT__',expected)+'DO $$ BEGIN '+prerequisites+' END $$;\n'+paths.map(body).join('\n\n')+'\nCOMMIT;\n';
 writeFileSync(join(output,existing),sql);
 result.migraciones.push({archivo:'docs/arquitectura/integracion_fase8/migraciones/'+existing,sha256:createHash('sha256').update(sql).digest('hex'),fuentes:paths.map(p=>({archivo:p,sha256:createHash('sha256').update(readFileSync(join(root,p))).digest('hex')}))});
}
writeFileSync(join(here,'PAQUETE_PROPUESTO.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({estado:result.estado,migraciones:result.migraciones.map(x=>x.archivo)}));
