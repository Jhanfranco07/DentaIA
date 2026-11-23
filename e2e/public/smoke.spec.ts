import { expect, test, type Page } from "playwright/test";

const fakeSupabase = "http://127.0.0.1:1";
let browserErrors: string[];
let blockedWrites: string[];

test.beforeEach(async ({ page, baseURL }) => {
  browserErrors = [];
  blockedWrites = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  const appOrigin = new URL(baseURL!).origin;
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    // PostgREST usa POST para esta función de consulta; la respuesta se simula localmente.
    const readOnlyDirectoryRpc = url.origin === fakeSupabase
      && request.method() === "POST"
      && url.pathname === "/rest/v1/rpc/dentaia_buscar_directorio";
    if (!["GET", "HEAD"].includes(request.method()) && !readOnlyDirectoryRpc) {
      blockedWrites.push(`${request.method()} ${url.pathname}`);
      await route.abort();
      return;
    }
    if (url.origin === appOrigin) return route.continue();
    if (url.origin === fakeSupabase) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Servicio no disponible en E2E público" }) });
      return;
    }
    await route.abort();
  });
});

test.afterEach(async ({ page }) => {
  expect(blockedWrites, "La visita pública intentó escribir datos").toEqual([]);
  expect(browserErrors, "Errores JavaScript de la página").toEqual([]);
  await expect(page.getByText(/Application error|Internal Server Error/i)).toHaveCount(0);
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
  await expect(page.locator(":focus-visible")).toHaveCount(1);
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
