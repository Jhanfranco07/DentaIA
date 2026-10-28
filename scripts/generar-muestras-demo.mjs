// Las fotografías aprobadas NO se sintetizan ni se sobrescriben.
// Este script verifica su hash/procedencia y regenera solo los JPEG de pruebas.
// Ejecutar: node --experimental-strip-types scripts/generar-muestras-demo.mjs
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CASOS } from '../src/features/analisis/casos.ts';
const fuentes=JSON.parse(await readFile('docs/evidencias/fotografias/fuentes.json','utf8'));
await mkdir('src/features/analisis/fixtures',{recursive:true});
for(const caso of CASOS){
 const contenido=await readFile(`public${caso.imagen}`);
 const hash=createHash('sha256').update(contenido).digest('hex');
 const fuente=fuentes.photos.find(f=>f.caso===caso.id);
 const {width,height}=await sharp(contenido).metadata();
 if(caso.tipoImagen!=='fotografia-autorizada'||hash!==caso.sha256||hash!==fuente?.optimized_sha256||width!==caso.ancho||height!==caso.alto||fuente.original_source.url!==caso.fuente)throw new Error(`Verifica la fotografía y su procedencia: ${caso.id}. No se modificará el original.`);
 await writeFile(`src/features/analisis/fixtures/${caso.id}.jpg`,await sharp(contenido).resize({width:280}).jpeg({quality:85}).toBuffer());
 console.log(`${caso.id}: fotografía, hash, dimensiones y fuente verificados`);
}
