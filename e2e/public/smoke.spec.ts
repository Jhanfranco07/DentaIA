import { expect, test as base, type Page } from "playwright/test";
import fixtures from "../isolation/fixtures.json";

const fakeSupabase = fixtures.supabaseUrl;
const tileOrigin = "https://tile.openstreetmap.org";
const transparentPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");

const test = base.extend<{ isolatedNetwork: void }>({
  isolatedNetwork: [async ({ context, page, baseURL }, use) => {
  if (!baseURL) throw new Error("E2E requires an explicit Playwright baseURL");
  const appURL = new URL(baseURL);
  if (appURL.protocol !== "http:" || appURL.hostname !== "127.0.0.1" || !appURL.port || appURL.username || appURL.password) {
    throw new Error(`E2E baseURL must be local HTTP on 127.0.0.1: ${baseURL}`);
  }
  const browserErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const unexpectedResponses: string[] = [];
  const blockedRequests: string[] = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    const location = message.location().url;
    if (location.startsWith(`${fakeSupabase}/`) && /^Failed to load resource: the server responded with a status of 503/.test(message.text())) return;
    consoleErrors.push(`${location}: ${message.text()}`);
  });
  context.on("requestfailed", request => {
    failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "unknown"}`);
  });
  context.on("response", response => {
    const url = new URL(response.url());
    if (url.origin === fakeSupabase && response.status() === 503) return;
    if (response.status() >= 400) unexpectedResponses.push(`${response.status()} ${response.url()}`);
  });
  const appOrigin = appURL.origin;
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const readOnlyDirectoryRpc = url.origin === fakeSupabase
      && request.method() === "POST"
      && url.pathname === "/rest/v1/rpc/dentaia_buscar_directorio";
    if (url.origin === fakeSupabase && (["GET", "HEAD"].includes(request.method()) || readOnlyDirectoryRpc)) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Servicio no disponible en E2E público" }) });
      return;
    }
    if (url.origin === tileOrigin && request.method() === "GET" && /^\/\d+\/\d+\/\d+\.png$/.test(url.pathname)) {
      await route.fulfill({ status: 200, contentType: "image/png", body: transparentPng });
      return;
    }
    if (url.origin === appOrigin && ["GET", "HEAD"].includes(request.method())) return route.continue();
    blockedRequests.push(`${request.method()} ${request.url()}`);
    await route.abort();
  });
  await context.routeWebSocket("**/*", socket => {
    const url = new URL(socket.url());
    if (url.protocol === "ws:" && url.hostname === "127.0.0.1" && url.port === appURL.port
        && url.pathname === "/_next/webpack-hmr" && !url.username && !url.password && !url.search && !url.hash) {
      // A local no-op HMR socket is sufficient for a fixed test run.
    } else {
      blockedRequests.push(`WebSocket ${socket.url()}`);
      socket.close();
    }
  });
  await use();
  expect(blockedRequests, "Intentos de red o escrituras no autorizadas").toEqual([]);
  expect(browserErrors, "Errores JavaScript de la página").toEqual([]);
  expect(consoleErrors, "Errores de consola").toEqual([]);
  expect(failedRequests, "Solicitudes fallidas no simuladas").toEqual([]);
  expect(unexpectedResponses, "Respuestas HTTP inesperadas").toEqual([]);
  await expect(page.getByText(/Application error|Internal Server Error/i)).toHaveCount(0);
  }, { auto: true }],
});

async function visit(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} debe responder HTTP 200`).toBe(200);
  await expect(page.locator("body")).toBeVisible();
}

test("portada: contenido y navegación de teclado", async ({ page }) => {
  await visit(page, "/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /Explorar el directorio/i })).toBeVisible();
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Ir al contenido" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenido$/);
});

test("cuenta: formulario visible sin enviar datos", async ({ page }) => {
  await visit(page, "/cuenta");
  await expect(page.getByRole("heading", { name: "Accede a DentaIA" })).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
  await page.getByLabel("Correo electrónico").focus();
  await expect(page.getByLabel("Correo electrónico")).toBeFocused();
});

test("privacidad: política y navegación interna", async ({ page }) => {
  await visit(page, "/privacidad");
  await expect(page.getByRole("heading", { level: 1, name: "Tú decides qué compartir" })).toBeVisible();
  await page.getByRole("link", { name: /Preparar una fotografía para análisis/i }).click();
  await expect(page).toHaveURL(/#preparar-fotografia$/);
});

test("directorio: catálogo demo de respaldo y búsqueda", async ({ page }) => {
  await visit(page, "/directorio");
  await expect(page.getByRole("heading", { level: 1, name: "Encuentra odontólogos" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Mostramos el catálogo de demostración" })).toBeVisible();
  await expect(page.getByLabel("Buscar por nombre o especialidad")).toBeVisible();
  await expect(page.getByText(/Perfil de demostración · No ofrece atención real/).first()).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar por nombre o especialidad" }).fill("Alma Valcárcel");
  await expect(page.getByRole("region", { name: "Resultados del directorio" }).getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Alma Valcárcel" })).toBeVisible();
});

test("detalle público: identificador demo válido", async ({ page }) => {
  await visit(page, "/directorio/d36a2026-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Perfil ficticio · Sin atención real/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Volver al directorio/ })).toBeVisible();
});

test("detalle público: error de consulta sin exponer datos", async ({ page }) => {
  await visit(page, "/directorio/00000000-0000-4000-8000-000000000099");
  await expect(page.getByRole("alert").filter({ hasText: "No pudimos cargar este perfil." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Volver al directorio/ })).toBeVisible();
});

test("buenas prácticas: guía pública sin sesión", async ({ page }) => {
  await visit(page, "/paciente/buenas-practicas");
  await expect(page.getByRole("heading", { level: 1, name: "Pequeños hábitos para cuidar tu sonrisa." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Recomendaciones para el cuidado bucal" }).getByRole("article")).toHaveCount(4);
});

test("premium: información visible sin iniciar checkout", async ({ page }) => {
  await visit(page, "/premium");
  await expect(page.getByRole("heading", { level: 1, name: "Más posibilidades para tu sonrisa." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "¿Qué incluye?" })).toBeVisible();
});

test("análisis: guía pública sin iniciar procesamiento", async ({ page }) => {
  await visit(page, "/analisis");
  await expect(page.getByRole("heading", { level: 1, name: "Tu mejor sonrisa comienza con una buena fotografía." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Comenzar análisis" })).toBeVisible();
  await expect(page.getByText(/Solo se enviará tu fotografía al servicio de análisis después/)).toBeVisible();
});

for (const path of ["/panel", "/resultados"] as const) {
  test(`${path}: solicita sesión sin mostrar datos privados`, async ({ page }) => {
    await visit(page, path);
    await expect(page.getByRole("heading", { level: 1, name: "Inicia sesión para continuar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir a Mi cuenta" })).toBeVisible();
  });
}

test("navegación móvil: menú público accesible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await visit(page, "/");
  const menu = page.getByRole("button", { name: "Abrir menú" });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Privacidad" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeFocused();
});
