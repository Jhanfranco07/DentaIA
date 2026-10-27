// Navegador aislado. Servicios privados simulados: jamás crea usuarios ni escribe en Supabase.
// Las pruebas sin red de GitHub Actions siguen usando src/features/**/*.test.mjs.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

export async function ejecutarRecorrido(browser,baseURL,outDir,repo) {
 await mkdir(outDir,{recursive:true});const resultados=[],erroresPagina=[],erroresProveedor=[];
 async function probar(nombre,fn,tipo='navegador real con backend simulado'){
  try{await fn();resultados.push({nombre,tipo,resultado:'APROBADA'});}
  catch(e){resultados.push({nombre,tipo,resultado:'FALLIDA',error:e.message,ubicacion:e.stack?.split('\n').slice(1,3).join(' ')});}
  await writeFile(path.join(outDir,'progreso.json'),JSON.stringify(resultados,null,2));
 }
 const u={id:'11111111-1111-4111-8111-111111111111',email:'paciente.qa@dentaia.test',aud:'authenticated',role:'authenticated',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{full_name:'Paciente de ejemplo'}};
 const d={id:'55555555-5555-4555-8555-555555555555',name:'Dra. Elena Prado',specialty:'Odontología general',district:'Miraflores',is_active:true,is_demo:true,consultation_price:65,currency:'PEN',initials:'EP',description:'Perfil ficticio de pruebas de interfaz.',avatar_color:'#e4f0f7',slug:'elena-qa'};
 const png=await readFile(path.join(repo,'public/demo/atencion-preventiva.png'));
 const contexto=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});
 const page=await contexto.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>erroresPagina.push(e.message));
 page.on('dialog',dialog=>void dialog.accept());
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:u.id,aud:'authenticated',role:'authenticated',email:u.email,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})}.firma-ficticia-solo-qa`;
 const estado={modo:'normal',consentimiento:null,fotos:[],archivo:false,solicitudes:[],mutaciones:[]};
 await contexto.route('**/*.supabase.co/**',async route=>{
  try {
  const req=route.request(),url=new URL(req.url()),method=req.method(),p=url.pathname;
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info,prefer,accept','access-control-allow-methods':'GET,POST,PATCH,DELETE,PUT,OPTIONS'};
  const send=(json,status=200)=>route.fulfill({status,headers,json});
  const one=rows=>(req.headers().accept??'').includes('vnd.pgrst.object')?(rows[0]??null):rows;
  if(method==='OPTIONS')return send({});
  if(p==='/auth/v1/token'&&method==='POST')return send({access_token:token,refresh_token:'qa-refresh-ficticio',expires_in:3600,token_type:'bearer',user:u});
  if(p==='/auth/v1/logout')return route.fulfill({status:204,headers});
  const autorizado=(req.headers().authorization??'').includes(token);
  if(p==='/auth/v1/user')return autorizado?send(u):send({message:'Sesión no válida',code:'bad_jwt'},401);
  if(p==='/rest/v1/dentists'){
   if(estado.modo==='error')return send({code:'XX000',message:'QA_DETALLE_INTERNO_NO_MOSTRAR'},503);
   const id=url.searchParams.get('id')?.replace(/^eq\./,'');
   return send(one(estado.modo==='vacio'||(id&&id!==d.id)?[]:[d]));
  }
  if(!autorizado)return send({message:'No autorizado',code:'42501'},403);
  if(p==='/rest/v1/profiles')return send(one([{id:u.id,full_name:'Paciente de ejemplo'}]));
  let body={};try{const datos=req.postDataJSON();body=(Array.isArray(datos)?datos[0]:datos)??{};}catch{/* Imagen binaria */}
  if(method!=='GET')estado.mutaciones.push({metodo:method,ruta:p});
  if(p==='/rest/v1/patient_consents'){
   if(method==='POST'){assert.equal(body.user_id??u.id,u.id);assert.equal(body.purpose,'academic_photo_storage');estado.consentimiento={...body,user_id:u.id,id:'22222222-2222-4222-8222-222222222222',revoked_at:null,accepted_at:new Date().toISOString()};return send(one([estado.consentimiento]),201);}
   if(method==='PATCH'){estado.consentimiento.revoked_at=new Date().toISOString();return send([]);}
   return send(one(estado.consentimiento&&!estado.consentimiento.revoked_at?[estado.consentimiento]:[]));
  }
  if(p.startsWith('/storage/v1/object/dental-photos/')||p.startsWith('/storage/v1/object/authenticated/dental-photos/')){
   if(method==='POST'){assert(!estado.consentimiento?.revoked_at);estado.archivo=true;return send({Key:p.split('/object/')[1],Id:'qa-storage'});}
   return estado.archivo?route.fulfill({status:200,headers,contentType:'image/png',body:png}):send({message:'Object not found'},400);
  }
  if(p==='/storage/v1/object/dental-photos'&&method==='DELETE'){assert(body.prefixes.every(x=>x.startsWith(u.id+'/')));estado.archivo=false;return send([]);}
  if(p==='/storage/v1/object/list/dental-photos')return send(estado.archivo?[{name:estado.fotos[0]?.object_path.split('/').at(-1)}]:[]);
  if(p==='/rest/v1/dental_photos'){
   if(method==='POST'){assert.equal(body.user_id??u.id,u.id);const foto={...body,user_id:u.id,bucket_id:'dental-photos',id:'33333333-3333-4333-8333-333333333333',created_at:new Date().toISOString()};estado.fotos.push(foto);return send(one([foto]),201);}
   if(method==='DELETE'){const anteriores=estado.fotos;estado.fotos=[];return send(one(anteriores.map(f=>({id:f.id}))));}
   return send(one(estado.fotos));
  }
  if(p==='/rest/v1/appointment_requests'){
   if(method==='POST'){assert.equal(body.user_id,u.id);const solicitud={...body,id:'44444444-4444-4444-8444-444444444444',status:'requested',created_at:new Date().toISOString()};estado.solicitudes.push(solicitud);return send(one([solicitud]),201);}
   if(method==='PATCH'){estado.solicitudes=estado.solicitudes.map(s=>({...s,status:'cancelled'}));return send(one(estado.solicitudes));}
   return send(one(estado.solicitudes));
  }
  return send({message:'Ruta no permitida en QA'},403);
  } catch(e) {erroresProveedor.push(e.message);await route.fulfill({status:500,json:{message:'Fallo del proveedor simulado de QA'}});}
 });
 async function ir(ruta){await page.goto(baseURL+ruta,{waitUntil:'networkidle'});}
 async function captura(nombre){try{await page.evaluate(()=>{document.activeElement?.blur?.();window.scrollTo({top:0,behavior:'instant'});});await page.screenshot({path:path.join(outDir,nombre+'.png'),fullPage:true,animations:'disabled',timeout:12000});}catch(e){await writeFile(path.join(outDir,nombre+'-captura-no-disponible.txt'),e.message);}}
 async function vistaPrivada(nombre){for(const ancho of [1440,390]){await page.setViewportSize({width:ancho,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${nombre} desborda a ${ancho}px`);await captura(`despues-${nombre}-${ancho}`);}await page.setViewportSize({width:1440,height:1000});}
 try {
  await probar('Páginas públicas y funciones privadas restringidas sin sesión',async()=>{
   for(const ruta of ['/','/cuenta','/fotografias','/solicitudes','/directorio','/privacidad','/analisis/demo']){
    await ir(ruta);assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('main').count(),1);
    assert.doesNotMatch(await page.locator('body').innerText(),/\b(RLS|JWT|MVP|endpoint|bucket|Supabase)\b|Storage API|Acceso de prueba/i);
    if(ruta==='/fotografias')assert(await page.getByText('Inicia sesión para consultar y guardar',{exact:false}).isVisible());
    if(ruta==='/solicitudes')assert(await page.getByRole('button',{name:'Registrar solicitud',exact:true}).isDisabled());
   }
  });
  await probar('Teclado: enlace de salto y foco de validación de cuenta',async()=>{
   await ir('/');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'#contenido');
   await ir('/cuenta');await page.getByRole('button',{name:'Entrar a mi cuenta',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('name')),'email');
   await ir('/cuenta?modo=registro');assert(await page.getByRole('heading',{name:'Crea tu cuenta',exact:true}).isVisible());
  });
  await probar('Tres muestras: selección, resultados fijos, regiones y descarga de PDF',async()=>{
   await ir('/analisis/demo');
   const casos=[['cuidado-habitual','Cuidado bucal habitual',0],['atencion-preventiva','Una zona para conversar',1],['cuidado-encias','Encías y cuidado preventivo',1]];
   for(const [id,titulo,regiones] of casos){
    await page.getByRole('button',{name:`Elegir ejemplo: ${titulo}`,exact:true}).click();
    await page.getByRole('button',{name:'Iniciar demostración',exact:false}).click();
    await page.locator('#resultado-demo').waitFor();assert.equal(await page.locator('[class*="ilustracion"] ellipse').count(),regiones);
    assert(await page.getByText('Resultado simulado para fines académicos',{exact:true}).first().isVisible());
    await page.getByRole('button',{name:'Ver mi reporte',exact:true}).click();
    const descarga=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar reporte PDF',exact:true}).click();const archivo=await descarga;
    assert.equal(archivo.suggestedFilename(),`DentaIA-${id}.pdf`);const destino=path.join(outDir,`reporte-${id}.pdf`);await archivo.saveAs(destino);assert((await readFile(destino)).subarray(0,8).toString().startsWith('%PDF-1.4'));
    if(id==='atencion-preventiva')await captura('despues-resultado-reporte');
    await page.getByRole('button',{name:'Volver a elegir',exact:true}).click();
   }
  });
  await probar('Contenido reconocido con nombre cambiado; imagen desconocida con nombre de muestra rechazada',async()=>{
   await ir('/analisis/demo');const input=page.locator('input[type=file]');
   await input.setInputFiles({name:'nombre-cambiado.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Iniciar demostración',exact:false}).click();await page.locator('#resultado-demo').waitFor();assert(await page.getByText('Una zona para conversar · Observaciones',{exact:false}).isVisible());
   const desconocida=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=4;const x=c.getContext('2d');x.fillStyle='#4a8b8d';x.fillRect(0,0,4,4);return c.toDataURL('image/png').split(',')[1];});
   await input.setInputFiles({name:'atencion-preventiva.png',mimeType:'image/png',buffer:Buffer.from(desconocida,'base64')});await page.getByText('El análisis automático de otras imágenes aún no está disponible.',{exact:false}).waitFor();assert.equal(await page.locator('#resultado-demo').count(),0);assert(await page.getByRole('button',{name:'Iniciar demostración',exact:false}).isDisabled());
  });
  await probar('Directorio: búsqueda, vacío, limpiar filtros devuelve foco, perfil y solicitud preseleccionada',async()=>{
   await ir('/directorio');await page.getByLabel('Buscar por nombre o especialidad').fill('sin-coincidencia-qa');await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement?.id),'dir-busqueda','foco después de limpiar');
   await page.getByRole('link',{name:`Ver detalle de ${d.name}`,exact:true}).click();await page.getByRole('heading',{name:d.name,exact:true}).waitFor();await page.getByRole('link',{name:'Solicitar atención de demostración',exact:true}).click();await page.waitForURL('**/solicitudes?odontologo=*');assert.equal(new URL(page.url()).searchParams.get('odontologo'),d.id,'ID en URL de solicitud');await page.waitForFunction(id=>document.querySelector('#odontologo')?.value===id,d.id);
  });
  await probar('Error del perfil sin detalles internos y recuperación de lista vacía',async()=>{
   estado.modo='error';await ir('/directorio/'+d.id);await page.getByRole('alert').waitFor();assert.doesNotMatch(await page.locator('body').innerText(),/QA_DETALLE_INTERNO/);
   estado.modo='vacio';await ir('/directorio');assert(await page.getByText('Por ahora no hay odontólogos activos',{exact:false}).isVisible());estado.modo='normal';
  });
  await probar('Cuenta: inicio de sesión y perfil con proveedor simulado',async()=>{
   await ir('/cuenta');await page.getByLabel('Correo electrónico',{exact:true}).fill(u.email);await page.getByLabel('Contraseña',{exact:true}).fill('clave-ficticia-solo-qa');await page.getByRole('button',{name:'Entrar a mi cuenta',exact:true}).click();await page.getByRole('heading',{name:'Mi perfil',exact:true}).waitFor();assert(await page.getByText('Paciente de ejemplo',{exact:true}).isVisible());await vistaPrivada('perfil');
  });
  await probar('Fotografías: consentimiento, carga, visualización, revocación y borrado seguro con proveedor simulado',async()=>{
   await ir('/fotografias');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Dar consentimiento',exact:true}).click();await page.getByText('Permiso de almacenamiento activo',{exact:true}).waitFor();await page.getByLabel('Seleccionar fotografía de prueba',{exact:true}).setInputFiles({name:'qa-demo.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Subir fotografía',exact:true}).click();await page.getByText('Fotografía almacenada correctamente.',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Ver fotografía',exact:true}).click();await page.getByAltText('Vista previa de qa-demo.png',{exact:true}).waitFor();await vistaPrivada('galeria');await page.getByRole('button',{name:'Revocar consentimiento',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[type=file]')?.disabled);await page.getByRole('button',{name:'Eliminar',exact:true}).click();await page.getByText('Fotografía eliminada correctamente.',{exact:true}).waitFor();assert.equal(estado.archivo,false);assert.equal(estado.fotos.length,0);
  });
  await probar('Recorrido: demostración → reporte → directorio → perfil → solicitud → historial → cancelación simulada',async()=>{
   await ir('/analisis/demo');await page.getByRole('button',{name:'Elegir ejemplo: Cuidado bucal habitual',exact:true}).click();await page.getByRole('button',{name:'Iniciar demostración',exact:false}).click();await page.getByRole('button',{name:'Ver mi reporte',exact:true}).click();await page.getByRole('link',{name:'Consultar profesionales',exact:true}).click();await page.getByRole('link',{name:`Ver detalle de ${d.name}`,exact:true}).click();await page.getByRole('link',{name:'Solicitar atención de demostración',exact:true}).click();
   await page.locator('#nombre').fill('Paciente de ejemplo');await page.getByLabel('Correo electrónico *',{exact:true}).fill(u.email);const fecha=new Date();fecha.setDate(fecha.getDate()+3);await page.locator('#fecha').fill(fecha.toISOString().slice(0,10));await page.getByRole('button',{name:'Registrar solicitud',exact:true}).click();await page.locator('#mis-solicitudes').getByText('Solicitada',{exact:true}).waitFor();await vistaPrivada('solicitud');await page.getByRole('button',{name:'Cancelar solicitud',exact:true}).click();await page.locator('#mis-solicitudes').getByText('Cancelada',{exact:true}).waitFor();assert.equal(estado.solicitudes.length,1);assert.equal(estado.solicitudes[0].status,'cancelled');
  });
  await probar('Cierre de sesión oculta datos privados',async()=>{
   await ir('/cuenta');await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByRole('button',{name:'Entrar a mi cuenta',exact:true}).waitFor();await ir('/fotografias');assert(await page.getByText('Inicia sesión para consultar y guardar',{exact:false}).isVisible());
  });
  await probar('Adaptación real de navegador a escritorio, tablet y móvil; menú y teclado',async()=>{
   for(const ancho of [1440,768,390]){
    await page.setViewportSize({width:ancho,height:1000});
    for(const ruta of ['/','/analisis/demo','/cuenta','/directorio','/solicitudes','/fotografias']){await ir(ruta);const tamaño=await page.evaluate(()=>({contenido:document.documentElement.scrollWidth,ventana:innerWidth}));assert(tamaño.contenido<=tamaño.ventana+1,`${ruta} desborda a ${ancho}px`);if(ancho!==768)await captura(`despues-${ruta==='/'?'inicio':ruta.replaceAll('/','-').slice(1)}-${ancho}`);}
    if(ancho===390){await page.getByRole('button',{name:'Abrir menú',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await page.getByRole('button',{name:'Cerrar menú',exact:true}).getAttribute('aria-expanded'),'true');await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Odontólogos',exact:true}).focus();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Abrir menú');}
   }
  });
  await probar('Sin errores de ejecución de React ni del proveedor simulado',()=>{assert.deepEqual(erroresPagina,[]);assert.deepEqual(erroresProveedor,[]);});
 } finally {await contexto.close();}
 const resumen={baseURL,backend:'Simulado; ninguna escritura real',resultados,erroresPagina,total:resultados.length,aprobadas:resultados.filter(r=>r.resultado==='APROBADA').length};
 await writeFile(path.join(outDir,'resultado-recorrido.json'),JSON.stringify(resumen,null,2));return resumen;
}
