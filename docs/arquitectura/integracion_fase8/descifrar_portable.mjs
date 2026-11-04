// Recuperación portable con Node.js, sin DPAPI ni APIs de Windows para descifrar.
// La clave son 32 bytes aleatorios; no usar contraseñas directamente como clave.
import { createDecipheriv,createHash } from 'node:crypto';
import { readFileSync,writeFileSync,mkdirSync,existsSync } from 'node:fs';
import { resolve,join,basename } from 'node:path';
import { execFileSync } from 'node:child_process';

function decrypt(envelope,key){
 if(envelope.header?.format!=='DENTAIA-PORTABLE-v1'||envelope.header.algorithm!=='AES-256-GCM'||key.length!==32)throw new Error('INVALID_FORMAT_OR_KEY');
 const nonce=Buffer.from(envelope.nonce,'base64'),tag=Buffer.from(envelope.tag,'base64');
 if(nonce.length!==12||tag.length!==16)throw new Error('INVALID_NONCE_OR_TAG');
 const decipher=createDecipheriv('aes-256-gcm',key,nonce);
 decipher.setAAD(Buffer.from(JSON.stringify(envelope.header)));decipher.setAuthTag(tag);
 // No devolver plaintext antes de verificar el tag mediante final().
 const bytes=Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]);
 const data=JSON.parse(bytes.toString('utf8'));
 if(!Array.isArray(data.files)||!data.files.length)throw new Error('EMPTY_PAYLOAD');
 const seen=new Set();
 for(const file of data.files){
  if(!/^[a-zA-Z0-9_.-]+$/.test(file.name)||file.name!==basename(file.name)||seen.has(file.name))throw new Error('INVALID_ARCHIVE_PATH');
  seen.add(file.name);
  const raw=Buffer.from(file.data,'base64');
  if(createHash('sha256').update(raw).digest('hex')!==file.sha256)throw new Error('CONTENT_HASH_MISMATCH');
 }
 return data;
}
try{
 let data,key;
 if(process.argv.includes('--stdin-private-pipe')||process.argv.includes('--verify-only')){
  let input='';for await(const chunk of process.stdin)input+=chunk;
  const request=JSON.parse(input);key=Buffer.from(request.key,'base64');data=decrypt(request.envelope,key);key.fill(0);
  if(process.argv.includes('--verify-only'))console.log(JSON.stringify({ok:true,files:data.files.length}));
  else {if(process.stdout.isTTY)throw new Error('PRIVATE_PIPE_REQUIRED');process.stdout.write(JSON.stringify(data));}
 }else{
  const value=n=>{const i=process.argv.indexOf(n);if(i<0||!process.argv[i+1])throw new Error('ARGUMENT_REQUIRED');return process.argv[i+1];};
  const envelope=JSON.parse(readFileSync(value('--bundle'),'utf8'));key=readFileSync(value('--key'));
  data=decrypt(envelope,key);key.fill(0);
  const destination=resolve(value('--output'));
  if(existsSync(destination))throw new Error('NEW_PRIVATE_DIRECTORY_REQUIRED');
  mkdirSync(destination,{mode:0o700});
  if(process.platform==='win32'){
   const sid=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,stdio:['pipe','pipe','pipe']}).toString().trim();
   if(!/^S-1-5-[\d-]+$/.test(sid))throw new Error('PRIVATE_ACL_REQUIRED');
   execFileSync('icacls.exe',[destination,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  }
  for(const file of data.files)writeFileSync(join(destination,file.name),Buffer.from(file.data,'base64'),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({ok:true,files:data.files.length,warning:'Private plaintext recovery directory; never add to Git or share.'}));
 }
}catch(error){
 // Nunca propagar input, claves, contenido, errores de biblioteca o detalles personales.
 const code=/^[A-Z_]+$/.test(error.message??'')?error.message:'AUTH_OR_FORMAT_ERROR';
 console.error('PORTABLE_RECOVERY_FAILED:'+code);process.exitCode=2;
}
