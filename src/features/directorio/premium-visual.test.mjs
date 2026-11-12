import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
test("20 retratos premium son locales, están ordenados y son ilustraciones de ejemplo",()=>{
  const bytes=readFileSync("public/directorio/avatares-ilustrados-premium.avif");
  assert.equal(bytes.subarray(4,12).toString("ascii"),"ftypavif");
  assert.ok(bytes.length>10000 && bytes.length<50000);
  const avatar=read("src/features/directorio/AvatarOdontologo.tsx");
  assert.match(avatar,/CATALOGO_DEMO\.map\(\(perfil, indice\) => \(\{ id: perfil\.id, indice \}\)\)/);
  assert.match(avatar,/if \(!rostro\)/);
  const css=read("src/features/directorio/directorio.module.css");
  assert.match(css,/avatares-ilustrados-premium\.avif/);
  assert.match(css,/\.heroPremiumRetratoPrimario/);
  assert.match(css,/\.heroPremiumRetratoSecundario/);
});
test("directorio premium no abandona el portal y no inventa cercanía",()=>{
  const menu=read("src/components/navegacion-portal.ts");
  const dir=read("src/features/directorio/DirectorioLista.tsx");
  const hero=read("src/features/directorio/HeroDirectorioPaciente.tsx");
  const mapa=read("src/features/directorio/mapa-directorio.module.css");
  assert.match(menu,/href: "\/panel\/odontologos"/);
  assert.match(dir,/<HeroDirectorioPaciente \/>/);
  assert.match(dir,/obtenerUbicacionActual\(navigator\.geolocation\)/);
  assert.match(dir,/setRadarActivo\(true\)/);
  assert.match(dir,/cercanos\.map/);
  assert.match(dir,/formatearDistancia\(c\.km\)/);
  assert.match(dir,/referencias más próximas/);
  assert.match(hero,/no están vinculados laboralmente/);
  assert.match(mapa,/prefers-reduced-motion:reduce/);
});
