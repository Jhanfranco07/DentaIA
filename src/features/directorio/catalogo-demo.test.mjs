import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_DEMO, AVISO_PERFILES_DEMO, completarCatalogoDemo, unirCatalogoDemo } from "./catalogo-demo.ts";

const puntos = CATALOGO_DEMO.map((p, i) => ({
  id: `a36a2026-0000-4000-8000-0000000000${String(i + 1).padStart(2, "0")}`,
  slug: p.slug, name: p.practice_name, district: p.district, city: "Lima", country: "Perú",
  latitude: p.latitude, longitude: p.longitude, is_demo: true, is_published: true,
  requests_enabled: false, public_label: "DEMO — Clínica ficticia, no ofrece atención real",
}));

test("20 perfiles únicos enlazados con 20 puntos demo, sin cuentas profesionales", () => {
  const perfiles = unirCatalogoDemo(puntos);
  assert.equal(perfiles.length, 20);
  assert.equal(new Set(perfiles.map(p => p.id)).size, 20);
  assert.equal(new Set(perfiles.flatMap(p => p.ubicaciones.map(u => u.id))).size, 20);
  assert.ok(perfiles.every(p => p.is_demo && p.ubicaciones[0].dentist_id === p.id));
  assert.ok(perfiles.every(p => p.ubicaciones[0].practice_address.includes(", Lima, Perú")));
  assert.ok(CATALOGO_DEMO.every(p => p.source_url.startsWith("https://")));
  assert.ok(perfiles.every(p => p.description.includes("no existe vinculación laboral")));
  assert.match(AVISO_PERFILES_DEMO, /No representan profesionales verificados/);
});

test("los filtros existentes encuentran especialidad, distrito y nombre", () => {
  const perfiles = unirCatalogoDemo(puntos);
  assert.ok(perfiles.some(p => p.specialty === "Ortodoncia"));
  assert.ok(perfiles.some(p => p.district === "Miraflores"));
  assert.ok(perfiles.some(p => p.name.toLowerCase().includes("alma")));
  assert.equal(unirCatalogoDemo([...puntos, ...puntos]).length, 20);
});

test("no enlaza puntos ausentes, ocultos ni alterados", () => {
  assert.equal(unirCatalogoDemo(puntos.slice(1)).length, 19);
  assert.equal(unirCatalogoDemo(puntos.map((p, i) => i === 0 ? { ...p, is_published: false } : p)).length, 19);
  assert.equal(unirCatalogoDemo(puntos.map((p, i) => i === 0 ? { ...p, name: "Otro local" } : p)).length, 19);
});

test("mantiene disponibles todas las fichas y los servicios ilustrativos sin base de datos", () => {
  const fichas = completarCatalogoDemo([]);
  assert.deepEqual(fichas.map(ficha => ficha.id), CATALOGO_DEMO.map(perfil => perfil.id));
  assert.ok(fichas.every(ficha => ficha.is_demo && ficha.ubicaciones.length === 0));
  assert.ok(CATALOGO_DEMO.every(perfil => perfil.serviciosIlustrativos.length > 0));
});

test("las fichas locales solo muestran referencias publicadas que coinciden", () => {
  const fichas = completarCatalogoDemo([
    puntos[0],
    { ...puntos[1], is_published: false },
    { ...puntos[2], latitude: puntos[2].latitude + 0.01 },
  ]);
  assert.equal(fichas.length, CATALOGO_DEMO.length);
  assert.deepEqual(fichas.flatMap(ficha => ficha.ubicaciones.map(punto => punto.id)), [puntos[0].id]);
});
