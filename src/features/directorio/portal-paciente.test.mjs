import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, statSync} from "node:fs";

const leer = ruta => readFileSync(ruta, "utf8");
test("el paciente navega a un directorio privado protegido y conserva sus fichas", () => {
  const menu = leer("src/components/navegacion-portal.ts");
  const panel = leer("src/features/panel/PanelPaciente.tsx");
  const pagina = leer("src/app/(paciente)/panel/odontologos/page.tsx");
  const detalle = leer("src/app/(paciente)/panel/odontologos/[id]/page.tsx");
  const ficha = leer("src/features/directorio/DentistaDetalle.tsx");
  assert.match(menu, /href: "\/panel\/odontologos", etiqueta: "Odontólogos"/);
  assert.match(panel, /href="\/panel\/odontologos"/);
  assert.match(pagina, /rolesRequeridos=\{\["paciente"\]\}/);
  assert.match(pagina, /<DirectorioLista modoPaciente/);
  assert.match(detalle, /rolesRequeridos=\{\["paciente"\]\}/);
  assert.match(detalle, /baseDirectorio="\/panel\/odontologos"/);
  assert.match(ficha, /href=\{baseDirectorio\}/);
  assert.match(ficha, /AvatarOdontologo/);
});

test("los avatares corresponden solo a los veinte perfiles ficticios registrados", () => {
  const contenido = leer("src/features/directorio/AvatarOdontologo.tsx");
  const catalogo = leer("src/features/directorio/catalogo-demo.ts");
  const archivo = readFileSync("public/directorio/avatares-adultos.avif");
  assert.equal(archivo.subarray(4,12).toString("ascii"),"ftypavif");
  assert.equal(statSync("public/directorio/avatares-adultos.avif").size, 15414);
  assert.match(contenido, /CATALOGO_DEMO\.map/);
  assert.match(contenido, /CATALOGO_DEMO\.map/);
  assert.match(contenido, /indice % 2 === 0/);
  assert.match(contenido, /if \(!rostro\)/);
  assert.match(catalogo, /odontologo-demo-s6-/);
  const css=leer("src/features/directorio/directorio.module.css");
  assert.match(css,/avatares-adultos\.avif/);
  assert.match(css,/background-size:400% 500%/);
});

test("el radar requiere consentimiento y usa puntos reales del directorio", () => {
  const directorio=leer("src/features/directorio/DirectorioLista.tsx");
  const mapa=leer("src/features/directorio/MapaDirectorio.tsx");
  const estilos=leer("src/features/directorio/mapa-directorio.module.css");
  assert.match(directorio,/obtenerUbicacionActual\(navigator\.geolocation\)/);
  assert.match(directorio,/setRadarActivo\(true\)/);
  assert.match(directorio,/ubicacionMasCercana\(d\.ubicaciones, ubicacion\)/);
  assert.match(directorio,/p\.ubicacion\.practice_name/);
  assert.match(directorio,/orden === "cercania"/);
  assert.match(mapa,/dataset\.radar = String\(modoPaciente && radarActivo\)/);
  assert.match(mapa,/setLngLat\(\[ubicacion\.longitude, ubicacion\.latitude\]\)/);
  assert.match(estilos,/prefers-reduced-motion:reduce/);
  assert.match(estilos,/radarExpandir/);
  assert.match(mapa,/basePerfil/);
});
