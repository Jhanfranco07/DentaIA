import test from "node:test";
import assert from "node:assert/strict";

import { filtrarDentistas, listarDistritos } from "./formato.ts";

const lista = [
  { name: "Dra. Prueba Uno", specialty: "Odontopediatría", district: "Distrito A" },
  { name: "Dr. Prueba Dos", specialty: "Ortodoncia", district: "Distrito B " },
  { name: "Dr. Prueba Tres", specialty: "Endodoncia", district: "Distrito A" },
];

test("filtrarDentistas: sin filtros devuelve todos", () => {
  assert.equal(filtrarDentistas(lista, "", "").length, 3);
});

test("filtrarDentistas: busca por nombre sin importar tildes ni mayúsculas", () => {
  const r = filtrarDentistas(lista, "  PRUEBA dos ", "");
  assert.deepEqual(r.map(d => d.name), ["Dr. Prueba Dos"]);
});

test("filtrarDentistas: busca por especialidad sin tildes", () => {
  const r = filtrarDentistas(lista, "odontopediatria", "");
  assert.deepEqual(r.map(d => d.name), ["Dra. Prueba Uno"]);
});

test("filtrarDentistas: filtra por distrito exacto, ignorando espacios sobrantes", () => {
  assert.equal(filtrarDentistas(lista, "", "Distrito A").length, 2);
  assert.equal(filtrarDentistas(lista, "", "Distrito B").length, 1);
});

test("filtrarDentistas: combina texto y distrito", () => {
  const r = filtrarDentistas(lista, "endodoncia", "Distrito A");
  assert.deepEqual(r.map(d => d.name), ["Dr. Prueba Tres"]);
  assert.equal(filtrarDentistas(lista, "endodoncia", "Distrito B").length, 0);
});

test("filtrarDentistas: sin coincidencias devuelve una lista vacía", () => {
  assert.deepEqual(filtrarDentistas(lista, "zzz", ""), []);
});

test("filtrarDentistas: no modifica la lista original", () => {
  filtrarDentistas(lista, "zzz", "Distrito A");
  assert.equal(lista.length, 3);
});

test("listarDistritos: únicos, recortados y ordenados", () => {
  assert.deepEqual(listarDistritos(lista), ["Distrito A", "Distrito B"]);
});

test("listarDistritos: ignora distritos vacíos y lista vacía", () => {
  assert.deepEqual(listarDistritos([{ name: "x", specialty: "y", district: "  " }]), []);
  assert.deepEqual(listarDistritos([]), []);
});