import test from 'node:test';
import assert from 'node:assert/strict';
import { mensajeErrorCamara, mensajeValidacionFotografia, restriccionesCamara, TAMANO_MAXIMO_FOTOGRAFIA, validarFotografia } from './fotografia.ts';

test('acepta JPG, PNG y WebP de hasta ocho megabytes', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.deepEqual(validarFotografia({ type, size: 1 }), { valido: true });
    assert.deepEqual(validarFotografia({ type, size: TAMANO_MAXIMO_FOTOGRAFIA }), { valido: true });
  }
});

test('rechaza archivos ausentes, vacíos, sobredimensionados y tipos no permitidos', () => {
  assert.deepEqual(validarFotografia(null), { valido: false, motivo: 'faltante' });
  assert.deepEqual(validarFotografia({ type: 'image/png', size: 0 }), { valido: false, motivo: 'vacio' });
  assert.deepEqual(validarFotografia({ type: 'image/gif', size: 100 }), { valido: false, motivo: 'formato' });
  assert.deepEqual(validarFotografia({ type: 'image/jpeg', size: TAMANO_MAXIMO_FOTOGRAFIA + 1 }), { valido: false, motivo: 'tamano' });
  assert.match(mensajeValidacionFotografia('tamano'), /8 MB/);
});

test('solicita la cámara posterior como preferencia y no activa permisos por sí misma', () => {
  assert.deepEqual(restriccionesCamara(), { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
});

test('explica errores comunes de cámara sin ocultar alternativas', () => {
  assert.match(mensajeErrorCamara('NotAllowedError'), /permiso/);
  assert.match(mensajeErrorCamara('NotFoundError'), /No encontramos/);
  assert.match(mensajeErrorCamara('NotReadableError'), /ocupada/);
  assert.match(mensajeErrorCamara('SecurityError'), /contexto seguro/);
  assert.match(mensajeErrorCamara('OtroError'), /subir una fotografía/);
});
