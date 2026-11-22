import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const { values } = parseArgs({
  options: {
    base: { type: "string", default: "http://127.0.0.1:3181" },
    output: { type: "string", default: "docs/landing-visual/evidencias/hero-campana" },
  },
});
const diapositivas = [
  ["radiante", "Tu sonrisa, a tu ritmo", "/cuenta?modo=registro", "/directorio"],
  ["surfista", "Sonríe con confianza", "/directorio", "#como-funciona"],
  ["afrobrasilena", "Tu sonrisa habla por ti", "/cuenta?modo=registro", "#funcionalidades"],
  ["caballero", "El estilo nunca deja de sonreír", "#como-funciona", "/directorio"],
  ["urbana", "Sonríe a tu manera", "/cuenta?modo=registro", "#como-funciona"],
];

await mkdir(values.output, { recursive: true });
const browser = await chromium.launch();
const resultados = [];
const errores = new Set();
const intervalos = [];

const foto = (page, indice) => page.locator(`[data-active-slide="${indice}"] [data-activo="true"] img`);
const marco = page => page.locator("[data-active-slide]");
const indiceActual = async page => Number(await marco(page).getAttribute("data-active-slide"));
const indicadores = page => page.getByRole("group", { name: "Elegir fotografía" }).getByRole("button");
const control = (page, name) => page.getByRole("button", { name, exact: true });
const hero = page => page.locator('[aria-roledescription="carrusel"]');
const copy = page => hero(page).locator('[data-copy-slide][data-activo="true"]');

async function probar(nombre, prueba) {
  try {
    await prueba();
    resultados.push({ nombre, aprobada: true });
    console.log("PASS", nombre);
  } catch (error) {
    resultados.push({ nombre, aprobada: false, detalle: error.message });
    console.error("FAIL", nombre, error.message);
  }
}

async function nuevaPagina(width = 1440, reducedMotion = "no-preference", deviceScaleFactor = 1) {
  const page = await browser.newPage({
    viewport: { width, height: width <= 390 ? 844 : width === 1920 ? 1080 : 900 },
    reducedMotion,
    deviceScaleFactor,
  });
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errores.add(error.message));
  page.on("console", message => { if (message.type() === "error") errores.add(message.text()); });
  page.on("response", response => {
    if (response.status() >= 400) errores.add(`HTTP ${response.status()} · ${new URL(response.url()).pathname}`);
  });
  return page;
}

async function abrir(page) {
  assert.equal((await page.goto(values.base)).status(), 200);
  await page.evaluate(() => document.fonts.ready);
  if (await page.locator("nextjs-portal").count()) {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  }
}

async function comprobarSlide(page, indice) {
  const [id, titulo, principal, secundario] = diapositivas[indice];
  const imagen = foto(page, indice);
  await imagen.waitFor();
  const src = await imagen.evaluate(async img => {
    await img.decode();
    if (!img.naturalWidth) throw new Error("Imagen sin dimensiones");
    return img.currentSrc;
  });
  assert.match(decodeURIComponent(src), new RegExp(`/campana/${id}\\.webp`));
  assert((await imagen.getAttribute("alt")).length > 0);
  const tituloActual = page.getByRole("heading", { level: 1, name: titulo, exact: true });
  assert.equal(await tituloActual.count(), 1);
  assert.equal(await indicadores(page).nth(indice).getAttribute("aria-current"), "true");
  assert.equal(await copy(page).getByRole("link").nth(0).getAttribute("href"), principal);
  assert.equal(await copy(page).getByRole("link").nth(1).getAttribute("href"), secundario);
  assert.equal(await hero(page).getByText(/^Imagen \d+ de \d+$/).count(), 0);
}

async function postura(page) {
  return page.evaluate(() => {
    const bloque = document.querySelector('[aria-roledescription="carrusel"]');
    const texto = bloque.querySelector('[data-copy-slide][data-activo="true"]');
    const caja = el => el.getBoundingClientRect();
    const documento = document.documentElement.scrollWidth;
    const titulo = caja(texto.querySelector("h1"));
    const subtitulo = caja(texto.querySelector("p"));
    const acciones = Array.from(texto.querySelectorAll("a"), caja);
    const elementoFoto = caja(bloque.querySelector('[data-active-slide] [data-activo="true"]'));
    return {
      ancho: innerWidth,
      documento,
      hero: caja(bloque).height,
      lineasTitular: [...texto.querySelectorAll("h1 span")].map(el => Math.round(caja(el).height / parseFloat(getComputedStyle(el).lineHeight))),
      tituloAbajo: titulo.bottom,
      subtituloArriba: subtitulo.top,
      accionesArriba: acciones[0].top,
      accionesAbajo: Math.max(...acciones.map(b => b.bottom)),
      alturaAcciones: Math.min(...acciones.map(b => b.height)),
      fotoArriba: elementoFoto.top,
    };
  });
}

try {
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await probar(`Cinco retratos y mensajes en ${width} px`, async () => {
      const page = await nuevaPagina(width);
      try {
        await abrir(page);
        await page.mouse.move(24, 100);
        assert.equal(await indicadores(page).count(), 5);
        const alturas = [];
        for (let indice = 0; indice < diapositivas.length; indice++) {
          if (indice > 0) await indicadores(page).nth(indice).click();
          await comprobarSlide(page, indice);
          await page.locator('[data-copy-slide][data-activo="true"]').evaluate(async elemento => {
            await Promise.all(elemento.getAnimations().map(animacion => animacion.finished.catch(() => {})));
          });
          const datos = await postura(page);
          assert.equal(datos.ancho, datos.documento);
          assert.deepEqual(datos.lineasTitular, [1, 1]);
          assert(datos.tituloAbajo <= datos.subtituloArriba);
          assert(datos.subtituloArriba <= datos.accionesArriba && datos.alturaAcciones >= 44);
          if (width <= 760) assert(datos.accionesAbajo <= datos.fotoArriba);
          alturas.push([datos.hero, datos.accionesArriba, datos.fotoArriba]);
          if (width === 1440 || width === 390 || (indice === 0 && width !== 390) || (width === 1920 && indice === 3)) {
            await page.mouse.move(1, 1);
            await page.locator(":focus").evaluateAll(elementos => elementos.forEach(elemento => elemento.blur()));
            await page.screenshot({ path: join(values.output, `hero-${width}-${indice + 1}.png`), animations: "disabled" });
          }
        }
        assert(alturas.every(altura => altura.every((valor, index) => Math.abs(valor - alturas[0][index]) < 1)), "El hero o los CTA se movieron.");
      } finally {
        await page.close();
      }
    });
  }

  await probar("Inicio prioritario, avance de seis segundos, fundido y vuelta al primero", async () => {
    const page = await nuevaPagina();
    try {
      const solicitudes = new Map();
      page.on("request", request => {
        const pathname = decodeURIComponent(request.url());
        const id = diapositivas.find(([clave]) => pathname.includes(`/campana/${clave}.webp`))?.[0];
        if (id && !solicitudes.has(id)) solicitudes.set(id, performance.now());
      });
      await abrir(page);
      await comprobarSlide(page, 0);
      assert.equal(await foto(page, 0).getAttribute("fetchpriority"), "high");
      assert.deepEqual([...solicitudes.keys()], ["radiante"]);
      await comprobarSlide(page, 1);
      const primerCambio = performance.now();
      assert(solicitudes.get("surfista") - solicitudes.get("radiante") >= 800, "La segunda foto compitió con la primera.");
      await page.waitForFunction(() => {
        const imagen = document.querySelector('[data-active-slide="1"] [data-activo="true"]');
        const saliente = document.querySelector('[data-active-slide="1"] [data-anterior="true"]');
        return saliente && Number(getComputedStyle(imagen).opacity) > 0 && Number(getComputedStyle(imagen).opacity) < 1 && getComputedStyle(saliente).opacity === "1";
      });
      await comprobarSlide(page, 2);
      const diferencia = Math.round(performance.now() - primerCambio);
      intervalos.push(diferencia);
      assert(diferencia >= 5700 && diferencia <= 6350, `${diferencia} ms`);
      await comprobarSlide(page, 3);
      await comprobarSlide(page, 4);
      await comprobarSlide(page, 0);
    } finally {
      await page.close();
    }
  });

  await probar("Pausa por cursor y teclado, controles manuales y pausa explícita", async () => {
    const page = await nuevaPagina();
    try {
      await page.clock.install();
      await abrir(page);
      await comprobarSlide(page, 0);
      await page.mouse.move(50, 150);
      await page.clock.fastForward(6500);
      assert.equal(await indiceActual(page), 0);
      await control(page, "Imagen siguiente").click();
      await comprobarSlide(page, 1);
      await control(page, "Imagen anterior").click();
      await comprobarSlide(page, 0);

      await page.mouse.move(0, 0);
      await page.keyboard.press("Tab");
      await indicadores(page).nth(1).focus();
      await page.clock.fastForward(6500);
      assert.equal(await indiceActual(page), 0);
      await page.keyboard.press("Enter");
      await comprobarSlide(page, 1);
      await page.keyboard.press("ArrowLeft");
      await comprobarSlide(page, 0);
      assert(await indicadores(page).nth(1).evaluate(elemento => elemento === document.activeElement));

      await control(page, "Pausar carrusel").click();
      await page.mouse.move(0, 0);
      await page.locator(":focus").evaluateAll(elementos => elementos.forEach(elemento => elemento.blur()));
      await page.clock.fastForward(6500);
      assert.equal(await indiceActual(page), 0);
      await control(page, "Reproducir carrusel").click();
      await page.mouse.move(0, 0);
      await page.clock.runFor(6200);
      await comprobarSlide(page, 1);
    } finally {
      await page.close();
    }
  });

  await probar("Movimiento reducido, selección manual y enlaces de sección", async () => {
    const page = await nuevaPagina(390, "reduce", 2);
    try {
      await page.clock.install();
      await abrir(page);
      await comprobarSlide(page, 0);
      await page.clock.fastForward(14000);
      assert.equal(await indiceActual(page), 0);
      assert.equal(await control(page, "Pausar carrusel").count(), 0);
      await indicadores(page).nth(2).click();
      await comprobarSlide(page, 2);
      assert.equal(await foto(page, 2).evaluate(img => getComputedStyle(img.parentElement).transitionDuration), "0s");
      assert.equal(await copy(page).evaluate(nodo => getComputedStyle(nodo).transitionDuration), "0s");
      await copy(page).getByRole("link", { name: "Conocer funcionalidades" }).click();
      await page.waitForURL(url => url.hash === "#funcionalidades");
      assert.equal(new URL(page.url()).hash, "#funcionalidades");
    } finally {
      await page.close();
    }
  });

  await probar("La fotografía y el mensaje permanecen visibles mientras carga el siguiente", async () => {
    const page = await nuevaPagina(1024, "reduce");
    try {
      let liberar;
      const bloqueada = new Promise(resolve => { liberar = resolve; });
      await page.route(url => decodeURIComponent(url.href).includes("/campana/caballero.webp"), async route => {
        await bloqueada;
        await route.continue();
      });
      await abrir(page);
      await comprobarSlide(page, 0);
      const llegada = page.waitForRequest(request => decodeURIComponent(request.url()).includes("/campana/caballero.webp"));
      await indicadores(page).nth(3).click();
      await llegada;
      await comprobarSlide(page, 0);
      liberar();
      await comprobarSlide(page, 3);
    } finally {
      await page.close();
    }
  });
  await probar("Sin errores de consola, hidratación ni recursos HTTP", () => assert.deepEqual([...errores], []));
} finally {
  await browser.close();
}

const reporte = { chromium: browser.version(), resultados, intervalosObservadosMs: intervalos, errores: [...errores] };
await writeFile(join(values.output, "navegador.json"), JSON.stringify(reporte, null, 2) + "\n");
process.exitCode = resultados.some(resultado => !resultado.aprobada) ? 1 : 0;
