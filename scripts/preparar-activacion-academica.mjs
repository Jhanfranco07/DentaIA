// Preparación LOCAL únicamente. Aplicación remota requiere autorización adicional.
import{mkdirSync,readFileSync,writeFileSync,readdirSync}from'node:fs';
import{join}from'node:path';import{tmpdir}from'node:os';import{createHash}from'node:crypto';
import{readVault,root,ref,dataset,saveReport}from'./academic-private.mjs';
import{cli,command}from'../docs/arquitectura/http_jwt/local.mjs';
import{academicConfiguration}from'./academic-activation-sql.mjs';
const v=readVault();if(!v.seedCommitted)throw new Error('VERIFIED_DATASET_REQUIRED');
const dir=join(root,'docs/arquitectura/integracion_fase8/activacion'),temp=join(tmpdir(),'DentaIA-fase8-activacion');mkdirSync(dir,{recursive:true});mkdirSync(join(temp,'supabase/migrations'),{recursive:true});writeFileSync(join(temp,'supabase/config.toml'),'project_id = "DentaIA-fase8-activacion"\n');
const name='di36_activacion_sintetica_fase8';let filename=readdirSync(dir).find(x=>x.endsWith('_'+name+'.sql'));
if(!filename){command(cli(),['migration','new',name,'--workdir',temp],{cwd:temp});filename=readdirSync(join(temp,'supabase/migrations')).find(x=>x.endsWith('_'+name+'.sql'));}
const ids=v.accounts.map(x=>x.id),literal=ids.map(x=>"'"+x+"'").join(',');
const sql=`-- PROPUESTA: NO APLICADA. Solo configuration(), sin RLS/GRANT ni cambios de usuarios.
BEGIN; SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('dentaia.academic_activation_approval',true) IS DISTINCT FROM '${ref}:${dataset}' THEN RAISE EXCEPTION 'EXPLICIT_ACADEMIC_APPROVAL_REQUIRED'; END IF;
 IF (SELECT count(*) FROM auth.users WHERE id=ANY(ARRAY[${literal}]::uuid[]) AND raw_app_meta_data->'dentaia_development'->>'dataset'='${dataset}')<>5 THEN RAISE EXCEPTION 'FIVE_SYNTHETIC_ACTORS_REQUIRED'; END IF;
 IF has_function_privilege('anon','clinical_service.configuration()','EXECUTE') OR has_function_privilege('authenticated','clinical_service.configuration()','EXECUTE') THEN RAISE EXCEPTION 'UNSAFE_CONFIGURATION_ACL';END IF;
END $$;
${academicConfiguration(ids,v.resources)}
COMMIT;
`;
writeFileSync(join(dir,filename),sql);saveReport('ACTIVACION_PROPUESTA.json',{fecha:'2026-11-03',ref,estado:'PENDIENTE_AUTORIZACION_ADICIONAL',archivo:'docs/arquitectura/integracion_fase8/activacion/'+filename,sha256:createHash('sha256').update(sql).digest('hex'),modifica:['clinical_service.configuration()'],rolesOPoliticasNuevas:false,usuariosExistentesModificados:false,actoresPermitidos:ids,dataset});console.log(JSON.stringify({propuesta:filename,sha256:createHash('sha256').update(sql).digest('hex'),aplicada:false}));
