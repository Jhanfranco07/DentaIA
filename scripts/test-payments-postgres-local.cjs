/* PostgreSQL nativo DESECHABLE por socket Unix. Nunca recibe URLs ni claves remotas.
 * Driver opcional: instalar pg@8.16.3 fuera del proyecto y suministrar NODE_PATH.
 */
const { Client } = require('pg');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { randomBytes } = require('node:crypto');
const { values } = parseArgs({ options: {
  socket: { type: 'string' }, port: { type: 'string', default: '55438' }, output: { type: 'string' },
} });
assert(values.socket && path.isAbsolute(values.socket), 'Se exige --socket con directorio Unix absoluto; no se admiten hosts TCP ni URLs.');
assert(fs.statSync(values.socket).isDirectory());
assert(/^\d+$/.test(values.port));
const migrationPath = path.join(__dirname, '../supabase/migrations/20261113011041_payments.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');
const name = `dentaia_stripe_${randomBytes(8).toString('hex')}`;
const connect = (database) => new Client({ host: values.socket, port: Number(values.port), database,
  user: 'postgres', password: '', ssl: false, connectionTimeoutMillis: 5000 });
const admin = connect('postgres');
const results = [];
let db, created = false, version;
async function test(label, fn) {
  try { await fn(); results.push({ nombre: label, aprobada: true }); console.log(`PASS ${label}`); }
  catch (error) { results.push({ nombre: label, aprobada: false, detalle: error.message }); console.error(`FAIL ${label}: ${error.message}`); }
}
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (session, event, user = id(1), status = 'paid', amount = 2000) =>
  [user, session, event, 'premium-demo', amount, 'usd', status];
const insert = 'insert into public.payments(user_id,stripe_session_id,stripe_event_id,plan,amount_total,currency,status) values ($1,$2,$3,$4,$5,$6,$7) returning *';
async function expectedError(sql, params, code, constraint) {
  await db.query('savepoint expected_failure');
  try {
    await db.query(sql, params);
    assert.fail(`Se esperaba SQLSTATE ${code}`);
  } catch (error) {
    assert.equal(error.code, code);
    if (constraint) assert.equal(error.constraint, constraint);
  } finally { await db.query('rollback to savepoint expected_failure'); }
}
async function asRole(role, user, fn) {
  assert(['anon','authenticated','service_role'].includes(role));
  await db.query('begin');
  try {
    await db.query(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
    await fn();
  } finally { await db.query('rollback'); }
}
(async () => {
 try {
  await admin.connect();
  version=(await admin.query('select version() as version')).rows[0].version;
  assert.equal((await admin.query('show listen_addresses')).rows[0].listen_addresses, '', 'El servidor de pruebas no debe aceptar TCP.');
  assert.equal((await admin.query("select to_regclass('auth.users')::text as t")).rows[0].t, null, 'El clúster debe ser desechable, sin Auth de la aplicación.');
  for (const role of ['anon','authenticated','service_role']) {
    const existing = await admin.query('select rolsuper,rolbypassrls,rolcanlogin from pg_roles where rolname=$1', [role]);
    if (!existing.rowCount) await admin.query(`create role ${role} nologin ${role==='service_role'?'bypassrls':'nobypassrls'}`);
    else assert.deepEqual(existing.rows[0], { rolsuper:false, rolbypassrls:role==='service_role', rolcanlogin:false });
  }
  await admin.query(`create database ${name}`); created = true;
  db = connect(name); await db.connect();
  await db.query(`
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    -- Fixture deliberadamente permisivo: comprobar que REVOKE neutraliza defaults.
    alter default privileges in schema public grant all on tables to public, anon, authenticated, service_role;
    create table public.sentinel(id integer primary key, value text not null);
    insert into public.sentinel values (1, 'sin cambios');
  `);
  const sentinel = (await db.query('select * from public.sentinel')).rows;
  await test('Fallo tras CREATE TABLE revierte toda la migración y conserva la tabla centinela local', async () => {
    const broken = migration.replace(/commit;\s*$/i, "select 1 / 0;\ncommit;");
    await assert.rejects(db.query(broken), error => error.code === '22012');
    await db.query('rollback');
    assert.equal((await db.query("select to_regclass('public.payments')::text as t")).rows[0].t, null);
    assert.deepEqual((await db.query('select * from public.sentinel')).rows, sentinel);
  });
  await test('Migración final completa: parseo y aplicación transaccional en PostgreSQL real', async () => {
    assert(/^begin;/i.test(migration.trim()) && /commit;$/i.test(migration.trim()));
    await db.query(migration);
  });
  await test('Nueve columnas, tipos, NOT NULL y solo dos DEFAULT', async () => {
    const cols = (await db.query("select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='payments' order by ordinal_position")).rows;
    assert.deepEqual(cols.map(x=>x.column_name),['id','user_id','stripe_session_id','stripe_event_id','plan','amount_total','currency','status','created_at']);
    assert.deepEqual(cols.map(x=>x.data_type),['uuid','uuid','text','text','text','integer','text','text','timestamp with time zone']);
    assert(cols.every(x=>x.is_nullable==='NO'));
    assert.deepEqual(cols.filter(x=>x.column_default!==null).map(x=>x.column_name),['id','created_at']);
    assert.match(cols[0].column_default,/gen_random_uuid/); assert.match(cols[8].column_default,/now\(\)/);
  });
  await test('PK, FK con CASCADE, dos UNIQUE y CHECK válidos', async () => {
    const cs = (await db.query("select conname,contype,confdeltype,convalidated,pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.payments'::regclass")).rows;
    assert.equal(cs.filter(x=>x.contype==='p').length,1);assert.equal(cs.filter(x=>x.contype==='u').length,2);assert.equal(cs.filter(x=>x.contype==='c').length,1);
    const fk=cs.find(x=>x.contype==='f'); assert.equal(fk.confdeltype,'c');assert.match(fk.def,/REFERENCES auth.users\(id\)/);
    assert(cs.every(x=>x.convalidated));
  });
  await test('Índice B-tree válido en user_id', async () => {
    const index = (await db.query("select i.indisvalid,pg_get_indexdef(i.indexrelid) as def from pg_index i where i.indexrelid='public.payments_user_id_idx'::regclass")).rows[0];
    assert(index.indisvalid);assert.match(index.def,/USING btree \(user_id\)/);
  });
  await test('RLS habilitado; única política SELECT para authenticated y auth.uid()', async () => {
    assert((await db.query("select relrowsecurity from pg_class where oid='public.payments'::regclass")).rows[0].relrowsecurity);
    const ps=(await db.query("select policyname,roles::text[] as roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename='payments'")).rows;
    assert.equal(ps.length,1);assert.equal(ps[0].policyname,'payments_select_own');assert.deepEqual(ps[0].roles,['authenticated']);assert.equal(ps[0].cmd,'SELECT');assert.match(ps[0].qual,/user_id.*SELECT auth.uid\(\)/s);assert.equal(ps[0].with_check,null);
  });
  await test('Grants mínimos neutralizan privilegios heredados de PUBLIC y roles cliente', async () => {
    for (const role of ['anon','authenticated','service_role']) for (const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) {
      const actual=(await db.query('select has_table_privilege($1,$2,$3) as allowed',[role,'public.payments',privilege])).rows[0].allowed;
      const expected=role==='service_role'?['SELECT','INSERT','UPDATE','DELETE'].includes(privilege):role==='authenticated'&&privilege==='SELECT';
      assert.equal(actual,expected,`${role} ${privilege}`);
    }
  });
  await db.query('insert into auth.users(id) values ($1),($2),($3)',[id(1),id(2),id(3)]);
  await test('service_role escribe sin identidad de usuario y DEFAULT genera UUID/fecha', async () => {
    await db.query('begin');
    try {
      await db.query('set local role service_role');
      const p=(await db.query(insert,row('cs_own','evt_own'))).rows[0];
      assert.match(p.id,/^[a-f0-9-]{36}$/);assert(p.created_at instanceof Date);assert.equal(p.amount_total,2000);
      await db.query(insert,row('cs_other','evt_other',id(2),'unpaid'));
      await db.query(insert,row('cs_expired','evt_expired',id(3),'expired',0));
      await db.query('commit');
    } catch(error) { await db.query('rollback');throw error; }
  });
  for (const n of [1,2,3]) await test(`RLS usuario ${n}: solo su fila, incluso filtrando por otra identidad`, () => asRole('authenticated',id(n),async()=>{
    const rows=(await db.query('select user_id from public.payments')).rows;assert.equal(rows.length,1);assert.equal(rows[0].user_id,id(n));
    assert.equal((await db.query('select * from public.payments where user_id=$1',[id(n===1?2:1)])).rowCount,0);
  }));
  await test('authenticated sin sub no obtiene pagos',()=>asRole('authenticated',null,async()=>assert.equal((await db.query('select * from public.payments')).rowCount,0)));
  await test('anon no puede SELECT aunque suministre un sub',()=>asRole('anon',id(1),()=>expectedError('select * from public.payments',[],'42501')));
  for (const role of ['anon','authenticated']) for (const [operation,sql,params] of [
    ['INSERT',insert,row('cs_denied','evt_denied')],
    ['UPDATE','update public.payments set status=$1 where user_id=$2',['expired',id(1)]],
    ['DELETE','delete from public.payments where user_id=$1',[id(1)]],
    ['TRUNCATE','truncate public.payments',[]],
  ]) await test(`${role}: ${operation} denegado por privilegios SQL`,()=>asRole(role,id(1),()=>expectedError(sql,params,'42501')));
  await test('RLS sigue bloqueando escrituras si un grant futuro se concede por error',()=>asRole('service_role',null,async()=>{
    // SET ROLE cambia en esta transacción aislada; no deja grants persistentes.
    await db.query('reset role');
    await db.query('grant insert,update,delete on public.payments to authenticated');
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id(1)]);
    await expectedError(insert,row('cs_rls_denied','evt_rls_denied'),'42501');
    assert.equal((await db.query("update public.payments set status='expired' where user_id=$1",[id(1)])).rowCount,0);
    assert.equal((await db.query('delete from public.payments where user_id=$1',[id(1)])).rowCount,0);
  }));
  await test('Sesión duplicada: 23505 sobre payments_stripe_session_id_key',()=>asRole('service_role',null,()=>expectedError(insert,row('cs_own','evt_new'),'23505','payments_stripe_session_id_key')));
  await test('Evento duplicado: 23505 sobre payments_stripe_event_id_key',()=>asRole('service_role',null,()=>expectedError(insert,row('cs_new','evt_own'),'23505','payments_stripe_event_id_key')));
  await test('Reentrega del mismo evento con ON CONFLICT no crea otra fila',()=>asRole('service_role',null,async()=>{
    const result=await db.query(insert.replace(' returning *',' on conflict (stripe_event_id) do nothing returning *'),row('cs_own','evt_own'));assert.equal(result.rowCount,0);
    assert.equal((await db.query('select count(*)::integer as n from public.payments')).rows[0].n,3);
  }));
  await test('Evento distinto sobre la misma sesión no queda cubierto por ON CONFLICT de evento',()=>asRole('service_role',null,()=>expectedError(insert.replace(' returning *',' on conflict (stripe_event_id) do nothing returning *'),row('cs_own','evt_different'),'23505','payments_stripe_session_id_key')));
  await test('Estado no permitido: CHECK 23514',()=>asRole('service_role',null,()=>expectedError(insert,row('cs_invalid','evt_invalid',id(1),'refunded'),'23514','payments_status_check')));
  await test('FK rechaza usuario inexistente: 23503',()=>asRole('service_role',null,()=>expectedError(insert,row('cs_fk','evt_fk',id(99)),'23503','payments_user_id_fkey')));
  for (let i=0;i<7;i++) await test(`NOT NULL: campo obligatorio ${['user_id','stripe_session_id','stripe_event_id','plan','amount_total','currency','status'][i]}`,()=>asRole('service_role',null,()=>{
    const args=row('cs_null','evt_null');args[i]=null;return expectedError(insert,args,'23502');
  }));
  await test('Monto exige INTEGER: fracción y desbordamiento rechazados',()=>asRole('service_role',null,async()=>{
    await expectedError(insert,row('cs_fraction','evt_fraction',id(1),'paid','1.5'),'22P02');
    await expectedError(insert,row('cs_overflow','evt_overflow',id(1),'paid','2147483648'),'22003');
  }));
  await test('service_role puede actualizar y eliminar en contexto backend',()=>asRole('service_role',null,async()=>{
    assert.equal((await db.query("update public.payments set status='paid' where user_id=$1",[id(2)])).rowCount,1);
    assert.equal((await db.query('delete from public.payments where user_id=$1',[id(3)])).rowCount,1);
  }));
  await test('ON DELETE CASCADE elimina solo los pagos del usuario borrado',async()=>{
    await db.query('begin');
    try { await db.query('delete from auth.users where id=$1',[id(3)]);assert.equal((await db.query('select * from public.payments where user_id=$1',[id(3)])).rowCount,0);assert.equal((await db.query('select * from public.payments')).rowCount,2); }
    finally { await db.query('rollback'); }
  });
  await test('Tabla centinela permanece intacta tras toda la batería',async()=>assert.deepEqual((await db.query('select * from public.sentinel')).rows,sentinel));
 } finally {
  if(db) await db.end();
  if(created) await admin.query(`drop database ${name}`);
  await admin.end();
  const report={postgres:version,contexto:'PostgreSQL local desechable por socket Unix; Auth y roles fixture, sin Supabase remoto',migration:path.basename(migrationPath),pruebas:results,aprobadas:results.filter(x=>x.aprobada).length,fallidas:results.filter(x=>!x.aprobada).length};
  if(values.output) fs.writeFileSync(values.output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({aprobadas:report.aprobadas,fallidas:report.fallidas}));
 }
 if(results.some(x=>!x.aprobada))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
