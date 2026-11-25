import assert from "node:assert/strict";
import { test } from "node:test";
import { BUSCAR, estabilizarEncuadre, evaluarEncuadre, orientarBoca } from "./geometria.ts";

function rostro({ x = .5, apertura = .045, escala = .55, giro = 0, nariz = x } = {}) {
  const puntos = [];
  for (const [i, px, py] of [
    [61, x - .09, .66 - giro], [291, x + .09, .66 + giro],
    [13, x, .66 - apertura / 2], [14, x, .66 + apertura / 2],
    [10, x, .52 - escala / 2], [152, x, .52 + escala / 2],
    [234, x - .17, .52], [454, x + .17, .52], [1, nariz, .52],
  ]) puntos[i] = { x: px, y: py };
  return puntos;
}

const evaluar = puntos => evaluarEncuadre(puntos, 640, 480);

test("distingue el rostro y la pérdida de seguimiento", () => {
  const senal = evaluar(rostro());
  assert.equal(senal.indicacion, "lista");
  assert.equal(senal.boca.x, .5);
  assert.equal(senal.boca.y, .66);
  assert.deepEqual(evaluar(undefined), BUSCAR);
  assert.deepEqual(evaluar([{ x: 0, y: 0 }]), BUSCAR);
});

test("prioriza el encuadre y reconoce inclinación, giro lateral y distancia relativa", () => {
  assert.equal(evaluar(rostro({ x: .78, giro: .06 })).indicacion, "centrar");
  assert.equal(evaluar(rostro({ giro: .06 })).indicacion, "enderezar");
  assert.equal(evaluar(rostro({ nariz: .59 })).indicacion, "enderezar");
  assert.equal(evaluar(rostro({ escala: .3 })).indicacion, "acercar");
  assert.equal(evaluar(rostro({ escala: .85 })).indicacion, "alejar");
});

test("estima la apertura con la separación de labios en relación con el ancho de la boca", () => {
  assert.equal(evaluar(rostro({ apertura: .01 })).indicacion, "abrir");
  assert.equal(evaluar(rostro({ apertura: .045 })).indicacion, "lista");
});

test("estabiliza cambios, oculta el contorno al perder el rostro y vuelve a adquirirlo", () => {
  const procesar = estabilizarEncuadre();
  const lista = evaluar(rostro());
  const abrir = evaluar(rostro({ apertura: .01 }));
  assert.deepEqual(procesar(lista), BUSCAR);
  assert.deepEqual(procesar(lista), BUSCAR);
  assert.equal(procesar(lista).indicacion, "lista");
  assert.equal(procesar(abrir).indicacion, "lista");
  assert.equal(procesar(abrir).indicacion, "lista");
  assert.equal(procesar(lista).indicacion, "lista");
  assert.deepEqual(procesar(BUSCAR), { indicacion: "lista", boca: null });
  procesar(BUSCAR);
  assert.deepEqual(procesar(BUSCAR), BUSCAR);
  assert.deepEqual(procesar(lista), BUSCAR);
  procesar(lista);
  assert.equal(procesar(lista).indicacion, "lista");
});

test("calcula ángulos en píxeles y refleja el contorno conforme a la vista frontal", () => {
  const puntos = rostro({ x: .6, giro: .018 });
  const horizontal = evaluarEncuadre(puntos, 640, 480).boca;
  const vertical = evaluarEncuadre(puntos, 480, 640).boca;
  assert.ok(vertical.angulo > horizontal.angulo);
  assert.equal(orientarBoca(horizontal, false), horizontal);
  assert.deepEqual(orientarBoca(horizontal, true), { ...horizontal, x: 1 - horizontal.x, angulo: -horizontal.angulo });
});
