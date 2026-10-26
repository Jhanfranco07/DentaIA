import test from 'node:test';
import assert from 'node:assert/strict';
import { leerPerfil, guardarPerfil } from './perfiles.ts';

function cliente({id='propio', perfil={id:'propio', full_name:'Paciente Demo'}, error=null}={}) {
  const llamadas=[];
  const resultado=()=>Promise.resolve({data:perfil,error});
  const query={select(...args){llamadas.push(['select',...args]);return this;},eq(...args){llamadas.push(['eq',...args]);return this;},maybeSingle:resultado,single:resultado,
    insert(data){llamadas.push(['insert',data]);return this;},update(data){llamadas.push(['update',data]);return this;}};
  return {llamadas,auth:{getUser:async()=>({data:{user:id ? {id}:null},error:null})},from(tabla){llamadas.push(['from',tabla]);return query;}};
}
test('sin sesión o con otro usuario no consulta ni modifica perfiles',async()=>{
  for(const id of [null,'ajeno']) {
    const c=cliente({id});
    await assert.rejects(()=>leerPerfil(c,'propio'));
    await assert.rejects(()=>guardarPerfil(c,'propio','Paciente Demo',false));
    assert.deepEqual(c.llamadas,[]);
  }
});
test('lectura filtra por el usuario validado; ausencia de perfil se conserva',async()=>{
  const c=cliente({perfil:null});
  assert.equal(await leerPerfil(c,'propio'),null);
  assert.ok(c.llamadas.some(x=>x[0]==='eq' && x[1]==='id' && x[2]==='propio'));
});
test('edición envía solo full_name; creación usa el ID verificado',async()=>{
  const c=cliente();
  await guardarPerfil(c,'propio',' Paciente Demo ',false);
  assert.deepEqual(c.llamadas.find(x=>x[0]==='update'),['update',{full_name:'Paciente Demo'}]);
  assert.ok(c.llamadas.some(x=>x[0]==='eq' && x[2]==='propio'));
  const nuevo=cliente(); await guardarPerfil(nuevo,'propio','Paciente Demo',true);
  assert.deepEqual(nuevo.llamadas.find(x=>x[0]==='insert'),['insert',{id:'propio',full_name:'Paciente Demo'}]);
});
test('propaga errores de RLS o red y rechaza nombres inválidos',async()=>{
  const c=cliente({error:{code:'42501'}});
  await assert.rejects(()=>guardarPerfil(c,'propio','Paciente Demo',false));
  await assert.rejects(()=>leerPerfil(c,'propio'));
  const invalido=cliente(); await assert.rejects(()=>guardarPerfil(invalido,'propio',' ',false));
  assert.deepEqual(invalido.llamadas,[]);
});
