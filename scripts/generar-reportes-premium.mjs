// Ejecutar: node --experimental-strip-types scripts/generar-reportes-premium.mjs [directorio]
// Artefactos locales; no consulta cuentas, no usa servicios y no cambia las fotografías.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { CASOS } from '../src/features/analisis/casos.ts';
import { crearPDF } from '../src/features/analisis/pdf.ts';

const destino = path.resolve(process.argv[2] ?? 'output/pdf/premium');
await mkdir(destino, { recursive: true });
for (const caso of CASOS) {
  const imagen = await readFile(path.join('public', caso.imagen));
  const { data, info } = await sharp(imagen).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#fff' }).jpeg({ quality: 94 }).toBuffer({ resolveWithObject: true });
  const pdf = crearPDF(caso, new Date(), data, info.width, info.height);
  const archivo = path.join(destino, `DentaIA-${caso.id}.pdf`);
  await writeFile(archivo, pdf);
  console.log(`${archivo}: ${pdf.byteLength} bytes; imagen ${info.width} × ${info.height}`);
}
