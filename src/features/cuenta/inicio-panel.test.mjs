import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinoEntradaPaciente } from "./destino-cuenta.ts";
import { retornoSolicitud } from "../../lib/navegacion.ts";

const leer = ruta => readFileSync(ruta, "utf8");
const solicitud = "/solicitudes?odontologo=a1560ae0-2fc1-4fbc-87c6-beee116cf2e5";

test("una sesión paciente que abre acceso público entra al panel, no al perfil", () => {
  assert.equal(destinoEntradaPaciente(["paciente"], false, null), "/panel");
  assert.equal(destinoEntradaPaciente(["paciente"], true, null), null);
});

test("el retorno de solicitud validada tiene prioridad para un paciente", () => {
  assert.equal(destinoEntradaPaciente(["paciente"], false, retornoSolicitud(solicitud)), solicitud);
  assert.equal(retornoSolicitud("https://externo.test/solicitudes?odontologo=a1560ae0-2fc1-4fbc-87c6-beee116cf2e5"), null);
  assert.equal(destinoEntradaPaciente(["paciente"], false, retornoSolicitud("https://externo.test/")), "/panel");
  assert.equal(destinoEntradaPaciente(["paciente"], true, solicitud), null);
});

test("las rutas y permisos de odontólogos, administradores y usuarios sin rol permanecen intactos", () => {
  for (const roles of [[], ["odontologo"], ["superusuario"], ["paciente", "odontologo"], ["paciente", "superusuario"]]) {
    assert.equal(destinoEntradaPaciente(roles, false, null), null);
  }
});

test("Mi perfil conserva un acceso explícito y el redireccionamiento no ocurre mientras Auth carga", () => {
  const cuenta = leer("src/features/cuenta/Cuenta.tsx");
  const pagina = leer("src/app/cuenta/page.tsx");
  const portal = leer("src/components/PortalShell.tsx");
  const panel = leer("src/features/panel/PanelPaciente.tsx");
  assert.match(pagina, /perfilSolicitado=\{perfil === "1"\}/);
  assert.match(cuenta, /continuarListo && !cargando && !errorSesion && usuario/);
  assert.match(cuenta, /destinoEntradaPaciente\(roles, perfilSolicitado, continuar\)/);
  assert.match(cuenta, /if \(destinoEntrada\) router\.replace\(destinoEntrada\)/);
  assert.match(cuenta, /router\.replace\(soloPaciente \? continuar \?\? destino : destino\)/);
  assert.match(portal, /area === "Paciente" && href === "\/cuenta" \? "\/cuenta\?perfil=1"/);
  assert.match(panel, /href="\/cuenta\?perfil=1"/);
});
