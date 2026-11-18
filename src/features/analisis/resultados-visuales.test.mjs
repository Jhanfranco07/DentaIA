import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const result = readFileSync(new URL("./ResultadosVisuales.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("./AnalisisDental.tsx", import.meta.url), "utf8");
const practices = readFileSync(new URL("../../app/paciente/buenas-practicas/page.tsx", import.meta.url), "utf8");

test("dos análisis se muestran en tarjetas estructuradas y con textos clínicamente prudentes", () => {
  assert.match(page, /<ResultadosVisuales result=\{resultado\} oral=\{oral\}/);
  assert.match(result, /Color de tus dientes/);
  assert.match(result, /Posición y posibles ausencias dentales/);
  assert.match(result, /oral\?\.status === "evaluated"/);
  assert.match(result, /no necesariamente a dientes distintos/);
  assert.match(result, /no constituye diagnóstico/);
});

test("la cobertura de regiones no se presenta como precisión clínica", () => {
  assert.match(result, /result\.evaluable_regions \/ result\.detected_regions/);
  assert.match(result, /no es precisión ni confianza diagnóstica/);
  assert.doesNotMatch(result, /Math\.round\(d\.confidence \* 100\)/);
});

test("las recomendaciones y funciones Premium tienen destino y expectativas claras", () => {
  assert.match(result, /href="\/paciente\/buenas-practicas"/);
  assert.match(result, /href="\/premium"/);
  assert.match(result, /PRÓXIMAMENTE/);
  assert.match(practices, /higiene dental/);
  assert.match(practices, /no permite identificar por sí sola la causa/i);
});
