import test from 'node:test';
import assert from 'node:assert/strict';
import { validarAcceso, validarNombre, validarRegistro, mensajeError } from './validaciones.ts';

test('rechaza campos vacíos y correo inválido; permite contraseñas existentes cortas al ingresar', () => {
  assert.ok(validarAcceso('', ''));
  assert.ok(validarAcceso('sin-correo', 'ejemplo'));
  assert.equal(validarAcceso(' demo@example.test ', '123456'), null);
});
test('registro valida nombre, longitud y confirmación', () => {
  for (const nombre of ['', ' ', 'A', 'A'.repeat(121)]) assert.ok(validarNombre(nombre));
  for (const nombre of ['Ab', 'A'.repeat(120)]) assert.equal(validarNombre(nombre), null);
  assert.ok(validarRegistro('Paciente Demo', 'demo@example.test', 'corta', 'corta'));
  assert.ok(validarRegistro('Paciente Demo', 'demo@example.test', 'Segura123!', 'Otra123!'));
  assert.equal(validarRegistro('Paciente Demo', 'demo@example.test', 'Segura123!', 'Segura123!'), null);
});
test('traduce errores sin exponer el mensaje del proveedor', () => {
  assert.match(mensajeError({code:'invalid_credentials'}), /correo o la contraseña/);
  assert.match(mensajeError({code:'email_not_confirmed'}), /Confirma/);
  assert.match(mensajeError({code:'weak_password'}), /reglas de seguridad/);
  assert.match(mensajeError(new Error('secreto-interno')), /conexión/);
  assert.doesNotMatch(mensajeError({message:'secreto-interno'}), /secreto/);
  assert.match(mensajeError(new Error('Falta configurar .env.local.')), /configuración de conexión/);
  assert.match(mensajeError({code:'over_request_rate_limit'}), /Espera/);
});
