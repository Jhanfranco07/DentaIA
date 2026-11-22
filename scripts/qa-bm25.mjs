import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { abrirBaseBm25, administracion, directorio, historial, usuarios } from "../supabase/tests/bm25-environment.mjs";

const base = process.env.DENTAIA_BM25_BASE_URL || "http://127.0.0.1:3045";
const fixtureHost = "bm25-fixtures.supabase.co";
const db = await abrirBaseBm25();
await db.exec(`
  insert into public.dentists (id, slug, name, specialty, district, description)
  select ('ba000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'ficha-' || n,
    'Profesional fixture ' || lpad(n::text, 2, '0'), 'Odontología general', 'Cusco', 'Cuadrante catálogo'
  from generate_series(1, 26) n;
  insert into public.appointment_requests (id, user_id, dentist_id, contact_name, preferred_date, message, status, created_at)
  select ('ca000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, '${usuarios[0]}',
    'bb000000-0000-4000-8000-000000000002', 'Lucía Cárdenas', '2030-04-10', 'Recordatorio general', 'requested', '2025-12-20'
  from generate_series(1, 13) n;
`);

const logChromium = join(tmpdir(), "dentaia-bm25-chromium.log");
const browser = await chromium.launch({ headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", `--log-file=${logChromium}`],
  env: { ...process.env, CHROME_LOG_FILE: logChromium } });
const resultados = [];
const errores = [];
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAnsAAAAASUVORK5CYII=", "base64");

function credenciales(tipo) {
  if (!tipo) return null;
  const id = tipo === "paciente" ? usuarios[0] : usuarios[2];
  const user = { id, email: "fixture@example.test", aud: "authenticated", is_anonymous: false,
    app_metadata: { dentaia: { version: 1, roles: [tipo], estado: "activo" } }, user_metadata: {},
    confirmed_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z" };
  const expires_at = Math.floor(Date.now() / 1000) + 3600;
  const codificar = v => Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = [codificar({ alg: "HS256", typ: "JWT" }),
    codificar({ sub: id, role: "authenticated", aal: tipo === "superusuario" ? "aal2" : "aal1", exp: expires_at }), "fixture"].join(".");
  return { user, access_token: token, refresh_token: "fixture-no-secreto", token_type: "bearer", expires_at, expires_in: 3600 };
}

async function contexto(viewport, tipo) {
  const context = await browser.newContext({ viewport, geolocation: { latitude: -12.05, longitude: -77.04, accuracy: 30 },
    permissions: ["geolocation"], serviceWorkers: "block" });
  const sesion = credenciales(tipo);
  if (sesion) await context.addInitScript((s) => localStorage.setItem("sb-bm25-fixtures-auth-token", JSON.stringify(s)), sesion);
  const consultas = [];
  let falloTemporal = false;
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (value, status = 200) => route.fulfill({ status, json: value });
    try {
      if (url.hostname === fixtureHost) {
        if (url.pathname === "/auth/v1/user") return sesion ? json(sesion.user) : json({ message: "Sesión requerida" }, 401);
        if (url.pathname === "/rest/v1/rpc/dentaia_buscar_directorio") {
          const p = request.postDataJSON();
          consultas.push({ tipo: "directorio", q: p.p_query, pagina: p.p_page });
          if (p.p_query === "fallotemporalfixture" && !falloTemporal) {
            falloTemporal = true;
            return json({ message: "Fallo temporal de prueba" }, 503);
          }
          return json(await directorio(db, { q: p.p_query, distrito: p.p_district, especialidad: p.p_specialty,
            orden: p.p_order, pagina: p.p_page, tamano: p.p_size, lat: p.p_lat, lon: p.p_lon, radio: p.p_radius }));
        }
        if (url.pathname === "/rest/v1/rpc/dentaia_buscar_solicitudes") {
          if (!sesion || request.headers().authorization !== "Bearer " + sesion.access_token) return json({ message: "Sesión requerida" }, 401);
          const p = request.postDataJSON();
          consultas.push({ tipo: "solicitudes", q: p.p_query, pagina: p.p_page });
          return json(await historial(db, sesion.user.id, { q: p.p_query, estado: p.p_status, pagina: p.p_page, tamano: p.p_size }));
        }
        return json([]);
      }
      if (url.origin === base && tipo === "superusuario" && url.pathname.startsWith("/api/administracion/")) {
        if (request.headers().authorization !== "Bearer " + sesion.access_token) return json({ error: "Sesión requerida" }, 401);
        if (url.pathname.endsWith("/acceso")) return json({ autorizado: true });
        if (url.pathname.endsWith("/usuarios/reales")) {
          const q = url.searchParams.get("q");
          const rol = url.searchParams.get("rol");
          const estado = url.searchParams.get("estado");
          const pagina = Number(url.searchParams.get("pagina"));
          const tamano = Number(url.searchParams.get("tamano"));
          consultas.push({ tipo: "admin", q, pagina });
          if (q) return json(await administracion(db, { q, rol, estado, pagina, tamano }));
          const filas = (await Promise.all(usuarios.map(id => administracion(db, { q: id })))).flatMap(v => v.usuarios);
          return json({ origen: "supabase", consistencia: "lectura_no_transaccional", usuarios: filas,
            total: filas.length, pagina: 1, paginas: 1, tamano });
        }
        return json({});
      }
      if (url.origin === base) return route.continue();
      if (url.hostname === "tile.openstreetmap.org") return route.fulfill({ contentType: "image/png", body: png });
      return route.fulfill({ status: 200, body: "" });
    } catch (e) {
      errores.push(e.message);
      return json({ message: "Error de fixture" }, 500);
    }
  });
  const page = await context.newPage();
  page.on("pageerror", e => errores.push(e.message));
  page.on("console", m => {
    if (m.type() === "error" && !(falloTemporal && m.text().includes("status of 503")
      && m.location().url.endsWith("/dentaia_buscar_directorio"))) errores.push(m.text());
  });
  return { context, page, consultas };
}

async function sinDesborde(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
}

try {
  for (const width of [1280, 390]) {
    const { context, page, consultas } = await contexto({ width, height: 900 });
    await page.goto(base + "/directorio");
    const input = page.getByRole("searchbox");
    const resultadosDir = page.getByRole("region", { name: "Resultados del directorio" });
    await input.waitFor();
    const inicial = consultas.length;
    await input.fill("c");
    await input.fill("Cua");
    await input.fill("Cuadrante");
    await resultadosDir.getByRole("heading").first().and(page.getByRole("heading", { name: "Luz Cuadrante" })).waitFor();
    assert.equal(await resultadosDir.getByRole("heading").first().textContent(), "Luz Cuadrante");
    assert.deepEqual(consultas.slice(inicial).map(c => c.q), ["Cuadrante"]);
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByText("Página 2 de 2").waitFor();
    await resultadosDir.getByRole("heading", { name: "Profesional fixture 26" }).waitFor();
    assert.equal(await resultadosDir.getByRole("heading", { name: "Luz Cuadrante" }).count(), 0);
    await page.getByLabel("Distrito", { exact: true }).selectOption("Lima");
    await page.getByText("Mostrando 1 de 1 profesionales").waitFor();
    assert.equal(await input.inputValue(), "Cuadrante");
    assert.equal(await resultadosDir.getByRole("heading").count(), 1);
    await page.getByRole("button", { name: "Usar mi ubicación" }).click();
    await page.getByLabel("Distancia aproximada").selectOption("5");
    await resultadosDir.getByRole("heading", { name: "Luz Cuadrante" }).waitFor();
    await input.fill("secretoautorizado");
    await page.getByText("No hay profesionales que coincidan.").waitFor();
    if (width === 1280) {
      await input.fill("fallotemporalfixture");
      const aviso = page.getByRole("alert").filter({ hasText: "Mostramos el catálogo de demostración" });
      await aviso.waitFor();
      await aviso.getByRole("button", { name: "Reintentar" }).click();
      await aviso.waitFor({ state: "hidden" });
      await page.getByText("No hay profesionales que coincidan.").waitFor();
    }
    await sinDesborde(page);
    resultados.push("Directorio público " + width + " px");
    await context.close();
  }

  const { context: cp, page: paciente } = await contexto({ width: 390, height: 844 }, "paciente");
  await paciente.goto(base + "/panel/odontologos");
  await paciente.getByRole("searchbox").fill("blanqueamiento dental");
  await paciente.getByRole("heading", { name: "Luz Cuadrante" }).first().waitFor();
  await paciente.goto(base + "/solicitudes");
  const buscar = paciente.getByRole("searchbox");
  await paciente.getByText("Página 1 de 2").waitFor();
  await paciente.getByRole("button", { name: "Siguiente" }).click();
  await paciente.getByText("Página 2 de 2").waitFor();
  await buscar.fill("Luz matutino");
  await paciente.getByRole("heading", { name: "Luz Cuadrante" }).waitFor();
  await paciente.getByRole("button", { name: /Canceladas/ }).click();
  await paciente.getByText(/No encontramos solicitudes con estos filtros/).waitFor();
  await paciente.getByRole("button", { name: /Todas/ }).click();
  await buscar.fill("privadomensaje");
  await paciente.getByText(/No encontramos solicitudes con estos filtros/).waitFor();
  assert.equal(await paciente.getByText("Privadocontacto").count(), 0);
  await sinDesborde(paciente);
  resultados.push("Directorio del paciente y Mis solicitudes");
  await paciente.goto(base + "/buenas-practicas");
  const busquedaGuia = paciente.getByRole("searchbox");
  await busquedaGuia.fill("hilo dental");
  const carrusel = paciente.getByLabel("Carrusel de guías educativas");
  await carrusel.getByRole("button", { name: /limpieza interdental/i }).first().waitFor();
  assert.match(await carrusel.getByRole("button").first().getAttribute("aria-label"), /limpieza interdental/i);
  await paciente.getByRole("button", { name: /Alimentación/ }).click();
  assert.equal(await carrusel.getByRole("button", { name: /limpieza interdental/i }).count(), 0);
  await busquedaGuia.fill("sinresultadosxx");
  await paciente.getByText("No encontramos ese tema").waitFor();
  await sinDesborde(paciente);
  resultados.push("Guías educativas");
  await cp.close();

  const { context: ca, page: admin } = await contexto({ width: 960, height: 900 }, "superusuario");
  await admin.goto(base + "/administracion");
  await admin.getByRole("button", { name: "Consultar usuarios" }).click();
  const buscarUsuario = admin.getByRole("searchbox");
  await buscarUsuario.fill("Lucia");
  const tabla = admin.getByRole("table");
  await admin.getByText(/2 cuentas · Origen Supabase/).waitFor();
  assert.match(await tabla.locator("tbody tr").first().textContent(), /Lucía Cárdenas/);
  await admin.getByLabel("Filtrar por rol").selectOption("odontologo");
  await tabla.getByText("Lucía Márquez del Castillo", { exact: true }).waitFor();
  assert.equal(await tabla.getByText("Lucía Cárdenas", { exact: true }).count(), 0);
  await ca.close();
  resultados.push("Tabla administrativa con autorización de fixture y ranking SQL");

  const directa = await fetch(base + "/api/administracion/usuarios/reales?q=Lucia");
  assert.equal(directa.status, 401);
  const { context: cv, page: visitante } = await contexto({ width: 390, height: 844 });
  await visitante.goto(base + "/solicitudes");
  await visitante.getByRole("heading", { name: "Inicia sesión para continuar" }).waitFor();
  assert.equal(await visitante.getByRole("searchbox").count(), 0);
  await cv.close();
  resultados.push("Denegación real del endpoint administrativo y vista del visitante");
  assert.deepEqual(errores, []);
  console.log(JSON.stringify({ resultados, erroresConsola: errores.length }, null, 2));
} finally {
  await browser.close();
  await db.close();
}
