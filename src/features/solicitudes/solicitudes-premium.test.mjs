import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const leer = ruta => readFileSync(ruta, "utf8");

test("historial premium muestra solo estados reales y no simula confirmaciones clínicas", () => {
  const c = leer("src/features/solicitudes/MisSolicitudes.tsx");
  assert.match(leer("src/features/solicitudes/solicitudes.ts"), /type FiltroEstado = "todas" \| "requested" \| "cancelled"/);
  assert.match(c, /solicitud\.status === "requested"/);
  assert.match(c, /solicitud\.status === "cancelled"/);
  assert.match(c, /Sin cita confirmada/);
  assert.doesNotMatch(c, /"completed"|"in_progress"|"confirmed"/);
  assert.match(c, /aria-pressed=\{filtroEstado === valor\}/);
  assert.match(c, /type="search"/);
  assert.match(c, /resultado\.total/);
  assert.match(c, /puedeCancelarSolicitud\(solicitud\.status\)/);
});

test("se conserva historial compacto del panel y deep link a odontólogo", () => {
  const c = leer("src/features/solicitudes/MisSolicitudes.tsx");
  const page = leer("src/app/(paciente)/solicitudes/page.tsx");
  assert.match(c, /tamano: compacto \? 3 : 12/);
  assert.match(c, /obtenerMisSolicitudesPaginadas\(/);
  assert.match(c, /cancelarSolicitudDemo\(/);
  assert.match(page, /odontologo &&/);
  assert.match(page, /odontologoInicial=\{odontologo\}/);
  assert.match(page, /rolesRequeridos=\{\["paciente"\]\}/);
  assert.match(page, /href="#nueva-solicitud"/);
});

test("diseño premium mantiene responsividad, tema oscuro y enfoque visible", () => {
  const css = leer("src/features/solicitudes/solicitudes.module.css");
  for (const cls of ["resumenSolicitudes", "resumenTarjeta", "herramientasSolicitudes", "pestanasSolicitudes", "pestanaActiva", "buscarSolicitud", "accionesPagina", "enlaceNuevaSolicitud"]) {
    assert.match(css, new RegExp("\\." + cls + "\\{"));
  }
  assert.match(css, /max-width:580px/);
  assert.match(css, /focus-visible/);
  assert.match(css, /data-tema="oscuro"/);
});
