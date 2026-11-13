import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const archivo = ruta => readFileSync(ruta, "utf8");

test("el nombre del paciente se consulta desde profiles y nunca controla los permisos", () => {
  const nombre = archivo("src/features/cuenta/useNombrePerfil.ts");
  assert.match(nombre, /leerPerfil\(getSupabaseBrowserClient\(\), id!\)/);
  assert.match(nombre, /const guardado = perfil\?\.trim\(\)/);
  assert.match(nombre, /if \(guardado\) return guardado/);
  assert.match(nombre, /user_metadata\?\.full_name/);
  assert.match(nombre, /usuario\?\.email/);
  assert.doesNotMatch(nombre, /rolesDelUsuario|role_claim|is_admin/);
});

test("cabecera, saludo y cuenta utilizan la misma fuente de nombre", () => {
  for (const ruta of ["src/components/PortalShell.tsx", "src/features/panel/PanelPaciente.tsx", "src/features/cuenta/Cuenta.tsx"]) {
    assert.match(archivo(ruta), /useNombrePerfil\(usuario\)/, ruta);
  }
  const shell = archivo("src/components/PortalShell.tsx");
  assert.match(shell, /area === "Paciente" \? nombreUsuario : area/);
  assert.match(shell, /area === "Paciente" \? "Paciente" : "Espacio de trabajo"/);
  assert.match(shell, /useNombrePerfil\(usuario\)/);
});

test("guardar el perfil actualiza el nombre visible sin refrescar ni modificar Auth", () => {
  const perfil = archivo("src/features/cuenta/PerfilPaciente.tsx");
  const nombre = archivo("src/features/cuenta/useNombrePerfil.ts");
  assert.match(perfil, /await guardarPerfil\(/);
  assert.match(perfil, /dispatchEvent\(new CustomEvent\(EVENTO_NOMBRE_PERFIL/);
  assert.match(nombre, /detalle\?\.usuarioId !== id/);
  assert.match(nombre, /version \+= 1/);
  assert.match(nombre, /version === 0/);
  assert.match(nombre, /removeEventListener\(EVENTO_NOMBRE_PERFIL/);
});
