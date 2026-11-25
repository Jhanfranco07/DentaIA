import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const ruta = (relativa) => new URL(`../${relativa}`, import.meta.url);
const publicacion = "public/mediapipe/1.2.3";
const paquete = "node_modules/@mediapipe/tasks-vision";
const fuente = "src/features/analisis/guia";
const artefactos = [
  [`${publicacion}/face_landmarker.task`, "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"],
  [`${paquete}/vision_bundle.mjs`, "fb0c02c296f44ce0cc324ba16bd646d8773eb4a7847db4019cc4d0430db7a9b5"],
  [`${paquete}/wasm/vision_wasm_module_internal.js`, "d29996249490361715c769c6a49b43ad47e6ac9a28a8e8bce8d02b238e897851"],
  [`${paquete}/wasm/vision_wasm_module_internal.wasm`, "a269e84b12aefc93c9d6a4d62b01f41e5434a9fa941533bb8e75b1e3d1669e46"],
];

for (const [archivo, esperado] of artefactos) {
  const real = createHash("sha256").update(readFileSync(ruta(archivo))).digest("hex");
  if (real !== esperado) throw new Error(`SHA-256 inesperado para ${archivo}`);
}

const runtime = `${publicacion}/runtime`;
mkdirSync(ruta(runtime), { recursive: true });
for (const [archivo] of artefactos.slice(1)) {
  copyFileSync(ruta(archivo), ruta(`${runtime}/${archivo.split("/").at(-1)}`));
}

// transpileModule solo emite JavaScript. El typecheck del pipeline verifica ambas fuentes.
for (const nombre of ["geometria", "guia.worker"]) {
  const codigo = readFileSync(ruta(`${fuente}/${nombre}.ts`), "utf8");
  const { outputText } = ts.transpileModule(codigo, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  writeFileSync(ruta(`${runtime}/${nombre}.js`), outputText);
}
