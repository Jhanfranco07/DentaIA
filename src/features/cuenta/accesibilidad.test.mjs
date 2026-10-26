import test from 'node:test';
import assert from 'node:assert/strict';
import { validarFormularioCuenta } from './validaciones.ts';

const base = {registro:false,nombre:'Paciente Demo',email:'demo@example.test',password:'ClaveDemo123!',confirmacion:'ClaveDemo123!'};

test('login vacío dirige la corrección al correo; después a la contraseña',()=>{
  assert.equal(validarFormularioCuenta({...base,email:'',password:''}).campo,'email');
  assert.equal(validarFormularioCuenta({...base,password:''}).campo,'password');
});
test('correo mal formado identifica email, sin marcar el nombre oculto del login',()=>{
  assert.equal(validarFormularioCuenta({...base,nombre:'',email:'invalido'}).campo,'email');
});
test('registro identifica el primer campo incorrecto en orden de lectura',()=>{
  assert.equal(validarFormularioCuenta({...base,registro:true,nombre:'A',email:''}).campo,'nombre');
  assert.equal(validarFormularioCuenta({...base,registro:true,password:'corta'}).campo,'password');
  assert.equal(validarFormularioCuenta({...base,registro:true,confirmacion:'otra'}).campo,'confirmacion');
});
test('cada error incluye un mensaje y no expone el valor de contraseña',()=>{
  const error=validarFormularioCuenta({...base,registro:true,confirmacion:'no-coincide'});
  assert.ok(error.mensaje.length>0);
  assert.doesNotMatch(error.mensaje,/ClaveDemo123|no-coincide/);
});
test('campos válidos y contraseña existente corta no reciben estado de error',()=>{
  assert.equal(validarFormularioCuenta({...base,registro:true}),null);
  assert.equal(validarFormularioCuenta({...base,password:'123456'}),null);
});
