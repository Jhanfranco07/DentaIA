import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const { values } = parseArgs({
  options: {
    base: { type: "string", default: "http://127.0.0.1:3181" },
    output: { type: "string", default: "docs/landing-visual/evidencias/rediseno-editorial/despues" },
  },
});
const base = new URL(values.base).origin;
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "La prueba usa un servidor local.");
const salida = values.output;
const supabase = "https://dentai-qa.invalid";
const perfilDemo = "/directorio/d36a2026-0000-4000-8000-000000000001";
const rutas = ["/", "/directorio", perfilDemo, "/privacidad", "/cuenta", "/premium", "/premium/exito", "/premium/cancelado", "/paciente/buenas-practicas"];
const tesela = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAPElEQVRIie3WuQkAMBADQfdfowpQoCJchcHBwOWCQ8+edE/vEKgXjYsiaFMV0aY1ODGZRRUDXoWO+5quL53hwJcLx7SbAAAAAElFTkSuQmCC", "base64");
const persona = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "qa@example.invalid",
  app_metadata: { dentaia: { version: 1, estado: "activo", roles: ["paciente"] } },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};
const resultados = [];
const errores = new Set();
const layouts = [];

await mkdir(salida, { recursive: true });
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--disable-logging"],
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
});

async function comprobar(nombre, prueba) {
  try {
    await prueba();
    resultados.push({ nombre, aprobada: true });
    console.log("PASS", nombre);
  } catch (error) {
    resultados.push({ nombre, aprobada: false, detalle: error.message });
    console.error("FAIL", nombre, error.message);
  }
}

async function crearPagina(width = 1440, reducedMotion = "reduce", sesion = false) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 420 ? 844 : 900 },
    reducedMotion,
    serviceWorkers: "block",
  });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === base) {
      if (url.pathname === "/api/premium/status" && sesion) return route.fulfill({ json: { plan: "basic", subscription: null } });
      return route.continue();
    }
    if (url.origin === "https://tile.openstreetmap.org") {
      return route.fulfill({ contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: tesela });
    }
    if (url.origin !== supabase) return route.abort();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": route.request().headers()["access-control-request-headers"] ?? "*",
      "access-control-expose-headers": "content-range",
      "content-range": "*/0",
    };
    if (route.request().method() === "OPTIONS" || route.request().method() === "HEAD") {
      return route.fulfill({ status: 204, headers });
    }
    return route.fulfill({ headers, json: url.pathname === "/auth/v1/user" ? persona : [] });
  });
  if (sesion) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = Buffer.from(JSON.stringify({ exp, sub: persona.id })).toString("base64url");
    const sesionDePrueba = {
      access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.fixture`,
      expires_at: exp,
      refresh_token: "fixture",
      token_type: "bearer",
      user: persona,
    };
    await context.addInitScript(session => {
      if (!localStorage.getItem("sb-dentai-qa-auth-token")) {
        localStorage.setItem("sb-dentai-qa-auth-token", JSON.stringify(session));
      }
    }, sesionDePrueba);
  }
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on("pageerror", error => errores.add(`${new URL(page.url()).pathname} · ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") errores.add(`${new URL(page.url()).pathname} · ${message.text()}`);
  });
  page.on("response", response => {
    if (response.status() >= 400) errores.add(`HTTP ${response.status()} · ${new URL(response.url()).pathname}`);
  });
  return page;
}

async function abrir(page, ruta) {
  const response = await page.goto(base + ruta);
  assert.equal(response?.status(), 200, ruta);
  await page.evaluate(() => document.fonts.ready);
}

async function cargarImagenes(page) {
  await page.locator("img").evaluateAll(async imagenes => {
    for (const imagen of imagenes) imagen.loading = "eager";
    await Promise.all(imagenes.map(imagen => imagen.decode()));
  });
}

async function sinDesborde(page) {
  const ancho = await page.evaluate(() => ({ viewport: innerWidth, documento: document.documentElement.scrollWidth }));
  assert(ancho.documento <= ancho.viewport, JSON.stringify(ancho));
}

async function conPagina(width, movimiento, sesion, prueba) {
  const page = await crearPagina(width, movimiento, sesion);
  try { await prueba(page); }
  finally { await page.context().close(); }
}

const header = page => page.locator(".site-header");
const nav = page => header(page).getByRole("navigation", { name: "Navegación principal" });
const menu = page => header(page).locator("button[aria-controls]");

try {
  for (const width of [390, 768, 1024, 1440, 375]) {
    await comprobar(`Composición, imágenes y navegación pública a ${width} px`, () => conPagina(width, "reduce", false, async page => {
      for (const ruta of rutas) {
        await abrir(page, ruta);
        await sinDesborde(page);
        assert.equal(await header(page).count(), 1, ruta);
        assert.equal(await page.locator(".site-footer").count(), 1, ruta);
        assert.equal(await page.locator("main").count(), 1, ruta);
        assert.equal(await page.locator(".tema-selector").count(), 0, ruta);
        await header(page).getByRole("link", { name: "Iniciar sesión" }).waitFor();
        if (width <= 900) {
          await menu(page).click();
          await nav(page).waitFor();
        }
        const activo = { "/": "Inicio", "/directorio": "Odontólogos", [perfilDemo]: "Odontólogos", "/privacidad": "Privacidad" }[ruta];
        if (activo) assert.equal(await nav(page).getByRole("link", { name: activo, exact: true }).getAttribute("aria-current"), "page");
        if (width <= 900) {
          await page.keyboard.press("Escape");
          await nav(page).waitFor({ state: "hidden" });
          assert(await menu(page).evaluate(boton => boton === document.activeElement));
          await menu(page).evaluate(boton => boton.blur());
          await page.mouse.move(0, 0);
        }
        if (ruta === "/") {
          await cargarImagenes(page);
          assert.equal(await page.locator("h1").count(), 1);
          const titulo = await page.locator("h1").boundingBox();
          const foto = await page.locator('[data-active-slide] [data-activo="true"] img').boundingBox();
          const [registro, directorio] = await Promise.all([
            page.getByRole("link", { name: "Crear cuenta gratis", exact: true }).boundingBox(),
            page.getByRole("link", { name: "Explorar odontólogos", exact: true }).boundingBox(),
          ]);
          assert(foto.height >= 200 && registro.height >= 44 && directorio.height >= 44);
          if (width <= 760) assert(foto.y >= Math.max(registro.y + registro.height, directorio.y + directorio.height));
          layouts.push({ width, titulo, foto });
          if (width !== 375) await page.screenshot({ path: join(salida, `landing-${width}.png`), fullPage: true });
          if (width === 390 || width === 1440) await page.screenshot({ path: join(salida, `hero-${width}.png`) });
        }
        if (["/directorio", "/privacidad"].includes(ruta) && [390, 1440].includes(width)) {
          await cargarImagenes(page);
          if (ruta === "/directorio" && width === 1440) {
            await page.getByRole("region", { name: "Mapa de consultorios" }).locator("canvas").waitFor();
            await page.getByText("Cargando mapa…", { exact: true }).waitFor({ state: "hidden" });
          }
          await page.screenshot({ path: join(salida, `${ruta.slice(1)}-${width}.png`) });
        }
      }
    }));
  }

  await comprobar("Menú móvil, enlaces entre rutas, anclas y orden de teclado", () => conPagina(390, "reduce", false, async page => {
    await abrir(page, "/");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("href")), "#contenido");
    assert(await page.locator(".skip-link").evaluate(link => getComputedStyle(link).outlineStyle !== "none"));
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.id), "contenido");
    await menu(page).click();
    await nav(page).getByRole("link", { name: "Privacidad" }).click();
    await page.waitForURL(base + "/privacidad");
    await page.getByRole("navigation", { name: "Contenido de privacidad" }).getByRole("link", { name: "Tus fotografías guardadas" }).click();
    await page.waitForURL(base + "/privacidad#fotografias-guardadas");
    const y = await page.locator("#fotografias-guardadas").boundingBox();
    assert(y.y >= 65 && y.y < 260);
    await menu(page).click();
    await nav(page).getByRole("link", { name: "Cómo funciona" }).click();
    await page.waitForURL(base + "/#como-funciona");
    await nav(page).waitFor({ state: "hidden" });
    assert.equal(await header(page).locator('[href="/#como-funciona"]').getAttribute("aria-current"), "location");
  }));

  await comprobar("Registro, directorio, panel, fotografía, profesional y destino Premium", () => conPagina(1024, "reduce", false, async page => {
    const destinos = [
      ["Crear cuenta gratis", "/cuenta?modo=registro", "Crea tu cuenta"],
      ["Explorar odontólogos", "/directorio", "Encuentra odontólogos"],
      ["Ir a mi panel", "/panel", null],
      ["Conocer la preparación", "/analisis", null],
      ["Acceder como profesional", "/profesional", null],
      ["Conocer la política de privacidad", "/privacidad", "Tú decides qué compartir"],
      ["Elegir Premium", "/cuenta?continuar=%2Fpremium%3Finiciar%3D1", "Tu Premium comienza aquí"],
    ];
    for (const [nombre, destino, titulo] of destinos) {
      await abrir(page, "/");
      await page.getByRole("link", { name: nombre, exact: true }).click();
      await page.waitForURL(base + destino);
      if (titulo) await page.getByRole("heading", { name: titulo, exact: true }).waitFor();
    }
    await abrir(page, "/analisis/demo");
    assert.equal(new URL(page.url()).pathname, "/analisis");
  }));

  await comprobar("Directorio móvil, filtros, mapa y vuelta desde la ficha de demostración", () => conPagina(390, "reduce", false, async page => {
    await abrir(page, "/directorio");
    const campo = page.getByRole("searchbox", { name: "Buscar por nombre o especialidad" });
    await campo.fill("sin coincidencias qa");
    await page.getByText("No hay profesionales que coincidan.").waitFor();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    assert.equal(await campo.inputValue(), "");
    await page.getByRole("tab", { name: "Mapa" }).click();
    assert.equal(await page.getByRole("tab", { name: "Mapa" }).getAttribute("aria-selected"), "true");
    await page.getByRole("region", { name: "Mapa de consultorios" }).locator("canvas").waitFor();
    await page.getByRole("tab", { name: "Lista" }).click();
    await page.locator(`a[href="${perfilDemo}"]`).click();
    await page.waitForURL(base + perfilDemo);
    await page.getByText("Perfil ficticio · Sin atención real").waitFor();
    await page.getByRole("link", { name: /Volver al directorio/ }).click();
    await page.waitForURL(base + "/directorio");
  }));

  await comprobar("Cinco imágenes decodificadas, avance circular y navegación manual con movimiento reducido", () => conPagina(1440, "reduce", false, async page => {
    await page.clock.install();
    await abrir(page, "/");
    await page.locator("[data-active-slide='0'] img").evaluate(img => img.decode());
    await page.clock.fastForward(7200);
    assert.equal(await page.locator("[data-active-slide]").getAttribute("data-active-slide"), "0");
    for (const i of [1, 2, 3, 4, 0]) {
      await page.getByRole("button", { name: "Imagen siguiente" }).click();
      await page.locator(`[data-active-slide="${i}"] img`).evaluate(img => img.decode());
    }
    await page.getByRole("button", { name: "Imagen anterior" }).click();
    await page.locator('[data-active-slide="4"]').waitFor();
  }));

  await comprobar("prefers-reduced-motion desactiva entrada del menú, transiciones y desplazamiento suave", async () => {
    for (const movimiento of ["reduce", "no-preference"]) {
      await conPagina(390, movimiento, false, async page => {
        await abrir(page, "/");
        await menu(page).click();
        const animacion = await nav(page).evaluate(el => getComputedStyle(el).animationName);
        const scroll = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
        assert.equal(animacion === "none", movimiento === "reduce");
        assert.equal(scroll, movimiento === "reduce" ? "auto" : "smooth");
        if (movimiento === "reduce") assert.equal(await page.locator(".site-account").evaluate(el => getComputedStyle(el).transitionDuration), "0s");
      });
    }
  });

  await comprobar("Contraste de navegación, texto y acciones principales", () => conPagina(1440, "reduce", false, async page => {
    await abrir(page, "/");
    const pares = await page.evaluate(() => {
      function luminancia(color) {
        const canales = color.match(/[\d.]+/g).slice(0, 3).map(Number);
        return canales.map(n => n / 255)
          .map(n => n <= .04045 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4))
          .reduce((total, canal, i) => total + canal * [.2126, .7152, .0722][i], 0);
      }
      return [
        ["Navegación", ".site-nav a", ".site-header"],
        ["Titular destacado", "#inicio-titulo span:last-child", "section[aria-labelledby=inicio-titulo]"],
        ["Acción de portada", "section[aria-labelledby=inicio-titulo] .action", "section[aria-labelledby=inicio-titulo] .action"],
        ["Pasos", "#como-funciona li p", "#como-funciona"],
        ["Funciones", "#funcionalidades article p", "#funcionalidades"],
        ["Permisos", "section[aria-labelledby=privacidad-titulo] li p", "section[aria-labelledby=privacidad-titulo]"],
        ["Precio Premium", "#planes article:nth-child(2) small", "#planes article:nth-child(2)"],
        ["Pie de página", ".site-footer nav a", ".site-footer"],
      ].map(([nombre, selector, fondo]) => {
        const texto = luminancia(getComputedStyle(document.querySelector(selector)).color);
        const superficie = luminancia(getComputedStyle(document.querySelector(fondo)).backgroundColor);
        return { nombre, contraste: (Math.max(texto, superficie) + .05) / (Math.min(texto, superficie) + .05) };
      });
    });
    for (const { nombre, contraste } of pares) assert(contraste >= 4.5, `${nombre} · ${contraste.toFixed(2)}:1`);
  }));

  await comprobar("Preferencias de cuenta con sesión simulada, cambio de tema y persistencia tras recargar", () => conPagina(1024, "reduce", true, async page => {
    const validacion = page.waitForResponse(response => response.url() === supabase + "/auth/v1/user");
    await abrir(page, "/cuenta?perfil=1");
    await validacion;
    const boton = page.getByRole("region", { name: "Apariencia" }).getByRole("button", { name: "Modo oscuro" });
    await boton.waitFor();
    assert.equal(await boton.getAttribute("aria-pressed"), "false");
    await boton.click();
    await page.locator('html[data-tema="oscuro"]').waitFor();
    assert.equal(await boton.getAttribute("aria-pressed"), "true");
    assert.equal(await page.evaluate(() => localStorage.getItem("dentaia-tema")), "oscuro");
    await page.reload();
    await boton.waitFor();
    await page.locator('html[data-tema="oscuro"]').waitFor();
    assert.equal(await boton.getAttribute("aria-pressed"), "true");
    await abrir(page, "/directorio");
    await header(page).getByRole("link", { name: "Mi espacio" }).waitFor();
    assert.equal(await page.locator(".tema-selector").count(), 0);
    await abrir(page, "/cuenta?perfil=1");
    await boton.click();
    await page.locator('html[data-tema="claro"]').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("dentaia-tema")), "claro");
  }));
  await comprobar("Consola y respuestas HTTP sin errores", () => assert.deepEqual([...errores], []));
} finally {
  await browser.close();
}

const reporte = { chromium: browser.version(), contexto: "Servidor local; sesión, API y teselas simuladas", resultados, errores: [...errores], layouts };
await writeFile(join(salida, "navegador.json"), JSON.stringify(reporte, null, 2) + "\n");
process.exitCode = resultados.some(prueba => !prueba.aprobada) ? 1 : 0;
