import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const leer = ruta => readFileSync(ruta, "utf8");

test("panel del paciente conserva sesión, datos y funcionalidad real", () => {
  const pagina = leer("src/features/panel/PanelPaciente.tsx");
  assert.match(pagina, /useSesion\(\)/);
  assert.match(pagina, /useNombrePerfil\(usuario\)/);
  assert.match(pagina, /<ResumenPanel \/>/);
  assert.match(pagina, /<MisSolicitudes compacto \/>/);
  assert.match(pagina, /<ClinicaPanel \/>/);
  assert.match(pagina, /href="\/panel\/odontologos"/);
  assert.match(pagina, /href="\/analisis"/);
  assert.match(pagina, /href="\/fotografias"/);
  assert.match(pagina, /href="\/buenas-practicas"/);
  assert.match(pagina, /href="\/cuenta\?perfil=1"/);
  assert.match(pagina, /El análisis con IA aún no está disponible/);
});

test("métricas siguen siendo consultas propias de Supabase, no números simulados", () => {
  const resumen = leer("src/features/panel/ResumenPanel.tsx");
  assert.match(resumen, /obtenerMisSolicitudes\(client, id\)/);
  assert.match(resumen, /\.eq\("user_id", id\)/);
  assert.match(resumen, /contarSolicitudes\(solicitudes\)/);
  assert.match(resumen, /\{fotos\}/);
  assert.match(resumen, /\{solicitudes\}/);
  assert.match(resumen, /\{pendientes\}/);
});

test("solo el portal paciente adopta los grupos de navegación y las dos variantes visuales", () => {
  const nav = leer("src/components/navegacion-portal.ts");
  const shell = leer("src/components/portal-shell.module.css");
  const panel = leer("src/features/panel/panel.module.css");
  const solicitudes = leer("src/features/solicitudes/solicitudes.module.css");
  for (const grupo of ["Principal", "Mi cuidado dental", "Recursos", "Cuenta"]) assert.ok(nav.includes('grupo: "' + grupo + '"'));
  assert.match(shell, /data-area="Paciente"\]\[data-tema="claro"/);
  assert.match(panel, /data-area="Paciente"\]\[data-tema="oscuro"/);
  assert.match(panel, /prefers-reduced-motion/);
  assert.match(solicitudes, /\.tarjeta\.compacto/);
});
