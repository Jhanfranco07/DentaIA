import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CASOS } from './casos.ts';
import { crearPDF } from './pdf.ts';

const fecha = new Date('2026-10-28T01:00:00Z');
const textoVisible = pdf => [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map(m => m[1].replace(/\\([\\()])/g, '$1')).join(' ');
for (const caso of CASOS) {
  test(`PDF premium ${caso.id}: A4, contenido, una imagen y enlace accesible`, async () => {
    const jpg = await readFile(new URL(`./fixtures/${caso.id}.jpg`, import.meta.url));
    const pdf = Buffer.from(crearPDF(caso, fecha, jpg, 280, Math.round(280 * caso.alto / caso.ancho)));
    const texto = pdf.toString('latin1');
    assert.match(texto, /\/MediaBox \[0 0 595 842\]/);
    assert.match(texto, /\/Count 1/);
    assert.equal((texto.match(/\/Subtype \/Image/g) ?? []).length, 1);
    for (const contenido of ['Reporte preventivo', 'Resultado simulado para fines académicos', 'No representa un diagnóstico', 'Tu siguiente paso es una elección', '27 de octubre de 2026', caso.id]) assert.ok(texto.includes(contenido), contenido);
    assert.match(texto, /\/Subtype \/Link/);
    assert.ok(texto.includes('https://dent-ai-five.vercel.app/directorio'));
    if (caso.tipoImagen === 'fotografia-autorizada') {
      assert.ok(!texto.includes('pendiente de autorización'));
      assert.ok(texto.includes('Fuente original'));
      assert.ok(texto.includes(caso.fuente));
      assert.ok(texto.includes(caso.licenciaUrl));
      assert.ok(textoVisible(texto).includes(caso.atribucion));
      assert.ok(textoVisible(texto).includes('En este PDF: reescalado'));
      assert.equal(textoVisible(texto).includes('y contorno educativo'), caso.regiones.length > 0);
      assert.equal((texto.match(/\/Subtype \/Link/g) ?? []).length, 3);
    }
    // Solo los casos con regiones tienen curvas de contorno; el caso general no recibe marcas.
    assert.equal(texto.includes('1.8 w'), caso.regiones.length > 0);
    assert.match(texto, /\(1 \/ 1\)/);
  });
}

test('PDF conserva la proporción de fotografías horizontales y verticales', async () => {
  const jpg = await readFile(new URL('./fixtures/cuidado-habitual.jpg', import.meta.url));
  for (const [ancho, alto] of [[1600, 800], [800, 1600], [1000, 1000]]) {
    const texto = Buffer.from(crearPDF(CASOS[0], fecha, jpg, ancho, alto)).toString('latin1');
    const matriz = texto.match(/q ([\d.]+) 0 0 ([\d.]+) [\d.]+ [\d.]+ cm \/Im1 Do Q/);
    assert.ok(matriz);
    assert.ok(Math.abs(Number(matriz[1]) / Number(matriz[2]) - ancho / alto) < .001);
    assert.ok(Number(matriz[1]) <= 326 && Number(matriz[2]) <= 201);
  }
});

test('PDF rechaza fechas, dimensiones y regiones no válidas sin producir documentos incompletos', async () => {
  const jpg = await readFile(new URL('./fixtures/cuidado-habitual.jpg', import.meta.url));
  assert.throws(() => crearPDF(CASOS[0], new Date('invalid'), jpg, 280, 168));
  assert.throws(() => crearPDF(CASOS[0], fecha, new Uint8Array([1, 2]), 280, 168));
  assert.throws(() => crearPDF(CASOS[0], fecha, jpg, 0, 168));
  assert.throws(() => crearPDF({ ...CASOS[0], regiones: [{ x: 2, y: .5, rx: .1, ry: .1, etiqueta: 'inválida' }] }, fecha, jpg, 280, 168));
});


test('PDF solo marca regiones definidas para la referencia y etiqueta el material pendiente con transparencia', async () => {
  const jpg = await readFile(new URL('./fixtures/cuidado-habitual.jpg', import.meta.url));
  const caso = { ...CASOS[0], tipoImagen: 'referencia-pendiente', atribucion: 'Referencia editorial DentaIA · no es una fotografía clínica', regiones: [] };
  const pendiente = Buffer.from(crearPDF(caso, fecha, jpg, 280, 168)).toString('latin1');
  assert.ok(pendiente.includes('Referencia editorial. Fotografía clínica pendiente de autorización.'));
  assert.ok(!pendiente.includes('Fotografía de referencia. No pertenece'));
  assert.equal(pendiente.includes('1.8 w'), false);
  const conRegion = Buffer.from(crearPDF({ ...caso, regiones: [{ x: .5, y: .5, rx: .1, ry: .1, etiqueta: 'Referencia de prueba' }] }, fecha, jpg, 280, 168)).toString('latin1');
  assert.equal(conRegion.includes('1.8 w'), true);
});


test('PDF mantiene autor, licencia y cambios de una fotografía reutilizada con enlaces verificables', async () => {
  const jpg = await readFile(new URL('./fixtures/atencion-preventiva.jpg', import.meta.url));
  const caso = { ...CASOS[1], tipoImagen: 'fotografia-autorizada', atribucion: 'Dentición humana · Autor de prueba · CC BY-SA 4.0 · Adaptación: tamaño y compresión JPEG.', fuente: 'https://commons.wikimedia.org/wiki/File:Referencia.jpg', licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' };
  const texto = Buffer.from(crearPDF(caso, fecha, jpg, 280, 210)).toString('latin1');
  assert.ok(textoVisible(texto).includes(caso.atribucion));
  assert.ok(texto.includes(caso.fuente));
  assert.ok(texto.includes(caso.licenciaUrl));
  assert.ok(texto.includes('/Annots [8 0 R 9 0 R 10 0 R]'));
});
