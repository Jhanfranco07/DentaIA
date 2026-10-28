import test from 'node:test';
import assert from 'node:assert/strict';
import { contextoReporte, enlaceSolicitud, retornoSolicitud } from '../../lib/navegacion.ts';
const id='55555555-5555-4555-8555-555555555555';

test('el contexto conserva solo el caso conocido y descarta parámetros arbitrarios',()=>{
 assert.equal(contextoReporte('?desde=reporte&caso=cuidado-encias&redirect=https://evil.test'),'desde=reporte&caso=cuidado-encias');
 for(const q of ['?desde=reporte&caso=desconocido','?desde=otro&caso=cuidado-encias','?desde=reporte&caso=https://evil.test','']) assert.equal(contextoReporte(q),'');
});
test('la solicitud conserva el profesional validado y el regreso al reporte',()=>{
 assert.equal(enlaceSolicitud(id,'desde=reporte&caso=cuidado-habitual'),`/solicitudes?odontologo=${id}&desde=reporte&caso=cuidado-habitual`);
 assert.equal(enlaceSolicitud('../cuenta'),'/solicitudes');
 assert.equal(enlaceSolicitud(id,'desde=reporte&caso=otro'),`/solicitudes?odontologo=${id}`);
});
test('continuar tras autenticación nunca acepta redirecciones externas ni otras rutas',()=>{
 for(const value of [null,'','https://evil.test','//evil.test/solicitudes?odontologo='+id,'/cuenta','/solicitudes?odontologo=invalido','/solicitudes/../cuenta?odontologo='+id]) {
  assert.equal(retornoSolicitud(value),null,value);
 }
 assert.equal(retornoSolicitud(`/solicitudes?odontologo=${id}&desde=reporte&caso=cuidado-encias&next=https://evil.test`),`/solicitudes?odontologo=${id}&desde=reporte&caso=cuidado-encias`);
});
