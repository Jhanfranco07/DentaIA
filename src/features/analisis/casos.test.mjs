import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CASOS, AVISO_DEMO, reconocerMuestra} from './casos.ts';
import {enlaceSolicitud} from '../../lib/navegacion.ts';
import {crearPDF} from './pdf.ts';

for(const caso of CASOS){
 test(`muestra ${caso.id}: imagen original válida, hash y resultado fijo`,async()=>{
  const data=await readFile(new URL(`../../../public${caso.imagen}`,import.meta.url));
  assert.equal(data[0],0xff); assert.equal(data[1],0xd8);
  assert.equal(caso.ancho,1280); assert.ok(caso.alto>=636);
  assert.equal(caso.tipoImagen,'fotografia-autorizada');
  assert.ok(caso.fuente.startsWith('https://commons.wikimedia.org/'));
  assert.ok(caso.licenciaUrl.startsWith('https://creativecommons.org/'));
  assert.match(caso.atribucion,/CC0|CC BY-SA 4.0|dominio público/);
  assert.equal((await reconocerMuestra(data))?.id,caso.id);
  assert(caso.observaciones.length>=2);assert(caso.recomendaciones.length>=3);
  assert.equal((await reconocerMuestra(Uint8Array.from(data)))?.id,caso.id);
 });
 test(`reporte ${caso.id}: PDF descargable, advertencia, imagen y xref coherentes`,async()=>{
  const jpg=await readFile(new URL(`./fixtures/${caso.id}.jpg`,import.meta.url));
  const data=Buffer.from(crearPDF(caso,new Date('2026-10-27T18:00:00Z'),jpg,280,Math.round(280*caso.alto/caso.ancho)));
  const text=data.toString('latin1');
  assert(text.startsWith('%PDF-1.4'));assert(text.endsWith('%%EOF\n'));
  assert(text.includes('Resultado simulado para fines académicos'));
  assert(text.includes('No representa un diagnóstico'));
  assert(text.includes(caso.id));assert(text.includes('/Subtype /Image'));
  const xref=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(data.subarray(xref,xref+4).toString(),'xref');
  const entradas=text.slice(xref).split('\n');const cantidad=Number(entradas[1].split(' ')[1]);
  const offsets=entradas.slice(3,3+cantidad-1).map(x=>Number(x.slice(0,10)));
  assert(text.includes('/Subtype /Link'));assert(text.includes('https://dent-ai-five.vercel.app/directorio'));
  offsets.forEach((offset,i)=>assert(data.subarray(offset,offset+20).toString().startsWith(`${i+1} 0 obj`)));
 });
}
test('la asociación depende de bytes y nunca del nombre de archivo',async()=>{
 const data=await readFile(new URL('../../../public/demo/cuidado-habitual.jpg',import.meta.url));
 const alterado=Buffer.from(data);alterado[alterado.length-1]^=1;
 assert.equal(await reconocerMuestra(alterado),null);
 assert.equal((await reconocerMuestra(data)).id,'cuidado-habitual');
});
test('rechaza imágenes desconocidas, vacías o demasiado grandes sin asignar resultados',async()=>{
 for(const data of [new Uint8Array(),new Uint8Array([1,2,3]),new Uint8Array(8_388_609)]) assert.equal(await reconocerMuestra(data),null);
});
test('identificadores estables y regiones acotadas al ejemplo',()=>{
 assert.equal(new Set(CASOS.map(c=>c.id)).size,3);assert.equal(new Set(CASOS.map(c=>c.sha256)).size,3);
 // Solo los casos 2 y 3 tienen referencias manuales; el caso general no recibe marcas.
 assert.deepEqual(CASOS.map(c=>c.regiones.length),[0,1,1]);
 for(const c of CASOS){assert.match(c.sha256,/^[a-f0-9]{64}$/);for(const r of c.regiones){assert(r.x-r.rx>=0&&r.x+r.rx<=1&&r.y-r.ry>=0&&r.y+r.ry<=1);}}
 assert.match(AVISO_DEMO,/simulado/);
});
test('el reporte rechaza imagen inválida, dimensiones imposibles y fecha inválida',()=>{
 assert.throws(()=>crearPDF(CASOS[0],new Date(),new Uint8Array(),1400,840));
 assert.throws(()=>crearPDF(CASOS[0],new Date('invalida'),new Uint8Array([255,216]),1400,840));
 assert.throws(()=>crearPDF(CASOS[0],new Date(),new Uint8Array([255,216]),0,840));
});
test('el enlace de solicitud acepta solo IDs internos válidos',()=>{
 const id='a1560ae0-2fc1-4fbc-87c6-beee116cf2e5';assert.equal(enlaceSolicitud(id),`/solicitudes?odontologo=${id}`);
 for(const id of ['https://otro.test','../cuenta','', '<script>'])assert.equal(enlaceSolicitud(id),'/solicitudes');
});

test('las ilustraciones antiguas no se presentan como fotografías ni conservan resultados',async()=>{
 const antigua=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>Ilustración anterior sin fotografía clínica</text></svg>');
 assert.equal(await reconocerMuestra(antigua),null);
 assert(CASOS.every(c=>c.imagen.endsWith('.jpg')));
});

test('procedencia por archivo y licencias coinciden con el catálogo clínico',async()=>{
 const fuentes=JSON.parse(await readFile(new URL('../../../docs/evidencias/fotografias/fuentes.json',import.meta.url),'utf8'));
 assert.match(fuentes.mirror_commit,/^[a-f0-9]{40}$/);
 for(const caso of CASOS){
  const fuente=fuentes.photos.find(f=>f.caso===caso.id); assert.ok(fuente);
  assert.equal(fuente.optimized_sha256,caso.sha256);
  assert.equal(fuente.original_source.url,caso.fuente);
  assert.equal(fuente.width,caso.ancho);assert.equal(fuente.height,caso.alto);
  assert.ok(fuente.mirror_file.includes(fuentes.mirror_commit));
 }
});
