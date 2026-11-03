import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { firmarCursor, verificarCursor } from './cursor.ts';
const secret=randomBytes(32).toString('base64url');
const binding={actor:'actor-fixture',session:'session-fixture',patient:'patient-fixture',membership:'membership-fixture',limit:1};
const context={professional:'professional-fixture',clinic:'clinic-fixture'};
const position={beforeAt:'2026-11-03T10:00:00.123456Z',beforeId:'entry-fixture'};
const sign=()=>firmarCursor(secret,binding,context,position,300,2000,1000);
test('cursor conserva precisión PostgreSQL y contexto sin normalizar fechas',()=>{
 const p=verificarCursor(secret,sign(),binding,1001);assert.deepEqual(p.position,position);assert.equal(p.professional,context.professional);assert.equal(p.clinic,context.clinic);
});
test('cursor usa cifrado opaco y nonce diferente en cada emisión',()=>{
 const a=sign(),b=sign();assert.notEqual(a,b);assert.ok(!a.includes(position.beforeAt));assert.ok(!Buffer.from(a.split('.')[2],'base64url').toString().includes(binding.actor));
});
test('alterar IV, ciphertext, tag o firma rechaza cursor',()=>{
 for(const n of [1,2,3,4]){const parts=sign().split('.');parts[n]=(parts[n][0]==='A'?'B':'A')+parts[n].slice(1);assert.equal(verificarCursor(secret,parts.join('.'),binding,1001),null);}
});
test('cursor se vincula a identidad, sesión, paciente, contexto y filtros',()=>{
 for(const [k,v]of Object.entries({...binding,limit:2})){const other={...binding,[k]:k==='limit'?2:v+'-otro'};assert.equal(verificarCursor(secret,sign(),other,1001),null);}
});
test('cursor vencido o emitido en el futuro se rechaza',()=>{
 assert.equal(verificarCursor(secret,sign(),binding,1300),null);assert.equal(verificarCursor(secret,sign(),binding,999),null);
});
test('cursor no supera expiración del JWT y rotar clave invalida anteriores',()=>{
 const c=firmarCursor(secret,binding,context,position,300,1010,1000);assert.equal(verificarCursor(secret,c,binding,1010),null);assert.equal(verificarCursor(randomBytes(32).toString('base64url'),sign(),binding,1001),null);
});
test('formato o tamaño de cursor inválido se rechazan sin excepciones públicas',()=>{
 for(const x of ['','v2.a.b.c.d','v1.!','x'.repeat(3000)])assert.equal(verificarCursor(secret,x,binding,1001),null);
});
test('firma no acepta secreto débil ni vigencia fuera de límites',()=>{
 assert.throws(()=>firmarCursor('weak',binding,context,position,300,2000,1000));assert.throws(()=>firmarCursor(secret,binding,context,position,901,2000,1000));
});
test('representaciones base64url no canónicas también se rechazan',()=>{
 const c=sign(),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
 const changed=c.slice(0,-1)+alphabet[alphabet.indexOf(c.at(-1))^1];
 assert.equal(verificarCursor(secret,changed,binding,1001),null);
});
