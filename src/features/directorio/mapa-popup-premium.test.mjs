import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = ruta => readFileSync(ruta, "utf8");

test("popups premium muestran datos variables sin ejecutar HTML y respetan perfiles demo", () => {
  const mapa = leer("src/features/directorio/MapaDirectorio.tsx");
  const css = leer("src/features/directorio/mapa-directorio.module.css");
  assert.match(mapa, /function crearPopup\(datos: DatosPopup\)/);
  assert.match(mapa, /nodo\.textContent = texto/);
  assert.doesNotMatch(mapa, /\.innerHTML\s*=|\.setHTML\(/);
  assert.match(mapa, /styles\.popupTarjeta/);
  assert.match(mapa, /styles\.popupEncabezado/);
  assert.match(mapa, /styles\.popupDireccion/);
  assert.match(mapa, /styles\.popupAviso/);
  assert.match(mapa, /styles\.popupAccion/);
  assert.match(mapa, /\$\{basePerfil\}\/\$\{encodeURIComponent\(demo\.dentist_id\)\}/);
  assert.match(mapa, /No hay vinculación acreditada con este centro ni reservas mediante DentaIA/);
  assert.match(mapa, /new Popup\(\{ offset: 28, maxWidth:/);
  assert.match(css, /\.popupDistintivo/);
  assert.match(css, /\.popupTitulo/);
  assert.match(css, /\.popupAccion/);
  assert.match(css, /\.maplibregl-popup-close-button:focus-visible/);
});

test("el pin conserva su posición MapLibre mientras la muela SVG permanece vertical", () => {
  const mapa = leer("src/features/directorio/MapaDirectorio.tsx");
  const css = leer("src/features/directorio/mapa-directorio.module.css");
  assert.match(mapa, /function crearMarcador\(tipo: "demo" \| "consultorio"/);
  assert.match(mapa, /document\.createElementNS\("http:\/\/www\.w3\.org\/2000\/svg", "svg"\)/);
  assert.match(mapa, /elemento\.append\(fondo, icono\)/);
  assert.doesNotMatch(mapa, /icono\.textContent = "🦷"/);
  assert.match(mapa, /new Marker\(\{ element: elemento, anchor: "bottom" \}\)/);
  assert.match(css, /\.contenedorMapa \.marcadorDemo,\.contenedorMapa \.marcadorDentista\{\s*position:absolute/);
  assert.match(css, /\.contenedorMapa \.pinForma\{[\s\S]*?transform:rotate\(-45deg\)/);
  assert.match(css, /\.contenedorMapa \.iconoDiente\{[\s\S]*?transform:none/);
  assert.match(css, /\.marcadorDemo\[data-selected="true"\] \.pinForma/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("el mapa no pierde radar, selección ni limitación de coordenadas", () => {
  const mapa = leer("src/features/directorio/MapaDirectorio.tsx");
  assert.match(mapa, /ubicacionConCoordenadasValidas\(ubicacion\)/);
  assert.match(mapa, /Number\.isFinite\(ubicacion\.latitude\)/);
  assert.match(mapa, /dataset\.radar = String\(modoPaciente && radarActivo\)/);
  assert.match(mapa, /marker\.getElement\(\)\.dataset\.cercano/);
  assert.match(mapa, /marcador\.togglePopup\(\)/);
  assert.match(mapa, /setLngLat\(\[ubicacion\.longitude, ubicacion\.latitude\]\)/);
});
