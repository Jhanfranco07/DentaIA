// Revisión local sin imprimir valores: compara secretos configurados con cambios y bundles.
import{readFileSync,readdirSync,statSync,existsSync}from'node:fs';import{join,relative}from'node:path';import{loadEnvFile}from'node:process';
import{command,readVault,root,saveReport}from'./academic-private.mjs';
loadEnvFile(join(root,'.env.local'));
if(existsSync(join(root,'.env.development.local')))loadEnvFile(join(root,'.env.development.local'));
const v=readVault(),secrets=v.accounts.flatMap(x=>[x.password,x.totpSecret].filter(Boolean));
for(const [key,value]of Object.entries(process.env))if(/^(DENTAIA_.*(?:SECRET|TOKEN|PASSWORD)|SUPABASE_SERVICE_ROLE_KEY)$/.test(key)&&value&&value.length>=16)secrets.push(value);
if(existsSync(join(root,'.env.backup.local'))){loadEnvFile(join(root,'.env.backup.local'));const value=process.env.DENTAIA_BACKUP_DATABASE_URL;if(value){secrets.push(value);const pwd=decodeURIComponent(new URL(value).password);if(pwd.length>=8)secrets.push(pwd);}}
const files=command('git',['ls-files','-m','--others','--exclude-standard','-z'],{cwd:root}).toString().split('\0').filter(Boolean),issues=[];
for(const file of files){if(/(^|\/)\.env(?:\.|$)|\.(?:dpapi|dump|key|p12|pfx|zip)$/i.test(file))issues.push({archivo:file,tipo:'archivo_privado'});const text=readFileSync(join(root,file),'utf8');if(secrets.some(x=>text.includes(x)))issues.push({archivo:file,tipo:'valor_secreto_configurado'});if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]{20,}/.test(text))issues.push({archivo:file,tipo:'clave_privada_literal'});}
let bundles=0;function visit(dir){if(!existsSync(dir))return;for(const name of readdirSync(dir)){const file=join(dir,name);if(statSync(file).isDirectory())visit(file);else{bundles++;const text=readFileSync(file,'utf8');if(secrets.some(x=>text.includes(x)))issues.push({archivo:relative(root,file),tipo:'secreto_en_bundle_cliente'});}}}visit(join(root,'.next/static'));
const result={fecha:new Date().toISOString(),archivosRevisados:files.length,bundlesClienteRevisados:bundles,secretosComparadosSinImprimir:secrets.length,problemas:issues,credencialesFueraDeGit:true,limitacion:'Comparación literal de secretos conocidos y patrones; requiere además revisión humana del diff.'};saveReport('REVISION_PUBLICACION.json',result);console.log(JSON.stringify(result));if(issues.length)process.exitCode=1;
