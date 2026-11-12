import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("hoja local de ilustraciones AVIF con siete personajes", () => {
  const base = process.cwd();
  const asset = readFileSync(join(base,"public/educacion/ilustraciones-premium.avif"));
  assert.ok(asset.length > 10000 && asset.length < 35000);
  assert.equal(asset.subarray(4,12).toString("ascii"),"ftypavif");
  const hero = readFileSync(join(base,"public/educacion/mascota-premium.avif"));
  assert.ok(hero.length > 9000 && hero.length < 20000);
  assert.equal(hero.subarray(4,12).toString("ascii"),"ftypavif");
  const css = readFileSync(join(base,"src/features/buenas-practicas/buenas-practicas.module.css"),"utf8");
  const component = readFileSync(join(base,"src/features/buenas-practicas/BuenasPracticas.tsx"),"utf8");
  const sprite = readFileSync(join(base,"src/features/buenas-practicas/Ilustracion3D.tsx"),"utf8");
  assert.match(css,/ilustraciones-premium\.avif/);
  for(const id of ["cepillado","hilo","alimentacion","fluor","encias","controles","heroe"]){
    assert.ok(css.includes(`data-tipo="${id}"`));
    assert.ok(sprite.includes(`"${id}"`));
  }
  assert.match(component,/Ilustracion3D/);
  assert.match(component,/useRef/);
  assert.match(component,/moverTarjetas/);
});
