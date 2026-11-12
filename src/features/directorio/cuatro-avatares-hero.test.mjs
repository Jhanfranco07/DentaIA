import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(p,"utf8");
test("portada premium fotográfica: dos odontólogos reales y crédito visible",()=>{
 const respaldo=readFileSync("public/hero/hero-1.jpg");
 assert.equal(respaldo.subarray(0,3).toString("hex"),"ffd8ff");
 const hero=read("src/features/directorio/HeroDirectorioPaciente.tsx");
 assert.match(hero,/pexels\.com\/photos\/37458083/);
 assert.match(hero,/Emily Gaibor \/ Pexels/);
 assert.match(hero,/Fotografía ilustrativa de dos profesionales odontológicos/);
 assert.doesNotMatch(hero,/AvatarOdontologo/);
 assert.match(hero,/unoptimized priority/);
 const css=read("src/features/directorio/directorio.module.css");
 assert.match(css,/\.heroPremiumFotografia/);
 assert.match(css,/hero-1\.jpg/);
});
test("los cuatro perfiles demo legacy tienen retrato original en lista y detalle",()=>{
 const data=readFileSync("public/directorio/cuatro-avatares-demo.avif");
 assert.equal(data.subarray(4,12).toString("ascii"),"ftypavif");
 assert.ok(data.length>=9000);
 const avatar=read("src/features/directorio/AvatarOdontologo.tsx");
 const ids=[
  "a1560ae0-2fc1-4fbc-87c6-beee116cf2e5",
  "77a14fc8-1007-4f62-b65d-70c83a137caa",
  "99acc934-68a7-4fa7-8075-8deafb3e4cf8",
  "823f21dd-bf4b-4dec-9bd6-dd5416e7213d"
 ];
 for(const id of ids)assert.ok(avatar.includes(id));
 assert.match(avatar,/antiguo % 2/);
 assert.match(avatar,/styles\.avatarLegado/);
 const listado=read("src/features/directorio/DirectorioLista.tsx");
 const detalle=read("src/features/directorio/DentistaDetalle.tsx");
 assert.match(listado,/AvatarOdontologo id=\{d\.id\}/);
 assert.match(detalle,/AvatarOdontologo id=\{carga\.dentista\.id\}/);
 assert.match(read("src/features/directorio/directorio.module.css"),/cuatro-avatares-demo\.avif/);
});
test("el directorio no inventa ubicación de perfiles sin coordenadas",()=>{
 const lista=read("src/features/directorio/DirectorioLista.tsx");
 const detalle=read("src/features/directorio/DentistaDetalle.tsx");
 assert.match(lista,/Sin consultorio publicado en/);
 assert.match(detalle,/No hay dirección ni coordenadas asociadas/);
 assert.match(detalle,/no se inventa un marcador exacto/);
 assert.match(detalle,/ubicaciones\.length \?/);
});
