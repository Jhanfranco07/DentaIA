import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leer = ruta => readFileSync(ruta, "utf8");

test("Mi perfil no presenta acceso público hasta resolver Auth", () => {
  const codigo = leer("src/features/cuenta/Cuenta.tsx");
  const guarda = codigo.indexOf("if (cargando || errorSesion) return <main");
  const pantallaPublica = codigo.lastIndexOf("return <PublicShell>{contenido}</PublicShell>");
  assert.ok(guarda > 0 && pantallaPublica > guarda, "La verificación debe preceder al acceso público");
  assert.match(codigo, /Comprobando tu sesión…/);
  assert.match(codigo, /perfilSolicitado/);
});

test("Mi Premium no presenta navegación pública mientras Auth valida", () => {
  const codigo = leer("src/app/premium/page.tsx");
  const guarda = codigo.indexOf("if (comprobandoSesion || errorSesion) return <main");
  const pantallaPublica = codigo.lastIndexOf("return <PublicShell>{contenido}</PublicShell>");
  assert.ok(guarda > 0 && pantallaPublica > guarda, "La verificación debe preceder a PublicShell");
  assert.match(codigo, /cargando: comprobandoSesion, errorSesion, verificar/);
  assert.match(codigo, /Comprobando tu sesión…/);
});

test("el fondo oscuro de progreso se aplica solo al tema oscuro del paciente", () => {
  const css = leer("src/features/rutinas/rutinas.module.css");
  const selectorOscuro = ':global([data-area="Paciente"][data-tema="oscuro"]) .pagina';
  assert.ok(css.includes(selectorOscuro + ' :is(.progreso){background:#263d49;'));
  assert.ok(css.includes(selectorOscuro + ' :is(.barra){background:#45545d}'));
  assert.ok(css.includes(".progreso{padding:15px 17px;background:linear-gradient(125deg,#edfafa,#e5f5f8)"));
  assert.ok(css.includes(".barra{height:12px;background:#c7e1e4;border:1px solid #b3d5d9}"));
  assert.ok(!css.includes(".pagina :is(.progreso){background:#263d49;") ||
    css.includes(selectorOscuro + ' :is(.progreso){background:#263d49;'));
});
