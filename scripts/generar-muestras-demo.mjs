// Referencias EDITORIALES propias. Nunca producen fotografías ni anatomía clínica.
// Las tres fotografías clínicas siguen pendientes: docs/FOTOGRAFIAS_DEMO.md.
// Esta tarea solo regenera los archivos marcados referencia-pendiente; se detiene
// antes de sobreescribir fotografías aprobadas. Ejecutar desde la raíz del repo.
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const casos=[['cuidado-habitual','Cuidado bucal habitual','Una rutina que acompaña tu sonrisa'],['atencion-preventiva','Atención preventiva dental','Prepara tu próxima conversación'],['cuidado-encias','Cuidado de encías','Pequeños hábitos, atención cotidiana']];
const ruta='src/features/analisis/casos.ts';
let catalogo=await readFile(ruta,'utf8');
if(!catalogo.includes('tipoImagen: "referencia-pendiente"'))throw new Error('El catálogo ya no usa referencias pendientes. No se sobreescribirán fotografías.');
for(const [id] of casos){
 const bloque=catalogo.split(`id: "${id}"`)[1]?.split('regiones:')[0];
 if(!bloque?.includes('tipoImagen: "referencia-pendiente"'))throw new Error(`No se reemplazará el recurso aprobado de ${id}.`);
}
await mkdir('public/demo',{recursive:true});
await mkdir('src/features/analisis/fixtures',{recursive:true});
for(let k=0;k<casos.length;k++){
 const [id,titulo,subtitulo]=casos[k];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="840" viewBox="0 0 1400 840"><defs><linearGradient id="f" x2="1" y2="1"><stop stop-color="#102a43"/><stop offset="1" stop-color="#087e8b"/></linearGradient></defs><rect width="1400" height="840" fill="url(#f)"/><circle cx="1240" cy="100" r="420" fill="#fff" opacity=".035"/><circle cx="1240" cy="100" r="300" fill="none" stroke="#fff" stroke-width="2" opacity=".1"/><circle cx="1240" cy="100" r="190" fill="none" stroke="#fff" stroke-width="2" opacity=".1"/><path d="M72 620H1328" stroke="#fff" opacity=".18"/><text x="75" y="120" fill="#ccebea" font-size="25" font-family="sans-serif" letter-spacing="5">DENTAIA · GUÍA EDUCATIVA</text><text x="80" y="310" fill="#fff" font-size="140" font-family="sans-serif" font-weight="bold">0${k+1}</text><text x="80" y="410" fill="#fff" font-size="56" font-family="sans-serif" font-weight="bold">${titulo}</text><text x="80" y="470" fill="#ccebea" font-size="30" font-family="sans-serif">${subtitulo}</text><text x="80" y="695" fill="#fff" font-size="30" font-family="sans-serif">Fotografía pendiente de autorización</text><text x="80" y="748" fill="#ccebea" font-size="24" font-family="sans-serif">Referencia editorial · No es una fotografía clínica</text></svg>`;
 const jpeg=await sharp(Buffer.from(svg)).jpeg({quality:88,mozjpeg:true}).toBuffer();
 await writeFile(`public/demo/${id}.jpg`,jpeg);
 await writeFile(`src/features/analisis/fixtures/${id}.jpg`,await sharp(jpeg).resize(280,168).jpeg({quality:80}).toBuffer());
 const hash=createHash('sha256').update(jpeg).digest('hex');
 catalogo=catalogo.replace(new RegExp(`(id: "${id}",[\\s\\S]*?sha256:) "[^"]+"`),`$1 "${hash}"`);
 console.log(id,hash,jpeg.length);
}
await writeFile(ruta,catalogo);
