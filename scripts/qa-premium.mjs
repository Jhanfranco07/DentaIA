// QA de integración: Chromium real y proveedor Supabase simulado únicamente en este contexto.
// No prueba RLS real ni escribe en el proyecto compartido. El resultado distingue cada escenario ejecutado.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import { CASOS } from '../src/features/analisis/casos.ts';

export async function ejecutarRecorridoPremium(browser,baseURL,outDir,repo) {
 await mkdir(outDir,{recursive:true});const resultados=[],erroresPagina=[],erroresProveedor=[];
 async function probar(nombre,fn,tipo='Navegador real; Supabase simulado sin escrituras remotas'){
  try{await fn();resultados.push({nombre,tipo,resultado:'APROBADA'});}
  catch(e){resultados.push({nombre,tipo,resultado:'FALLIDA',error:e.message,ubicacion:e.stack?.split('\n').slice(1,3).join(' ')});}
  await writeFile(path.join(outDir,'progreso.json'),JSON.stringify(resultados,null,2));
 }
 const u={id:'11111111-1111-4111-8111-111111111111',email:'paciente.qa@dentaia.test',aud:'authenticated',role:'authenticated',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{full_name:'Paciente de ejemplo'}};
 const d={id:'55555555-5555-4555-8555-555555555555',name:'Dra. Elena Prado',specialty:'Odontología general',district:'Miraflores',is_active:true,is_demo:true,consultation_price:65,currency:'PEN',initials:'EP',description:'Perfil ficticio de pruebas de interfaz.',avatar_color:'#e4f0f7',slug:'elena-qa'};
 const sample=CASOS.find(c=>c.id==='atencion-preventiva');
 const png=await readFile(path.join(repo,'public',sample.imagen));
 const contexto=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});
 const page=await contexto.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>erroresPagina.push(e.message));
 page.on('dialog',dialog=>void dialog.accept());
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:u.id,aud:'authenticated',role:'authenticated',email:u.email,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})}.firma-ficticia-solo-qa`;
 const segundo={...d,id:'66666666-6666-4666-8666-666666666666',name:'Dr. Luis Torres',specialty:'Periodoncia',district:'San Isidro',initials:'LT'};
 const estado={modo:'normal',consentimiento:null,fotos:[],archivo:false,solicitudes:[],mutaciones:[],falloEliminarRegistro:false};
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
   return send(one(estado.modo==='vacio'?[]:[d,segundo].filter(x=>!id||x.id===id)));
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
   return estado.archivo?route.fulfill({status:200,headers,contentType:sample.imagen.endsWith('.jpg')?'image/jpeg':'image/png',body:png}):send({message:'Object not found'},400);
  }
  if(p==='/storage/v1/object/dental-photos'&&method==='DELETE'){assert(body.prefixes.every(x=>x.startsWith(u.id+'/')));estado.archivo=false;return send([]);}
  if(p==='/storage/v1/object/list/dental-photos')return send(estado.archivo?[{name:estado.fotos[0]?.object_path.split('/').at(-1)}]:[]);
  if(p==='/rest/v1/dental_photos'){
   if(method==='POST'){assert.equal(body.user_id??u.id,u.id);const foto={...body,user_id:u.id,bucket_id:'dental-photos',id:'33333333-3333-4333-8333-333333333333',created_at:new Date().toISOString()};estado.fotos.push(foto);return send(one([foto]),201);}
   if(method==='DELETE'){if(estado.falloEliminarRegistro){estado.falloEliminarRegistro=false;return send({code:'XX000',message:'QA_REINTENTO_REGISTRO'},503);}const anteriores=estado.fotos;estado.fotos=[];return send(one(anteriores.map(f=>({id:f.id}))));}
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
 async function nuevaDemo(){await ir('/analisis/demo');await page.evaluate(()=>sessionStorage.removeItem('dentaia-demo-v2'));await page.reload({waitUntil:'networkidle'});}
 async function captura(nombre){await page.evaluate(()=>{document.activeElement?.blur?.();window.scrollTo({top:0,behavior:'instant'});});await page.screenshot({path:path.join(outDir,nombre+'.png'),fullPage:true,animations:'disabled',timeout:20000});}
 async function sinDesborde(nombre){const tam=await page.evaluate(()=>({contenido:document.documentElement.scrollWidth,ventana:innerWidth}));assert(tam.contenido<=tam.ventana+1,`${nombre}: ${tam.contenido}px supera ${tam.ventana}px`);}
 async function vistaPrivada(nombre){for(const ancho of [1440,390]){await page.setViewportSize({width:ancho,height:1000});await sinDesborde(nombre);await captura(`${nombre}-${ancho}`);}await page.setViewportSize({width:1440,height:1000});}
 // Selectores por nombres accesibles: comprueban el recorrido que ve el paciente.
 async function seleccionar(caso){await page.getByRole('button',{name:`Elegir ejemplo: ${caso.titulo}`,exact:true}).click();await page.getByRole('button',{name:'Ver mi análisis de ejemplo',exact:true}).waitFor();}
 async function resultado(){await page.getByRole('button',{name:'Ver mi análisis de ejemplo',exact:true}).click();await page.getByRole('heading',{name:'Mira el ejemplo con otros ojos.',exact:true}).waitFor();await page.waitForFunction(()=>document.activeElement?.tagName==='H1');}
 async function reporte(){await page.getByRole('button',{name:'Ver recomendaciones',exact:true}).click();await page.getByRole('button',{name:'Ver mi reporte',exact:true}).click();await page.getByRole('heading',{name:'Tu guía, lista para acompañarte.',exact:true}).waitFor();}
 async function opciones(){await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByRole('heading',{name:'¿Te gustaría encontrar un odontólogo cerca de ti?',exact:true}).waitFor();}
 try {
  await probar('Páginas públicas: sin datos privados ni lenguaje interno; solicitud restringida sin sesión',async()=>{
   for(const ruta of ['/','/cuenta','/fotografias','/solicitudes','/directorio','/privacidad','/analisis/demo']){
    await ir(ruta);assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('main').count(),1);
    assert.doesNotMatch(await page.locator('body').innerText(),/\b(RLS|JWT|MVP|endpoint|bucket|Supabase)\b|Storage API|Acceso de prueba/i);
    if(ruta==='/fotografias')assert(await page.getByText('Inicia sesión para consultar y guardar',{exact:false}).isVisible());
    if(ruta==='/solicitudes')assert(await page.getByRole('button',{name:'Registrar solicitud',exact:true}).isDisabled());
   }
  });
  await probar('Teclado: enlace de salto, validación de cuenta y foco visible',async()=>{
   await ir('/');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'#contenido');
   const foco=await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle);assert.notEqual(foco,'none');
   await ir('/cuenta');await page.getByRole('button',{name:'Entrar a mi cuenta',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('name')),'email');
   await ir('/cuenta?modo=registro');assert(await page.getByRole('heading',{name:'Crea tu cuenta',exact:true}).isVisible());
  });
  await probar('Tres referencias editoriales (fotografías clínicas pendientes), regiones del catálogo y descarga real de tres PDF',async()=>{
   for(const caso of CASOS){
    await nuevaDemo();await seleccionar(caso);const imagen=page.locator('img').filter({hasNot:page.locator('nav')});assert(await imagen.count()>0);
    await resultado();assert.equal(await page.locator('[class*=resultadoGrid] ellipse').count(),caso.regiones.length);
    assert(await page.getByText('Resultado simulado para fines académicos.',{exact:false}).first().isVisible());
    await sinDesborde(`resultado-${caso.id}`);await captura(`resultado-${caso.id}-1440`);
    await reporte();
    const vistaPDF=page.getByRole('link',{name:'Abrir vista previa PDF',exact:false});await vistaPDF.waitFor();const vistaBytes=Buffer.from(await page.evaluate(async url=>Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())),await vistaPDF.getAttribute('href')));
    const descarga=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar reporte PDF',exact:true}).click();const archivo=await descarga;
    assert.equal(archivo.suggestedFilename(),`DentaIA-${caso.id}.pdf`);const destino=path.join(outDir,`reporte-${caso.id}.pdf`);await archivo.saveAs(destino);const descargado=await readFile(destino);assert(descargado.subarray(0,8).toString().startsWith('%PDF-1.4'));assert.deepEqual(descargado,vistaBytes,'La descarga corresponde al PDF de la vista previa');
    await captura(`reporte-${caso.id}-1440`);
   }
  });
  await probar('Hash: muestra con nombre cambiado reconocida; otra imagen con nombre conocido rechazada',async()=>{
   await nuevaDemo();let input=page.locator('input[type=file]');
   await input.setInputFiles({name:'nombre-cambiado.jpg',mimeType:sample.imagen.endsWith('.jpg')?'image/jpeg':'image/png',buffer:png});
   await resultado();assert(await page.getByText(sample.titulo,{exact:false}).first().isVisible());
   await nuevaDemo();input=page.locator('input[type=file]');
   const desconocida=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=4;const x=c.getContext('2d');x.fillStyle='#4a8b8d';x.fillRect(0,0,4,4);return c.toDataURL('image/png').split(',')[1];});
   await input.setInputFiles({name:'atencion-preventiva.png',mimeType:'image/png',buffer:Buffer.from(desconocida,'base64')});
   await page.getByText('El análisis automático de otras imágenes aún no está disponible.',{exact:false}).waitFor();assert.equal(await page.getByRole('heading',{name:'Mira el ejemplo con otros ojos.',exact:true}).count(),0);
   assert(await page.getByRole('button',{name:'Ver mi análisis de ejemplo',exact:true}).isDisabled());
  });
  await probar('Omitir es opcional: finalización, reporte retenido en sesión y otra demostración',async()=>{
   await nuevaDemo();await seleccionar(CASOS[0]);await resultado();await reporte();await opciones();
   await page.getByRole('button',{name:'Omitir por ahora',exact:true}).click();
   await page.getByRole('heading',{name:'Un buen comienzo para tu cuidado.',exact:true}).waitFor();await captura('omitir-1440');
   await page.reload({waitUntil:'networkidle'});assert(await page.getByRole('heading',{name:'Un buen comienzo para tu cuidado.',exact:true}).isVisible());
   await page.getByRole('button',{name:'Consultar mi reporte',exact:true}).click();await page.getByRole('heading',{name:'Tu guía, lista para acompañarte.',exact:true}).waitFor();
   assert(await page.getByRole('button',{name:'Descargar reporte PDF',exact:true}).isEnabled());
  });
  await probar('Búsqueda opcional: distrito, especialidad, perfil, solicitud y regreso al reporte',async()=>{
   await nuevaDemo();await seleccionar(CASOS[2]);await resultado();await reporte();await opciones();
   await page.getByRole('link',{name:'Buscar odontólogos',exact:true}).click();await page.waitForURL('**/directorio?**');
   await page.getByLabel('Distrito',{exact:true}).selectOption('San Isidro');await page.getByRole('link',{name:`Ver detalle de ${segundo.name}`,exact:true}).waitFor();
   assert.equal(await page.getByRole('link',{name:`Ver detalle de ${d.name}`,exact:true}).count(),0);
   const especialidad=page.getByLabel('Especialidad',{exact:true});assert.equal(await especialidad.count(),1);{await especialidad.selectOption('Periodoncia');assert(await page.getByText('Profesionales de demostración en el distrito seleccionado',{exact:false}).isVisible());}
   await captura('busqueda-opcional-1440');
   await page.getByRole('link',{name:`Ver detalle de ${segundo.name}`,exact:true}).click();await page.getByRole('heading',{name:segundo.name,exact:true}).waitFor();
   const volver=page.getByRole('link',{name:/Volver a mi reporte/});await volver.waitFor();await volver.click();await page.getByRole('heading',{name:'Tu guía, lista para acompañarte.',exact:true}).waitFor();
   await ir('/directorio');await page.getByLabel('Buscar por nombre o especialidad').fill('sin-coincidencia-qa');await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement?.id),'dir-busqueda');
   await page.getByRole('link',{name:`Ver detalle de ${d.name}`,exact:true}).click();await page.getByRole('link',{name:'Solicitar atención de demostración',exact:true}).click();await page.waitForURL('**/solicitudes?**');assert.equal(new URL(page.url()).searchParams.get('odontologo'),d.id);await page.waitForFunction(id=>document.querySelector('#odontologo')?.value===id,d.id);
  });
  await probar('Error del perfil sin detalles internos y estado vacío del directorio',async()=>{
   estado.modo='error';await ir('/directorio/'+d.id);await page.getByRole('alert').waitFor();assert.doesNotMatch(await page.locator('body').innerText(),/QA_DETALLE_INTERNO/);
   estado.modo='vacio';await ir('/directorio');assert(await page.getByText('Por ahora no hay odontólogos activos',{exact:false}).isVisible());estado.modo='normal';
  });
  await probar('Cuenta: sesión, perfil y continuación anónima al odontólogo elegido con proveedor simulado',async()=>{
   await ir(`/solicitudes?odontologo=${d.id}&desde=reporte&caso=${CASOS[0].id}`);await page.getByRole('link',{name:'Inicia sesión en Mi cuenta',exact:true}).click();await page.waitForURL('**/cuenta?continuar=*');await page.getByLabel('Correo electrónico',{exact:true}).fill(u.email);await page.getByLabel('Contraseña',{exact:true}).fill('clave-ficticia-solo-qa');await page.getByRole('button',{name:'Entrar a mi cuenta',exact:true}).click();await page.getByRole('heading',{name:'Mi perfil',exact:true}).waitFor();await page.getByText('Paciente de ejemplo',{exact:true}).waitFor();await vistaPrivada('perfil');await page.getByRole('link',{name:'Continuar mi solicitud',exact:true}).click();await page.waitForURL('**/solicitudes?**');assert.equal(new URL(page.url()).searchParams.get('odontologo'),d.id);await page.waitForFunction(id=>document.querySelector('#odontologo')?.value===id,d.id);assert.equal(new URL(page.url()).searchParams.get('caso'),CASOS[0].id);
  });
  await probar('Fotografías: consentimiento, carga, vista privada, revocación y recuperación de borrado parcial',async()=>{
   await ir('/fotografias');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Dar consentimiento',exact:true}).click();await page.getByText('Permiso de almacenamiento activo',{exact:true}).waitFor();
   await page.getByLabel('Seleccionar fotografía de prueba',{exact:true}).setInputFiles({name:'qa-demo.jpg',mimeType:sample.imagen.endsWith('.jpg')?'image/jpeg':'image/png',buffer:png});await page.getByRole('button',{name:'Subir fotografía',exact:true}).click();await page.getByText('Fotografía almacenada correctamente.',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Ver fotografía',exact:true}).click();await page.getByAltText('Vista previa de qa-demo.jpg',{exact:true}).waitFor();await vistaPrivada('galeria');
   await page.getByRole('button',{name:'Revocar consentimiento',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[type=file]')?.disabled);
   estado.falloEliminarRegistro=true;await page.getByRole('button',{name:'Eliminar',exact:true}).click();await page.getByText('La imagen ya se eliminó, pero falta confirmar la limpieza de su registro.',{exact:false}).waitFor();assert.equal(estado.archivo,false);assert.equal(estado.fotos.length,1);await captura('borrado-parcial-reintentable');
   await page.getByRole('button',{name:'Eliminar',exact:true}).click();await page.getByText('Fotografía eliminada correctamente.',{exact:true}).waitFor();assert.equal(estado.fotos.length,0);
  });
  await probar('Recorrido con sesión: reporte → directorio → perfil → solicitud → historial → cancelación',async()=>{
   await nuevaDemo();await seleccionar(CASOS[0]);await resultado();await reporte();await opciones();await page.getByRole('link',{name:'Buscar odontólogos',exact:true}).click();
   await page.getByRole('link',{name:`Ver detalle de ${d.name}`,exact:true}).click();await page.getByRole('link',{name:'Solicitar atención de demostración',exact:true}).click();
   await page.locator('#nombre').fill('Paciente de ejemplo');await page.getByLabel('Correo electrónico *',{exact:true}).fill(u.email);const fecha=new Date();fecha.setDate(fecha.getDate()+3);await page.locator('#fecha').fill(fecha.toISOString().slice(0,10));await page.getByRole('button',{name:'Registrar solicitud',exact:true}).click();await page.locator('#mis-solicitudes').getByText('Solicitada',{exact:true}).waitFor();await vistaPrivada('solicitud');
   await page.getByRole('button',{name:'Cancelar solicitud',exact:true}).click();await page.locator('#mis-solicitudes').getByText('Cancelada',{exact:true}).waitFor();assert.equal(estado.solicitudes.length,1);assert.equal(estado.solicitudes[0].status,'cancelled');
  });
  await probar('Cierre de sesión vuelve a proteger fotografías e historial',async()=>{
   await ir('/cuenta');await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByRole('button',{name:'Entrar a mi cuenta',exact:true}).waitFor();await ir('/fotografias');assert(await page.getByText('Inicia sesión para consultar y guardar',{exact:false}).isVisible());
  });
  await probar('1440, 768 y 390 px: selección, revisión, resultado, reporte, finalización y menú sin desbordamiento',async()=>{
   for(const ancho of [1440,768,390]){
    await page.setViewportSize({width:ancho,height:1000});
    for(const ruta of ['/','/cuenta','/directorio','/solicitudes','/fotografias']){await ir(ruta);await sinDesborde(`${ruta}-${ancho}`);if(ruta==='/'||ancho===390)await captura(`${ruta==='/'?'inicio':ruta.slice(1)}-${ancho}`);}
    await nuevaDemo();await sinDesborde(`seleccion-${ancho}`);await captura(`seleccion-${ancho}`);await seleccionar(CASOS[1]);await sinDesborde(`revision-${ancho}`);await captura(`revision-${ancho}`);
    await resultado();await sinDesborde(`resultado-${ancho}`);await captura(`resultado-${ancho}`);await reporte();await sinDesborde(`reporte-${ancho}`);await captura(`reporte-${ancho}`);await opciones();await page.getByRole('button',{name:'Omitir por ahora',exact:true}).click();await sinDesborde(`final-${ancho}`);await captura(`omitir-${ancho}`);
    if(ancho===390){await page.getByRole('button',{name:'Abrir menú',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await page.getByRole('button',{name:'Cerrar menú',exact:true}).getAttribute('aria-expanded'),'true');await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Odontólogos',exact:true}).focus();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Abrir menú');}
   }
  });
  await probar('Movimiento reducido: sin animaciones persistentes y recorrido completo utilizable',async()=>{
   await page.emulateMedia({reducedMotion:'reduce'});await nuevaDemo();assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
   await seleccionar(CASOS[0]);await resultado();await reporte();await opciones();await page.getByRole('button',{name:'Omitir por ahora',exact:true}).click();
   const animaciones=await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getTiming().iterations===Infinity).length);assert.equal(animaciones,0);
  });
  await probar('Movimiento normal: preparación educativa visible, transición y zoom accesible',async()=>{
   await page.emulateMedia({reducedMotion:'no-preference'});await nuevaDemo();await seleccionar(CASOS[1]);
   const ampliar=page.getByRole('button',{name:'Ampliar imagen',exact:true});await ampliar.click();await page.getByRole('dialog').waitFor();await captura('imagen-ampliada');await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert(await ampliar.evaluate(el=>el===document.activeElement));
   await page.getByRole('button',{name:'Ver mi análisis de ejemplo',exact:true}).click();await page.getByText('Preparando resultados educativos',{exact:false}).waitFor();await captura('preparacion-educativa');await page.getByRole('heading',{name:'Mira el ejemplo con otros ojos.',exact:true}).waitFor();await sinDesborde('resultado-movimiento-normal');
  });
  await probar('Sin errores de ejecución de React ni del proveedor simulado',()=>{assert.deepEqual(erroresPagina,[]);assert.deepEqual(erroresProveedor,[]);});
 } finally {await contexto.close();}
 const resumen={baseURL,backend:'Simulado; ninguna escritura real',limitaciones:['El catálogo contiene referencias editoriales; las tres fotografías clínicas autorizadas siguen pendientes.','Las regiones se verifican contra el catálogo vigente; las referencias pendientes no incluyen marcas clínicas.','Esta ejecución no prueba RLS real ni aislamiento entre cuentas reales.'],catalogo:CASOS.map(c=>({id:c.id,tipoImagen:c.tipoImagen,regiones:c.regiones.length})),fecha:new Date().toISOString(),resultados,erroresPagina,total:resultados.length,aprobadas:resultados.filter(r=>r.resultado==='APROBADA').length};
 await writeFile(path.join(outDir,'resultado-recorrido.json'),JSON.stringify(resumen,null,2));return resumen;
}
