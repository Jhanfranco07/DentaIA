import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { consultarServicios, datosServicio, guardarServicio } from "./servicios-odontologicos.ts";

const formulario = {
  nombre: " Limpieza dental ", descripcion: " ", duracion: "35",
  precio: "120,50", moneda: "pen", publicado: false,
};
const dentista = "b1310000-0000-4000-8000-000000000001";
const servicio = {
  id: "d1310000-0000-4000-8000-000000000001",
  dentist_id: dentista,
  ...datosServicio(formulario),
  updated_at: "2026-11-17T00:00:00.000Z",
};

function prepararCliente(filas) {
  const solicitudes = [];
  const cliente = createClient("https://supabase.example.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      solicitudes.push({ url: new URL(url), metodo: init.method, cuerpo: JSON.parse(init.body ?? "null") });
      const respuesta = new Headers(init.headers).get("accept") === "application/vnd.pgrst.object+json"
        ? filas[0]
        : filas;
      return Response.json(respuesta);
    } },
  });
  return { cliente, solicitudes };
}

test("normaliza datos opcionales, moneda y precio con coma decimal", () => {
  assert.deepEqual(datosServicio(formulario), {
    name: "Limpieza dental", description: null, duration_minutes: 35,
    price_amount: 120.5, currency_code: "PEN", is_active: false,
  });
  assert.equal(datosServicio({ ...formulario, precio: "0" }).price_amount, 0);
  assert.equal(datosServicio({ ...formulario, precio: "", duracion: "" }).duration_minutes, null);
});

test("rechaza datos incompatibles con las restricciones del catálogo", () => {
  for (const entrada of [
    { nombre: " " }, { nombre: "x".repeat(161) }, { descripcion: "x".repeat(2001) },
    { duracion: "4" }, { duracion: "481" }, { duracion: "35.5" },
    { precio: "-1" }, { precio: "100000000" }, { precio: "1,505" }, { moneda: "P3N" },
  ]) {
    assert.throws(() => datosServicio({ ...formulario, ...entrada }));
  }
});

test("consulta pública filtra por odontólogo y solo trae servicios publicados", async () => {
  const { cliente, solicitudes } = prepararCliente([]);
  const signal = new AbortController().signal;
  await consultarServicios(cliente, dentista, true, signal);
  await consultarServicios(cliente, dentista, false, signal);
  const [publica, privada] = solicitudes.map(solicitud => solicitud.url);
  assert.equal(publica.pathname, "/rest/v1/dentist_services");
  assert.equal(publica.searchParams.get("dentist_id"), `eq.${dentista}`);
  assert.equal(publica.searchParams.get("is_active"), "eq.true");
  assert.equal(publica.searchParams.get("order"), "sort_order.asc,name.asc");
  assert.equal(privada.searchParams.get("is_active"), null);
});

test("registra un borrador y actualiza su publicación sobre el mismo propietario y revisión", async () => {
  const { cliente, solicitudes } = prepararCliente([servicio]);
  const creado = await guardarServicio(cliente, dentista, datosServicio(formulario), null);
  const editado = await guardarServicio(cliente, dentista, datosServicio({ ...formulario, publicado: true }), servicio);
  assert.equal(creado.error, null);
  assert.equal(editado.error, null);
  const [alta, cambio] = solicitudes;
  assert.equal(alta.metodo, "POST");
  assert.equal(alta.cuerpo.dentist_id, dentista);
  assert.equal(alta.cuerpo.is_active, false);
  assert.equal(cambio.metodo, "PATCH");
  assert.equal(cambio.cuerpo.is_active, true);
  assert.equal("dentist_id" in cambio.cuerpo, false);
  assert.equal(cambio.url.searchParams.get("dentist_id"), `eq.${dentista}`);
  assert.equal(cambio.url.searchParams.get("id"), `eq.${servicio.id}`);
  assert.equal(cambio.url.searchParams.get("updated_at"), `eq.${servicio.updated_at}`);
  assert.ok(Date.parse(cambio.cuerpo.updated_at) > Date.parse(servicio.updated_at));
});

test("una edición sin filas afectadas no devuelve un servicio guardado", async () => {
  const { cliente } = prepararCliente([]);
  const respuesta = await guardarServicio(cliente, dentista, datosServicio(formulario), servicio);
  assert.equal(respuesta.error, null);
  assert.equal(respuesta.data, null);
});
