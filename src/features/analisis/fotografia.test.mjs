import test from 'node:test';
import assert from 'node:assert/strict';
import { cambioCamaraConfirmado, mensajeErrorCamara, mensajeValidacionFotografia, restriccionesCamara, TAMANO_MAXIMO_FOTOGRAFIA, validarFotografia } from './fotografia.ts';

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

test('prefiere la cámara posterior al abrir y exige la orientación al alternar', () => {
  const dimensiones = { width: { ideal: 1920 }, height: { ideal: 1080 } };
  assert.deepEqual(restriccionesCamara(), { audio: false, video: { facingMode: { ideal: 'environment' }, ...dimensiones } });
  for (const orientacion of ['user', 'environment']) {
    assert.deepEqual(restriccionesCamara(orientacion, true), { audio: false, video: { facingMode: { exact: orientacion }, ...dimensiones } });
  }
});

test('explica errores comunes de cámara sin ocultar alternativas', () => {
  assert.match(mensajeErrorCamara('NotAllowedError'), /permiso/);
  assert.match(mensajeErrorCamara('NotFoundError'), /No encontramos/);
  assert.match(mensajeErrorCamara('NotReadableError'), /ocupada/);
  assert.match(mensajeErrorCamara('SecurityError'), /contexto seguro/);
  assert.match(mensajeErrorCamara('OtroError'), /subir una fotografía/);
});

test('confirma el cambio con la orientación entregada o con identificadores distintos y facingMode exacto soportado', () => {
  assert.equal(cambioCamaraConfirmado(undefined, { facingMode: 'user' }, 'user', false), true);
  assert.equal(cambioCamaraConfirmado('posterior', { deviceId: 'frontal' }, 'user', true), true);
});

test('rechaza datos contradictorios y no da por confirmado un cambio con metadatos insuficientes', () => {
  assert.equal(cambioCamaraConfirmado('misma', { deviceId: 'misma', facingMode: 'user' }, 'user', true), false);
  assert.equal(cambioCamaraConfirmado('posterior', { deviceId: 'otra', facingMode: 'environment' }, 'user', true), false);
  assert.equal(cambioCamaraConfirmado('posterior', { deviceId: 'otra' }, 'user', false), false);
  assert.equal(cambioCamaraConfirmado(undefined, { deviceId: 'otra' }, 'user', true), false);
  assert.equal(cambioCamaraConfirmado('posterior', { deviceId: '' }, 'user', true), false);
  assert.equal(cambioCamaraConfirmado(undefined, {}, 'user', true), false);
  assert.equal(cambioCamaraConfirmado(undefined, undefined, 'user', true), false);
});
