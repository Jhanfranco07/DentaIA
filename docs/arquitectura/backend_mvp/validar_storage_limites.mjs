import{createClient}from'@supabase/supabase-js';
import{randomUUID,randomBytes}from'node:crypto';
import{writeFileSync}from'node:fs';
import{dirname,join}from'node:path';
import{fileURLToPath}from'node:url';
import{status,sql}from'../http_jwt/local.mjs';
const outputDir=process.argv.includes('--fase7')?join(dirname(fileURLToPath(import.meta.url)),'../qa_fase7'):dirname(fileURLToPath(import.meta.url));
const here=dirname(fileURLToPath(import.meta.url)),r={fecha:'2026-11-03',remoto:false,pruebas:[]};
const c=status(),options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(c.url,c.admin,options),client=createClient(c.url,c.anon,options);let consent;
try{
 if(sql("SELECT count(*) FROM auth.users WHERE raw_app_meta_data->>'qa_http_phase' IS DISTINCT FROM '4';")!=='0')throw new Error('UNOWNED_ACCOUNT');
 const users=(await admin.auth.admin.listUsers({perPage:1000})).data.users,u=users.find(x=>x.app_metadata.qa_http_actor==='patient1'),other=users.find(x=>x.app_metadata.qa_http_actor==='patient2');
 const password=randomBytes(24).toString('base64url')+'Aa9!';if((await admin.auth.admin.updateUserById(u.id,{password})).error)throw new Error('FIXTURE_PASSWORD');
 if((await client.auth.signInWithPassword({email:u.email,password})).error)throw new Error('LOCAL_LOGIN');
 consent=randomUUID();const x=await client.from('patient_consents').insert({id:consent,user_id:u.id,purpose:'academic_photo_storage',policy_version:'QA-LIMITES',consent_text:'Almacenamiento academico sintetico exclusivamente QA'});if(x.error)throw new Error('CONSENT');
 for(const test of [
  {nombre:'Bucket rechaza MIME fuera de JPG/PNG/WebP',path:u.id+'/'+consent+'/'+randomUUID()+'.txt',body:Buffer.from('QA'),mime:'text/plain'},
  {nombre:'Bucket rechaza archivo de mas de 8 MiB',path:u.id+'/'+consent+'/'+randomUUID()+'.png',body:Buffer.alloc(8388609),mime:'image/png'},
  {nombre:'RLS de Storage rechaza carga en carpeta de otro usuario',path:other.id+'/'+consent+'/'+randomUUID()+'.png',body:Buffer.from('QA'),mime:'image/png'},
 ]){
  const result=await client.storage.from('dental-photos').upload(test.path,test.body,{contentType:test.mime});
  if(!result.error){await client.storage.from('dental-photos').remove([test.path]);throw new Error('UNEXPECTED_UPLOAD_ALLOWED');}
  r.pruebas.push({nombre:test.nombre,aprobada:true,codigo:Number(result.error.statusCode??result.error.status)||'denegado'});
 }
}catch(e){r.bloqueo=e.message;process.exitCode=1;}
finally{
 if(consent){const cleanup=await client.from('patient_consents').update({revoked_at:new Date().toISOString()}).eq('id',consent).select('id');r.consentimientoQARevocado=!cleanup.error&&cleanup.data.length===1;}
 r.aprobadas=r.pruebas.length;writeFileSync(join(outputDir,'STORAGE_LIMITES.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));
}
