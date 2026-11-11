import{randomBytes,randomUUID}from'node:crypto';
import{clients,hasVault,readVault,writeVault,dataset,ref,saveReport,sqlRemote}from'./academic-private.mjs';
const definitions=[['paciente_a','fase8-paciente-a@dentaia.test','paciente','Paciente Demo A'],['paciente_b','fase8-paciente-b@dentaia.test','paciente','Paciente Demo B'],['odontologo_a','fase8-odontologo-a@dentaia.test','odontologo','Odontologo Demo A'],['odontologo_b','fase8-odontologo-b@dentaia.test','odontologo','Odontologo Demo B'],['administrador_qa','fase8-admin@dentaia.test','superusuario','Administrador Demo']];
const report={fecha:'2026-11-03',ref,dataset,cuentas:[],confirmacion:'Administrativa individual, solo cuentas .test; no prueba de correo',globalAuthModificado:false};let vault;
try{
 if(!process.argv.includes('--crear-cinco-autorizadas'))throw new Error('EXPLICIT_FIVE_ACCOUNT_AUTHORIZATION_REQUIRED');
 const c=clients(),listed=await c.admin.auth.admin.listUsers({page:1,perPage:1000});if(listed.error)throw new Error('AUTH_ADMIN_READ_FAILED');
 vault=hasVault()?readVault():{ref,dataset,batchId:randomUUID(),accounts:definitions.map(([alias,email,role,name])=>({alias,email,role,name,password:randomBytes(32).toString('base64url')+'Aa9!',id:null})),resources:{}};
 if(vault.ref!==ref||vault.dataset!==dataset||vault.accounts.length!==5)throw new Error('UNOWNED_CREDENTIAL_VAULT');
 for(const a of vault.accounts){const existing=listed.data.users.find(u=>u.email===a.email);if(existing&&(!a.id||existing.id!==a.id||existing.app_metadata.dentaia_development?.dataset!==dataset))throw new Error('EXISTING_ACCOUNT_COLLISION');}
 // Garantizar almacenamiento cifrado y lectura correcta ANTES de crear la primera cuenta.
 writeVault(vault);
 if(!vault.baseline){const names=['public.profiles','public.dentists','public.appointment_requests','public.patient_consents','public.dental_photos','auth.users','storage.objects'];vault.baseline=JSON.parse(sqlRemote("SELECT jsonb_build_object("+names.map(t=>"'"+t+"',(SELECT jsonb_build_object('ids',coalesce(jsonb_agg(id ORDER BY id),'[]'),'digest',md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'')),'count',count(*)) FROM "+t+" x)").join(',')+");"));writeVault(vault);}
 for(const a of vault.accounts){
  if(!a.id){const created=await c.admin.auth.admin.createUser({email:a.email,password:a.password,email_confirm:true,app_metadata:{dentaia:{version:1,estado:'activo',roles:[a.role]},dentaia_development:{dataset,alias:a.alias}},user_metadata:{full_name:a.name}});if(created.error||!created.data.user)throw new Error('ACCOUNT_CREATE_FAILED');a.id=created.data.user.id;writeVault(vault);}
  const check=await c.admin.auth.admin.getUserById(a.id);if(check.error||check.data.user.app_metadata.dentaia_development?.dataset!==dataset||check.data.user.app_metadata.dentaia.roles.join(',')!==a.role)throw new Error('ACCOUNT_VERIFICATION_FAILED');
  const sdk=c.user(),login=await sdk.auth.signInWithPassword({email:a.email,password:a.password});if(login.error||!login.data.session)throw new Error('ACCOUNT_REAL_LOGIN_FAILED');
  const claims=await sdk.auth.getClaims(login.data.session.access_token);if(claims.error||claims.data.claims.sub!==a.id)throw new Error('ACCOUNT_JWT_VERIFICATION_FAILED');
  report.cuentas.push({alias:a.alias,email:a.email,id:a.id,rol:a.role,confirmada:!!check.data.user.email_confirmed_at,loginReal:true,jwtVerificado:true});
 }
 report.aprobadas=report.cuentas.length;report.credenciales='DPAPI fuera de Git, ACL usuario actual/SYSTEM; sin contraseñas/tokens en informe';
}catch(e){report.error=/^[A-Z_]+$/.test(e.message??'')?e.message:'PRIVATE_PROVISIONING_FAILED';process.exitCode=1;}
finally{saveReport('CUENTAS_ACADEMICAS_REALES.json',report);console.log(JSON.stringify({creadasYVerificadas:report.cuentas.length,error:report.error??null,secretosPublicados:false}));}
