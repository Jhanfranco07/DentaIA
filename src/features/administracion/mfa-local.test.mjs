import test from 'node:test';
import assert from 'node:assert/strict';
import { crearFlujoMfaLocal, esperaCaducidadSesion } from './mfa-local.ts';

// Todos los usuarios, factores, códigos y HTTP de este archivo son fixtures sin red.
function preparar({permitir=false,verificados=false,nivel='aal1',http=403}={}) {
  let actor='actor-fixture';let aal=nivel;
  let lista=verificados?[{id:'factor-fixture',status:'verified',factor_type:'totp'}]:[];
  const llamadas=[];
  const auth={
    getUser:async()=>({data:{user:actor?{id:actor,aud:'authenticated',is_anonymous:false,confirmed_at:'2026-11-01T00:00:00Z',email:'no-publicar'}:null},error:null}),
    getSession:async()=>({data:{session:{access_token:'token-fixture-no-publicar',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:actor}}},error:null}),
    mfa:{
      listFactors:async()=>({data:{all:lista},error:null}),
      getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal,nextLevel:'aal2'},error:null}),
      enroll:async()=>{
        llamadas.push('enroll');lista=[{id:'factor-fixture',status:'unverified',factor_type:'totp'}];
        return {data:{id:'factor-fixture',type:'totp',totp:{qr_code:'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"></svg>',secret:'secreto-fixture-no-publicar',uri:'uri-fixture-no-publicar'}},error:null};
      },
      challengeAndVerify:async entrada=>{
        llamadas.push(['challengeAndVerify',entrada]);
        aal='aal2';lista=[{id:'factor-fixture',status:'verified',factor_type:'totp'}];
        return {data:{access_token:'token-renovado-no-publicar'},error:null};
      },
    },
  };
  const solicitar=async(ruta,init)=>{
    llamadas.push(['fetch',ruta,init]);
    return Response.json(http===200?{autorizado:true}:{error:'Acceso denegado.'},{status:http});
  };
  const flujo=crearFlujoMfaLocal(()=>auth,permitir,solicitar);
  return {flujo,auth,llamadas,cambiarActor:v=>{actor=v;},establecerFactores:v=>{lista=v;}};
}

test('MFA local: consulta no muta y AAL2 informativo no concede administración',async()=>{
  const p=preparar({nivel:'aal2',verificados:true,http:403});
  const r=await p.flujo.consultar();assert.equal(r.nivel,'aal2');assert.equal(r.accesoHTTP,403);
  assert.equal(p.llamadas.length,1);
  const [_,ruta,init]=p.llamadas[0];assert.equal(ruta,'/api/administracion/acceso');
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
  assert.equal(init.headers.Authorization,'Bearer token-fixture-no-publicar');
  assert.doesNotMatch(JSON.stringify(r),/"actor-fixture"|token-fixture-no-publicar|"email"|"secret"|"uri"/);
});

test('MFA local: bandera y consentimiento se requieren antes de cualquier mutación',async()=>{
  for(const [permitir,acepta] of [[false,false],[false,true],[true,false]]) {
    const p=preparar({permitir});
    await assert.rejects(()=>p.flujo.iniciarEnrolamiento(acepta),e=>e.codigo==='BLOQUEADO');
    await assert.rejects(()=>p.flujo.verificar('factor-fixture','123456',acepta),e=>e.codigo==='BLOQUEADO');
    assert.equal(p.llamadas.length,0);
  }
});

test('MFA local: identidad ausente o no confirmada no enrola ni consulta el endpoint',async()=>{
  for(const user of [null,{id:'x',aud:'authenticated',is_anonymous:true,confirmed_at:'fecha'},
    {id:'x',aud:'authenticated',is_anonymous:false}]) {
    const p=preparar({permitir:true});p.auth.getUser=async()=>({data:{user},error:null});
    await assert.rejects(()=>p.flujo.consultar(),e=>e.codigo==='SIN_SESION');
    await assert.rejects(()=>p.flujo.iniciarEnrolamiento(true),e=>e.codigo==='SIN_SESION');
    assert.equal(p.llamadas.length,0);
  }
});

test('MFA local: enrolamiento explícito proyecta solo QR aislado y factor ID, sin secret/uri/sesión',async()=>{
  const p=preparar({permitir:true});const r=await p.flujo.iniciarEnrolamiento(true);
  assert.deepEqual(Object.keys(r),['factorId','qr']);assert.match(r.qr,/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  assert.doesNotMatch(JSON.stringify(r),/secreto-fixture|uri-fixture|token-fixture-no-publicar|"actor-fixture"/);
  await assert.rejects(()=>p.flujo.iniciarEnrolamiento(true),e=>e.codigo==='FACTOR_EXISTENTE');
  assert.equal(p.llamadas.filter(v=>v==='enroll').length,1);
});

test('MFA local: preferir challenge de factor verificado, no enrolar duplicados',async()=>{
  const p=preparar({permitir:true,verificados:true,http:200});
  await assert.rejects(()=>p.flujo.iniciarEnrolamiento(true),e=>e.codigo==='FACTOR_EXISTENTE');
  const r=await p.flujo.verificar('factor-fixture','123456',true);
  assert.equal(r.nivel,'aal2');assert.equal(r.accesoHTTP,200);
  assert.equal(p.llamadas.filter(v=>v==='enroll').length,0);
  assert.deepEqual(p.llamadas[0],['challengeAndVerify',{factorId:'factor-fixture',code:'123456'}]);
});

test('MFA local: factor pendiente creado aquí se verifica legítimamente sin cambiar roles',async()=>{
  const p=preparar({permitir:true,http:403});await p.flujo.iniciarEnrolamiento(true);
  const r=await p.flujo.verificar('factor-fixture','123456',true);
  assert.equal(r.nivel,'aal2');assert.equal(r.accesoHTTP,403);
  assert.equal(p.auth.admin,undefined);
});

test('MFA local: código inválido y factor ajeno se rechazan',async()=>{
  const p=preparar({permitir:true,verificados:true});
  for(const codigo of ['12345','abcdef','1234567','123 45']) await assert.rejects(()=>p.flujo.verificar('factor-fixture',codigo,true),e=>e.codigo==='CODIGO_INVALIDO');
  await assert.rejects(()=>p.flujo.verificar('factor-ajeno','123456',true),e=>e.codigo==='FACTOR_NO_ADMITIDO');
  assert.equal(p.llamadas.length,0);
});

test('MFA local: retomar un pendiente propio ya escaneado tras recargar exige challenge real del SDK',async()=>{
  const p=preparar({permitir:true,http:200});p.establecerFactores([{id:'factor-fixture',status:'unverified',factor_type:'totp'}]);
  const previo=await p.flujo.consultar();assert.deepEqual(previo.factoresPendientes,[{id:'factor-fixture'}]);
  const r=await p.flujo.verificar('factor-fixture','123456',true);
  assert.equal(r.nivel,'aal2');assert.equal(r.accesoHTTP,200);
  assert.equal(p.llamadas.filter(v=>v==='enroll').length,0);
  assert.equal(p.llamadas.filter(v=>v[0]==='challengeAndVerify').length,1);
});

test('MFA local: una identidad distinta no verifica el factor pendiente anterior',async()=>{
  const p=preparar({permitir:true});await p.flujo.iniciarEnrolamiento(true);p.cambiarActor('otro-actor');
  await assert.rejects(()=>p.flujo.verificar('factor-fixture','123456',true),e=>e.codigo==='FACTOR_NO_ADMITIDO');
  assert.equal(p.llamadas.length,1);
});

test('MFA local: errores SDK sensibles no se propagan y no hay reintento automático',async()=>{
  const p=preparar({permitir:true,verificados:true});let intentos=0;
  p.auth.mfa.challengeAndVerify=async()=>{intentos++;throw Error('secreto-no-publicar');};
  await assert.rejects(()=>p.flujo.verificar('factor-fixture','123456',true),e=>{
    assert.equal(e.codigo,'NO_DISPONIBLE');assert.doesNotMatch(e.message,/secreto-no-publicar/);return true;
  });assert.equal(intentos,1);
});

test('MFA local: respuesta SDK de verify sin AAL2 posterior no produce éxito',async()=>{
  const p=preparar({permitir:true,verificados:true});p.auth.mfa.challengeAndVerify=async()=>({error:null});
  await assert.rejects(()=>p.flujo.verificar('factor-fixture','123456',true),e=>e.codigo==='NO_AAL2');
});

test('MFA local: impedir doble enrolamiento y descartar una operación al cambiar sesión',async()=>{
  const p=preparar({permitir:true});let completar;
  p.auth.mfa.enroll=()=>new Promise(resolve=>{completar=resolve;});
  const primera=p.flujo.iniciarEnrolamiento(true);
  while(!completar) await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(()=>p.flujo.iniciarEnrolamiento(true),e=>e.codigo==='OCUPADO');
  p.flujo.limpiar();completar({data:{id:'factor-fixture',type:'totp',totp:{qr_code:'<svg/>'}},error:null});
  await assert.rejects(()=>primera,e=>e.codigo==='SESION_CAMBIADA');
});

test('MFA local: token de otra identidad no se transmite al servidor y respuestas inválidas no autorizan',async()=>{
  const p=preparar();p.auth.getSession=async()=>({data:{session:{user:{id:'ajeno'},access_token:'no-publicar'}},error:null});
  await assert.rejects(()=>p.flujo.consultar(),e=>e.codigo==='SESION_CAMBIADA');assert.equal(p.llamadas.length,0);
  const q=preparar();const malformado=crearFlujoMfaLocal(()=>q.auth,false,async()=>Response.json({autorizado:false}));
  await assert.rejects(()=>malformado.consultar(),e=>e.codigo==='NO_DISPONIBLE');
});

test('MFA local: temporización de caducidad conservadora sin modificar la sesión remota',()=>{
  assert.equal(esperaCaducidadSesion(110,100000),10000);
  for(const v of [undefined,NaN,Infinity,99])assert.equal(esperaCaducidadSesion(v,100000),0);
  assert.equal(esperaCaducidadSesion(Number.MAX_SAFE_INTEGER,100000),2147483647);
});

test('MFA local: sesión caducada impide enrolar y verificar antes de cualquier mutación',async()=>{
  for(const expires_at of [undefined,Math.floor(Date.now()/1000)-1]){
    const p=preparar({permitir:true,verificados:true});
    p.auth.getSession=async()=>({data:{session:{access_token:'no-publicar',user:{id:'actor-fixture'},expires_at}},error:null});
    await assert.rejects(()=>p.flujo.consultar(),e=>e.codigo==='SESION_CADUCADA');
    await assert.rejects(()=>p.flujo.iniciarEnrolamiento(true),e=>e.codigo==='SESION_CADUCADA');
    await assert.rejects(()=>p.flujo.verificar('factor-fixture','123456',true),e=>e.codigo==='SESION_CADUCADA');
    assert.equal(p.llamadas.length,0);
  }
});

test('MFA local: código rechazado y desafío caducado permiten reintento manual sin nuevo enrolamiento',async()=>{
  for(const [code,codigoEsperado] of [['mfa_verification_failed','CODIGO_RECHAZADO'],['mfa_challenge_expired','DESAFIO_CADUCADO']]){
    const p=preparar({permitir:true,verificados:true,http:200});const verificar=p.auth.mfa.challengeAndVerify;
    let intentos=0;
    p.auth.mfa.challengeAndVerify=async args=>{intentos++;return intentos===1?{error:{code,status:401,message:'no-publicar'}}:verificar(args);};
    await assert.rejects(()=>p.flujo.verificar('factor-fixture','123456',true),e=>e.codigo===codigoEsperado);
    assert.equal(intentos,1);
    const r=await p.flujo.verificar('factor-fixture','654321',true);assert.equal(r.nivel,'aal2');assert.equal(intentos,2);
    assert.equal(p.llamadas.filter(v=>v==='enroll').length,0);
  }
});

test('MFA local: proyecto TOTP deshabilitado, rate limit y sesión rechazada usan errores seguros',async()=>{
  for(const [error,esperado] of [[{code:'mfa_totp_enroll_not_enabled'},'TOTP_NO_HABILITADO'],[{status:429},'LIMITE_INTENTOS'],
    [{code:'session_not_found',status:401},'SIN_SESION']]){
    const p=preparar({permitir:true});p.auth.mfa.enroll=async()=>({error:{...error,message:'secreto-no-publicar'}});
    await assert.rejects(()=>p.flujo.iniciarEnrolamiento(true),e=>{assert.equal(e.codigo,esperado);assert.doesNotMatch(e.message,/secreto-no-publicar/);return true;});
  }
});

test('MFA local: fallo de red de getUser no se confunde con expiración ni permite una mutación',async()=>{
  const p=preparar({permitir:true});p.auth.getUser=async()=>({data:{user:null},error:{status:0,message:'no-publicar'}});
  await assert.rejects(()=>p.flujo.iniciarEnrolamiento(true),e=>e.codigo==='NO_DISPONIBLE');assert.equal(p.llamadas.length,0);
});

test('MFA local: QR SVG oficial, codificado y base64 se muestran como imagen sin publicar secret ni uri',async()=>{
  for(const qr_code of ['<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    'data:image/svg+xml;utf-8,%3Csvg%3E%3C%2Fsvg%3E',
    'data:image/svg+xml;base64,'+Buffer.from('<svg></svg>').toString('base64')]){
    const p=preparar({permitir:true});p.auth.mfa.enroll=async()=>({data:{id:'factor-fixture',type:'totp',totp:{qr_code,secret:'no-publicar',uri:'no-publicar'}},error:null});
    const r=await p.flujo.iniciarEnrolamiento(true);assert.match(r.qr,/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);assert.doesNotMatch(JSON.stringify(r),/no-publicar/);
  }
});

test('MFA local: SVG inválido o servidor 401 no producen éxito ni filtración',async()=>{
  const p=preparar({permitir:true});p.auth.mfa.enroll=async()=>({data:{id:'factor-fixture',type:'totp',totp:{qr_code:'https://ajeno.example.test/qr'}},error:null});
  await assert.rejects(()=>p.flujo.iniciarEnrolamiento(true),e=>e.codigo==='QR_NO_DISPONIBLE');
  const q=preparar({http:401});await assert.rejects(()=>q.flujo.consultar(),e=>e.codigo==='SIN_SESION');
});

test('MFA local: SVG de SVGo con declaración XML y comentario inicial es válido',async()=>{
  // Formato del generador de Supabase Auth; este SVG no contiene un QR ni secreto real.
  const svg='<?xml version="1.0"?>\n<!-- Generated by SVGo -->\n<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
  for(const qr_code of [svg,'data:image/svg+xml;utf-8,'+svg]){
    const p=preparar({permitir:true});
    p.auth.mfa.enroll=async()=>({data:{id:'factor-fixture',type:'totp',totp:{qr_code}},error:null});
    const r=await p.flujo.iniciarEnrolamiento(true);
    assert.equal(decodeURIComponent(r.qr.slice(r.qr.indexOf(',')+1)),svg);
  }
});
