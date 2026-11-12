import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../../../../desarrollo/vision-poc/page.tsx", import.meta.url), "utf8");
const backendSource = readFileSync(new URL("../../../../../../services/dental-vision/app/main.py", import.meta.url), "utf8");

function extractStringConstant(name) {
  const match = routeSource.match(new RegExp(`const ${name} =\\s*\\n\\s*("(?:[^"\\\\]|\\\\.)*");`));
  assert.ok(match, `Expected ${name} to remain a string constant`);
  return JSON.parse(match[1]);
}

function extractInstructions() {
  const block = routeSource.match(/const INSTRUCTIONS = \[([\s\S]*?)\]\.join\(" "\);/);
  assert.ok(block, "Expected an instruction list for the language model");
  const lines = [...block[1].matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/gm)];
  return lines.map(([, value]) => JSON.parse(value)).join(" ");
}

test("default explanation uses the correct class meanings and cautious language", () => {
  const explanation = extractStringConstant("DEFAULT_EXPLANATION");
  const sentenceCount = explanation.match(/[.!?](?:\s|$)/g)?.length ?? 0;

  assert.ok(explanation.length < 350);
  assert.equal(sentenceCount, 2);
  assert.match(explanation, /«d» para señalar una posible caries en diente temporal/);
  assert.match(explanation, /«D» en diente permanente/);
  assert.match(explanation, /confianza no indica gravedad/);
  assert.match(explanation, /ni certeza diagnóstica/);
  assert.match(explanation, /es una probabilidad clínica validada/);
});

test("OpenAI instructions restrict output length, claims and empty results", () => {
  const instructions = extractInstructions();

  assert.match(instructions, /español sencillo/);
  assert.match(instructions, /2 o 3 frases/);
  assert.match(instructions, /menos de 350 caracteres/);
  assert.match(instructions, /No describas la imagen ni inventes características/);
  assert.match(instructions, /d minúscula = posible caries en diente temporal/);
  assert.match(instructions, /D mayúscula = posible caries en diente permanente/);
  assert.match(instructions, /No intercambies las letras/);
  assert.match(instructions, /nunca de una caries confirmada ni de un diagnóstico/);
  assert.match(instructions, /Nunca interpretes el porcentaje de confianza como gravedad, certeza diagnóstica o probabilidad de enfermedad/);
  assert.match(instructions, /no hay detecciones en esta imagen/);
  assert.match(instructions, /no digas que los dientes están sanos/);
  assert.match(instructions, /No diagnostiques ni recomiendes tratamientos/);
  assert.match(routeSource, /const MAX_OUTPUT_CHARS = 350;/);
});

test("page keeps one permanent notice and labels the fallback as non-AI", () => {
  assert.match(pageSource, /className=\{styles\.educationalNotice\}/);
  assert.match(pageSource, /sustituye la evaluación de un odontólogo/);
  assert.match(pageSource, /no indica gravedad ni certeza diagnóstica, y no es una probabilidad clínica validada/);
  assert.match(pageSource, /Que no haya marcas no garantiza/);
  assert.match(pageSource, /Texto predeterminado · no generado por IA/);
  assert.match(pageSource, /className=\{styles\.explanation\}/);
  assert.match(pageSource, /d: \{ class_id: 0, description: "Posible caries en diente temporal" \}/);
  assert.match(pageSource, /D: \{ class_id: 1, description: "Posible caries en diente permanente" \}/);
  assert.match(pageSource, /Confianza del modelo: \{Math\.round\(detection\.confidence \* 100\)\}%/);
});

test("FastAPI preserves exact class casing and matching descriptions", () => {
  assert.match(backendSource, /"d": "Posible caries en diente temporal"/);
  assert.match(backendSource, /"D": "Posible caries en diente permanente"/);
  assert.match(backendSource, /class_name: Literal\["d", "D"\]/);
  assert.match(backendSource, /0: "d", 1: "D"/);
  assert.match(backendSource, /def class_description/);
});
