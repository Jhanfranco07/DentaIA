import test from "node:test";
import assert from "node:assert/strict";

import {
  formatearPrecio,
  normalizar,
  textoOpcional,
  inicialesDe,
} from "./formato.ts";

// formatearPrecio

test("formatearPrecio: muestra un precio válido en soles", () => {
  assert.match(formatearPrecio(150, "PEN"), /S\/\s*150/);
});

test("formatearPrecio: sin moneda usa soles", () => {
  assert.match(formatearPrecio(150, null), /S\/\s*150/);
  assert.match(formatearPrecio(150, "  "), /S\/\s*150/);
});

  test("formatearPrecio: acepta otra moneda válida", () => {
    const texto = formatearPrecio(100, "usd");
    assert.match(texto, /USD|\$/);
    assert.match(texto, /100/);
    assert.doesNotMatch(texto, /S\//);
  });

test("formatearPrecio: una moneda inválida cae a soles", () => {
  assert.match(formatearPrecio(80, "INVALIDO"), /S\/\s*80/);
});

test("formatearPrecio: no inventa un precio si el dato no es válido", () => {
  assert.equal(formatearPrecio(null, "PEN"), "Precio no disponible");
  assert.equal(formatearPrecio(undefined, "PEN"), "Precio no disponible");
  assert.equal(formatearPrecio(NaN, "PEN"), "Precio no disponible");
  assert.equal(formatearPrecio(Infinity, "PEN"), "Precio no disponible");
});

// normalizar

test("normalizar: quita tildes y pasa a minúsculas", () => {
  assert.equal(normalizar("Odontopediatría"), "odontopediatria");
});

test("normalizar: recorta espacios y maneja texto vacío", () => {
  assert.equal(normalizar("  ORTODONCIA "), "ortodoncia");
  assert.equal(normalizar(""), "");
});

// textoOpcional

test("textoOpcional: devuelve el texto recortado si existe", () => {
  assert.equal(textoOpcional("  Dra. Rivera  ", "x"), "Dra. Rivera");
});

test("textoOpcional: usa la alternativa si falta o está vacío", () => {
  assert.equal(textoOpcional(null, "no indicado"), "no indicado");
  assert.equal(textoOpcional(undefined, "no indicado"), "no indicado");
  assert.equal(textoOpcional("   ", "no indicado"), "no indicado");
});

// inicialesDe

test("inicialesDe: usa las iniciales guardadas si existen", () => {
  assert.equal(inicialesDe("DF", "Otro Nombre"), "DF");
});

test("inicialesDe: las deriva del nombre si vienen vacías", () => {
  assert.equal(inicialesDe("  ", "Daniel Flores"), "DF");
  assert.equal(inicialesDe(null, "Andrea"), "A");
});

test("inicialesDe: devuelve ? si no hay datos", () => {
  assert.equal(inicialesDe(null, ""), "?");
  assert.equal(inicialesDe("", "   "), "?");
});