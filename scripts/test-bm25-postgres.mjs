import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { after, test } from "node:test";
import { abrirBaseBm25, administracion, consultar, directorio, historial, odontologos, solicitudes, usuarios } from "../supabase/tests/bm25-environment.mjs";
import { CATALOGO_DEMO } from "../src/features/directorio/catalogo-demo.ts";
import { perfilesQa } from "../src/features/directorio/qa-preview.ts";

const db = await abrirBaseBm25();
after(() => db.close());
const ids = elementos => elementos.map(e => e.id);
const [luz, eva, oculto] = odontologos;
const [paciente, otro, sinPerfil, invalido] = usuarios;

test("el directorio conserva la proyección de las fichas ficticias del repositorio", async () => {
  const { rows } = await db.query(`
    select id, slug, name, specialty, district, latitude, longitude, reference_name, reference_address, services, qa
    from dentaia_search.directory_demo order by id
  `);
  const esperaba = [...CATALOGO_DEMO.map(d => ({
    id: d.id, slug: d.slug, name: d.name, specialty: d.specialty, district: d.district,
    latitude: d.latitude, longitude: d.longitude, reference_name: d.practice_name,
    reference_address: d.practice_address, services: d.serviciosIlustrativos.join(" "), qa: false,
  })), ...perfilesQa().map(d => ({
    id: d.id, slug: d.slug, name: d.name, specialty: d.specialty, district: d.district,
    latitude: null, longitude: null, reference_name: null, reference_address: null, services: null, qa: true,
  }))].sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(rows, esperaba);
});

test("aplica fórmula, parámetros y tokenización de PostgreSQL", async () => {
  const { rows: [row] } = await db.query(`
    select dentaia_search.bm25(3, 2, 10, 8, 6) score,
      dentaia_search.bm25(3, 2, 10, 8, 6, 1.2, 0) no_length,
      (select array_agg(term order by term) from dentaia_search.query_terms('Odontólogos en LÍMA')) a,
      (select array_agg(term order by term) from dentaia_search.query_terms('odontologo lima')) b
  `);
  const esperado = Math.log1p((10 - 2 + 0.5) / (2 + 0.5)) * 3 * 2.2 / (3 + 1.2 * (0.25 + 0.75 * 8 / 6));
  assert.ok(Math.abs(esperado - row.score) < 1e-10);
  assert.ok(row.no_length > row.score);
  assert.deepEqual(row.a, row.b);
});

test("directorio ordena por campos ponderados y pagina después de los filtros", async () => {
  const pagina = await directorio(db, { q: "cuadrante", tamano: 1 });
  const segunda = await directorio(db, { q: "cuadrante", tamano: 1, pagina: 2 });
  assert.deepEqual([pagina.total, ...ids(pagina.items), ...ids(segunda.items)], [2, luz, eva]);
  assert.deepEqual(ids((await directorio(db, { q: "Cuadrante", distrito: "Cusco", especialidad: "Odontología general" })).items), [eva]);
  assert.deepEqual(ids((await directorio(db, { q: "cuadrante", lat: -12.05, lon: -77.04, radio: 5 })).items), [luz]);
  const lima = await directorio(db, { q: "ortodoncista en Lima", distrito: "Lima" });
  assert.deepEqual(ids(lima.items.slice(0, 2)), ["d36a2026-0000-4000-8000-000000000009", luz]);
  assert.equal((await directorio(db, { q: "blanqueamiento dental" })).items[0].id, luz);
  assert.equal((await directorio(db, { q: "secretoautorizado" })).total, 0);
  assert.equal((await directorio(db, { q: "claveborrador" })).total, 0);
  assert.equal((await directorio(db, { q: "Punto privado" })).total, 0);
  assert.equal(pagina.items[0].ubicaciones.length, 1);
  assert.equal(pagina.items[0].promedio, 5);
  assert.equal(pagina.items[0].totalResenas, 1);
  assert.equal((await directorio(db, { distrito: "Lima", tamano: 1, pagina: 10 })).pagina > 1, true);
  await assert.rejects(directorio(db, { tamano: 51 }), { code: "22023" });
  await assert.rejects(directorio(db, { q: "x".repeat(161) }), { code: "22023" });
  await assert.rejects(directorio(db, { radio: 5 }), { code: "22023" });
});

test("solicitudes combina ranking, fechas y estado dentro de un único propietario", async () => {
  const juntos = await historial(db, paciente, { q: "Luz matutino", tamano: 1, estado: "requested" });
  assert.deepEqual([juntos.total, juntos.totalSolicitudes, ...ids(juntos.items)], [1, 2, solicitudes[0]]);
  assert.deepEqual(ids((await historial(db, paciente, { q: "matutino" })).items), [solicitudes[0]]);
  assert.deepEqual(ids((await historial(db, paciente, { q: "2030-03-09" })).items), [solicitudes[1]]);
  assert.equal((await historial(db, paciente, { q: "2030-02-31" })).total, 0);
  assert.deepEqual(ids((await historial(db, paciente, { pagina: 2, tamano: 1 })).items), [solicitudes[0]]);
  assert.equal((await historial(db, paciente, { q: "privadocontacto privadomensaje" })).total, 0);
  assert.equal((await historial(db, otro, { q: "privadomensaje" })).total, 1);
  assert.equal(await consultar(db, "authenticated", paciente,
    "select count(*)::int resultado from dentaia_search.documents where scope = 'requests/' || $1", [otro]), 0);
  assert.equal((await db.query("select count(*)::int n from dentaia_search.terms where term like 'privadomensaj%' or term like 'matutin%'")).rows[0].n, 0);
  await assert.rejects(consultar(db, "anon", null,
    "select public.dentaia_buscar_solicitudes('', 'todas', 1, 12) resultado"), { code: "42501" });
});

test("administración respeta permisos, filtros vigentes y UUID exacto sin perfil", async () => {
  assert.deepEqual(ids((await administracion(db, { q: "Lucia" })).usuarios), [paciente, otro]);
  assert.deepEqual(ids((await administracion(db, { q: "Lucía", rol: "odontologo", estado: "suspendida" })).usuarios), [otro]);
  assert.deepEqual(ids((await administracion(db, { q: "Cárdenas", rol: "asignacion_invalida" })).usuarios), [invalido]);
  assert.equal((await administracion(db, { q: sinPerfil, rol: "sin_asignacion" })).usuarios[0].perfil.estado, "ausente");
  assert.equal((await administracion(db, { q: sinPerfil.slice(0, 12) })).total, 0);
  for (const rol of ["anon", "authenticated"]) {
    await assert.rejects(consultar(db, rol, paciente,
      "select public.dentaia_buscar_usuarios('Lucia','todos','todos',1,5) resultado"), { code: "42501" });
    await assert.rejects(consultar(db, rol, paciente,
      "select dentaia_search.rebuild() resultado"), { code: "42501" });
  }
});

test("mantiene publicaciones, cambios de nombre, bajas, escrituras revertidas y reconstrucción", async () => {
  await db.exec(`update public.dentist_services set is_active = true where name = 'Claveborrador';
    update public.profiles set full_name = 'Nombreindexado' where id = '${paciente}';`);
  assert.equal((await directorio(db, { q: "claveborrador" })).items[0].id, luz);
  assert.equal((await administracion(db, { q: "Nombreindexado" })).usuarios[0].id, paciente);
  await assert.rejects(db.transaction(async tx => {
    await tx.exec(`update public.dentists set name = 'Nombrevertido' where id = '${luz}'`);
    throw new Error("rollback");
  }), /rollback/);
  assert.equal((await directorio(db, { q: "nombrevertido" })).total, 0);
  await db.exec(`update public.dentists set is_active = false where id = '${luz}'`);
  assert.equal((await directorio(db, { q: "claveborrador" })).total, 0);
  assert.equal((await historial(db, paciente, { q: "Luz" })).total, 0);
  await db.exec(`update public.dentists set is_active = true where id = '${luz}';
    update public.dentists set is_active = true where id = '${oculto}';`);
  assert.equal((await directorio(db, { q: "secretoautorizado" })).items[0].id, oculto);
  await db.exec(`delete from public.dentists where id = '${oculto}';
    update public.dentist_services set is_active = false where name = 'Claveborrador';
    update public.profiles set full_name = 'Lucía Cárdenas' where id = '${paciente}';`);
  assert.equal((await directorio(db, { q: "secretoautorizado" })).total, 0);

  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${paciente}';
    insert into public.appointment_requests (id,user_id,dentist_id,contact_name,preferred_date)
    values ('dd000000-0000-4000-8000-000000000001','${paciente}','${luz}','Nuevocontacto','2030-03-20');
    reset role;`);
  assert.equal((await historial(db, paciente, { q: "nuevocontacto" })).total, 1);
  await db.exec("delete from public.appointment_requests where id = 'dd000000-0000-4000-8000-000000000001'");
  assert.equal((await historial(db, paciente, { q: "nuevocontacto" })).total, 0);
  const antes = await db.query("select * from dentaia_search.corpus order by scope");
  await db.exec("select dentaia_search.rebuild()");
  assert.deepEqual((await db.query("select * from dentaia_search.corpus order by scope")).rows, antes.rows);
  const { rows: [stats] } = await db.query(`
    select count(*)::int n from dentaia_search.terms t where df is distinct from
      (select count(*)::int from dentaia_search.postings p where (p.scope, p.term) = (t.scope, t.term))
  `);
  assert.equal(stats.n, 0);
});

test("relevancia reproducible y latencia del RPC en una base pequeña", async t => {
  const contexto = { filas: 24, consultas: [
    ["Luz Cuadrante", [luz]],
    ["Cuadrante", [luz]],
    ["ortodoncista en Lima", [luz, "d36a2026-0000-4000-8000-000000000009"]],
    ["blanqueamiento dental", [luz]],
    ["odontólogo infantil", ["d36a2026-0000-4000-8000-000000000005", "d36a2026-0000-4000-8000-000000000012", "d36a2026-0000-4000-8000-000000000019"]],
  ] };
  const listado = (await directorio(db, { tamano: 50 })).items;
  assert.equal(listado.length, contexto.filas);
  const staticDocs = (await db.query("select id,name,specialty from dentaia_search.directory_demo")).rows;
  const publicDocs = (await db.query("select id,name,specialty from public.dentists where is_active order by name")).rows;
  const normalizar = s => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const anteriores = [...publicDocs, ...staticDocs];
  function evaluar(resultados) {
    const total = { precision5: 0, recall10: 0, mrr: 0, ndcg10: 0 };
    for (const [i, [, relevantes]] of contexto.consultas.entries()) {
      const top = resultados[i].slice(0, 10).map(id => Number(relevantes.includes(id)));
      const dcg = top.reduce((s, n, j) => s + n / Math.log2(j + 2), 0);
      const maxDcg = relevantes.reduce((s, _, j) => s + 1 / Math.log2(j + 2), 0);
      const primero = top.indexOf(1);
      total.precision5 += top.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      total.recall10 += top.reduce((a, b) => a + b, 0) / relevantes.length;
      total.mrr += primero < 0 ? 0 : 1 / (primero + 1);
      total.ndcg10 += dcg / maxDcg;
    }
    return Object.fromEntries(Object.entries(total).map(([k, v]) => [k, Number((v / contexto.consultas.length).toFixed(3))]));
  }
  const antes = [], despues = [], tiempos = [];
  for (const [q] of contexto.consultas) {
    antes.push(ids(anteriores.filter(d => [d.name,d.specialty].some(s => normalizar(s).includes(normalizar(q))))));
    despues.push(ids((await directorio(db, { q })).items));
  }
  for (let i = 0; i < 40; i++) {
    const inicio = performance.now();
    await directorio(db, { q: contexto.consultas[i % contexto.consultas.length][0] });
    tiempos.push(performance.now() - inicio);
  }
  tiempos.sort((a, b) => a - b);
  const nuevo = evaluar(despues);
  assert.ok(nuevo.recall10 >= 0.8 && nuevo.mrr >= 0.8, JSON.stringify(nuevo));
  t.diagnostic(JSON.stringify({ documentosPublicos: listado.length, consultas: contexto.consultas.length,
    antes: evaluar(antes), bm25: nuevo, ms: { p50: tiempos[19].toFixed(2), p95: tiempos[37].toFixed(2) } }));
});
