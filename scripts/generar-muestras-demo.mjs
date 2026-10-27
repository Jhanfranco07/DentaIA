// Ilustraciones originales de Jhan para DentaIA. Sin imágenes ni datos de pacientes.
// sharp ya forma parte del lockfile de Next.js; este script no se ejecuta en producción.
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const casos=[['cuidado-habitual','Cuidado bucal habitual'],['atencion-preventiva','Atención preventiva'],['cuidado-encias','Cuidado de encías']];
await mkdir('public/demo',{recursive:true});
await mkdir('src/features/analisis/fixtures',{recursive:true});
let catalogo=await readFile('src/features/analisis/casos.ts','utf8');
for(let k=0;k<casos.length;k++){
 const [id,titulo]=casos[k];
 let dientes='';
 for(let fila=0;fila<2;fila++)for(let i=0;i<10;i++){
  const x=245+i*91,y=fila?495:306,rot=(i-4.5)*(fila?-1.2:1.2);
  dientes+=`<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M-32 -38C-40 -62 40 -62 32 -38L35 34C33 55 10 62 0 50C-12 63 -35 54 -35 34Z" fill="${k===1&&fila===0&&i===6?'#fff3d9':'#fffefa'}" stroke="#aec9d3" stroke-width="3"/><path d="M-20 7Q0 19 20 7M0 15v18" fill="none" stroke="#d9e5e8" stroke-width="3" stroke-linecap="round"/></g>`;
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="840" viewBox="0 0 1400 840"><rect width="1400" height="840" fill="#f2f8fb"/><circle cx="700" cy="410" r="295" fill="#e4f1f4"/><rect x="165" y="205" width="1070" height="395" rx="180" fill="#d99caa"/><path d="M204 399Q700 441 1196 399" fill="none" stroke="#af6e82" stroke-width="9"/><path d="M215 245Q700 218 1185 245M215 557Q700 587 1185 557" fill="none" stroke="#e6b2bc" stroke-width="25" stroke-linecap="round"/>${dientes}<rect x="70" y="60" width="175" height="40" rx="9" fill="#087f83"/><text x="91" y="87" font-size="20" font-family="sans-serif" fill="white" font-weight="bold">MUESTRA 0${k+1}</text><text x="70" y="155" font-size="31" font-family="sans-serif" fill="#183247" font-weight="bold">${titulo}</text><text x="700" y="704" text-anchor="middle" font-size="22" font-family="sans-serif" fill="#466779">Ilustración sintética para demostración</text><text x="700" y="743" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#5a7484">Sin pacientes reales · Sin análisis automático</text></svg>`;
 await writeFile(`public/demo/${id}.svg`,svg);
 const png=await sharp(Buffer.from(svg)).png().toBuffer();
 await writeFile(`public/demo/${id}.png`,png);
 await writeFile(`src/features/analisis/fixtures/${id}.jpg`,await sharp(png).resize(280,168).jpeg({quality:80}).toBuffer());
 const hash=createHash('sha256').update(png).digest('hex');
 catalogo=catalogo.replace(new RegExp(`(id: "${id}",[\\s\\S]*?sha256:) "[^"]+"`),`$1 "${hash}"`);
 console.log(id,hash,png.length);
}
await writeFile('src/features/analisis/casos.ts',catalogo);
