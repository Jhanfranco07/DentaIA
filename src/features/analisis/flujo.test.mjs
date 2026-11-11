import test from 'node:test';
import assert from 'node:assert/strict';
import {leerSesionDemo,pasoVisible,enlaceDirectorioDemo} from './flujo.ts';
const sesion={casoId:'cuidado-habitual',etapa:'reporte',fechaISO:'2026-10-28T00:00:00.000Z'};
test('la vuelta del directorio conserva únicamente una referencia pública al reporte',()=>{
 assert.deepEqual(leerSesionDemo(JSON.stringify(sesion),[sesion.casoId]),sesion);
 for(const etapa of ['orientacion','final'])assert.equal(leerSesionDemo(JSON.stringify({...sesion,etapa}),[sesion.casoId]).etapa,etapa);
 assert.equal(enlaceDirectorioDemo(sesion.casoId),'/directorio?desde=reporte&caso=cuidado-habitual');
});
test('una sesión manipulada, desconocida o inválida nunca restaura resultados',()=>{
 for(const dato of [null,'{','[]','null',JSON.stringify({...sesion,casoId:'desconocida'}),JSON.stringify({...sesion,etapa:'diagnostico'}),JSON.stringify({...sesion,fechaISO:'inválida'})])assert.equal(leerSesionDemo(dato,[sesion.casoId]),null);
});
test('una preparación interrumpida vuelve a revisión y omitir mantiene el último paso',()=>{
 assert.equal(leerSesionDemo(JSON.stringify({...sesion,etapa:'preparacion'}),[sesion.casoId]).etapa,'revision');
 assert.equal(pasoVisible('final'),5);assert.equal(pasoVisible('recomendaciones'),3);assert.equal(pasoVisible('reporte'),4);
});
