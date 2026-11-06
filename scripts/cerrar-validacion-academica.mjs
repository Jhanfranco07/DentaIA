// Consolida salidas existentes verificadas; no ejecuta migraciones ni modifica datos remotos.
import{readFileSync,writeFileSync,existsSync}from'node:fs';import{join,relative}from'node:path';import{tmpdir}from'node:os';import{createHash}from'node:crypto';
import{root,command,saveReport,ref}from'./academic-private.mjs';
const dir=join(root,'docs/arquitectura'),evidence=join(dir,'integracion_fase8'),read=p=>{const b=readFileSync(p);return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,'');};
const load=name=>JSON.parse(read(join(evidence,name))),ensure=(v,c)=>{if(!v)throw new Error(c);},git=(...a)=>command('git',a,{cwd:root}).toString().trim();
ensure(git('branch','--show-current')==='docs/auditoria-arquitectura-integral','APPROVED_BRANCH_REQUIRED');
const tap=read(join(tmpdir(),'DentaIA-fase8-tests.tap')),counts=Object.fromEntries(['tests','pass','fail','skipped'].map(x=>[x,Number(tap.match(new RegExp('^# '+x+' (\\d+)','m'))?.[1])]));
ensure(counts.tests>=284&&counts.tests===counts.pass&&!counts.fail&&!counts.skipped,'ISOLATED_SUITE_REQUIRED');
const build=read(join(tmpdir(),'DentaIA-fase8-build.log')),types=read(join(tmpdir(),'DentaIA-fase8-academic-typecheck.log'));
ensure(build.includes('Compiled successfully')&&types.includes('tsc --noEmit')&&!/error TS\d+/.test(types),'BUILD_AND_TYPECHECK_REQUIRED');
const audit=JSON.parse(read(join(tmpdir(),'DentaIA-fase8-audit.json'))).metadata.vulnerabilities;ensure(audit.total===0,'DEPENDENCY_AUDIT_REQUIRED');
for(const [file,n]of [['HTTP_ACADEMICO_REAL.json',35],['CUENTAS_RLS_MFA_REALES.json',12],['ACTIVACION_PRUEBAS_LOCALES.json',7],['PRODUCCION_CERRADA.json',8]]){const r=load(file);ensure(r.aprobadas===n&&!r.fallidas&&!r.bloqueo,'EVIDENCE_REQUIRED');}
ensure(load('REVISION_PUBLICACION.json').problemas.length===0,'SECRET_REVIEW_REQUIRED');
const proposal=load('ACTIVACION_PROPUESTA.json'),sql=readFileSync(join(root,proposal.archivo));ensure(createHash('sha256').update(sql).digest('hex')==='df245dfdc87021632aef53581db995cef7e440fc89e85bd25c1575391a013700','APPROVED_ACTIVATION_SHA_REQUIRED');
const state=load('SEGURIDAD_ACADEMICA_REAL.json');ensure(state.rlsTables===19&&state.originalActorsClosed===5&&state.activationVersion==='20261104010757','REMOTE_SECURITY_EVIDENCE_REQUIRED');
saveReport('ACTIVACION_EJECUTADA.json',{fecha:new Date().toISOString(),ref,archivo:proposal.archivo,sha256:proposal.sha256,nombre:'di36_activacion_sintetica_fase8',versionRemota:state.activationVersion,resultado:'APLICADA_Y_VERIFICADA',autorizacion:'Confirmación explícita del responsable para el archivo y SHA-256, recibida antes de ejecutar',contextoEjecucion:'GUC de aprobación exigida por el SQL, establecida en la misma conexión y retirada al finalizar',politicasOPrivilegiosNuevos:false,cuatroMigracionesOriginalesRepetidas:false});
const originals=git('ls-files','docs/evidencias/arquitectura').split('\n').filter(Boolean);ensure(originals.length===38,'FROZEN_EVIDENCE_COUNT');for(const f of originals)ensure(readFileSync(join(root,f)).equals(command('git',['show','HEAD:'+f],{cwd:root})),'FROZEN_EVIDENCE_CHANGED');
const commits=['f6221d9','3576c13','12d54fb','9d4409a','fa841a7','e6f6835','8b36f87','c992a14'];for(const sha of commits)git('merge-base','--is-ancestor',sha,'HEAD');
git('diff','--check');
saveReport('CIERRE_ACADEMICO.json',{fecha:new Date().toISOString(),ref,rama:git('branch','--show-current'),headBaseAntesDelCommit:git('rev-parse','HEAD'),mainObservado:git('rev-parse','origin/main'),suiteAislada:counts,typecheckExit:0,buildExit:0,buildLogSha256:createHash('sha256').update(build).digest('hex'),npmAudit:audit,httpNextRemoto:35,sdkRlsMfaRemoto:12,configuracionSqlLocal:7,produccionCerrada:8,originalesCongeladosConservados:38,commitsAdministrativosConservados:commits,rolesRealesModificadosEnPruebas:false,di151Modificado:false,datosSoloSinteticos:true,secretosDetectados:0,diffCheck:true,pr19:'OPEN_DRAFT_SIN_MERGE',limites:['Sin prueba visual de interfaces','Sin fallos artificiales de auditoría remota','Sin nueva fotografía remota','POST grant validado por replay 200, no alta 201','Concesiones expiran 24h tras siembra','Entrega privada de passwords al equipo pendiente','No validado para uso clínico real']});
// Manifiesto de las fuentes/evidencias versionables, excluye su propio contenido.
const files=git('ls-files','--cached','--others','--exclude-standard','docs/arquitectura').split('\n').filter(Boolean),manifest={};
for(const f of [...new Set(files)].sort()){const key=relative(dir,join(root,f)).replaceAll('\\','/');if(key==='MANIFEST_SHA256.json'||!existsSync(join(root,f)))continue;manifest[key]=createHash('sha256').update(readFileSync(join(root,f))).digest('hex');}
writeFileSync(join(dir,'MANIFEST_SHA256.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({suite:counts,httpRemoto:35,sdkRemoto:12,sqlLocal:7,produccionCerrada:8,originales:38,commitsAdmin:8,archivosEnManifest:Object.keys(manifest).length}));
