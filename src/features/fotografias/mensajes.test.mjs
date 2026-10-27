import test from 'node:test';
import assert from 'node:assert/strict';
import {mensajeFotografia} from './mensajes.ts';
test('los errores del proveedor nunca se muestran crudos al paciente',()=>{
 for(const error of [new Error('bucket RLS JWT endpoint secreto'),{message:'postgres privado',code:'23514'},null]){
  assert.equal(mensajeFotografia(error,'No pudimos completar la operación.'),'No pudimos completar la operación.');
 }
});
test('la eliminación parcial conserva una instrucción comprensible de reintento',()=>{
 const texto=mensajeFotografia({tipo:'base_datos',archivoAusente:true},'Error');
 assert.match(texto,/Pulsa Eliminar/);assert.doesNotMatch(texto,/Storage|RLS|JWT/);
});
test('sesión y permisos se diferencian de errores de archivo',()=>{
 assert.match(mensajeFotografia({tipo:'sesion'},''),/sesión/);
 assert.match(mensajeFotografia({tipo:'permisos'},''),/autorizar/);
 assert.match(mensajeFotografia(new Error('Solo se permiten imágenes JPG, PNG o WebP.'),''),/JPG/);
});
