import { expect, test, type Page, type Response } from "playwright/test";

const recursos = "/mediapipe/1.2.3/";

async function abrirCarga(page: Page) {
  await page.goto("/analisis");
  await page.getByRole("button", { name: "Comenzar análisis" }).click();
}

async function simularCamara(page: Page, modo: "dual" | "unica" | "sin-alternativa" | "permiso-revocado" | "sin-metadatos" = "dual") {
  await page.addInitScript(modo => {
    const retrato = new Image();
    retrato.src = "data:image/svg+xml," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
        <defs><radialGradient id="piel" cx=".45" cy=".45" r=".7"><stop stop-color="#ffd5b3"/><stop offset="1" stop-color="#af725b"/></radialGradient></defs>
        <path fill="#756e91" d="M45 320 Q50 270 127 265H193Q270 270 275 320Z"/>
        <path fill="#be8c73" d="M130 230H190V276Q160 294 130 276Z"/>
        <ellipse cx="90" cy="157" rx="14" ry="22" fill="#c78e75"/>
        <ellipse cx="230" cy="157" rx="14" ry="22" fill="#c78e75"/>
        <path fill="url(#piel)" d="M88 127Q82 42 161 40Q241 42 232 127L226 185Q221 235 162 257Q105 245 94 192Z"/>
        <path fill="#302422" d="M90 141Q74 121 82 78Q93 24 159 28Q249 27 236 136L225 103Q214 82 198 74Q148 110 100 97Z"/>
        <path d="M105 131 Q119 120 139 128 M181 128 Q201 120 215 132" fill="none" stroke="#58352e" stroke-width="5"/>
        <path d="M106 145 Q123 132 140 145Q125 155 106 145 M180 145 Q197 132 214 145Q198 155 180 145" fill="#fff3e9" stroke="#895a50" stroke-width="2"/>
        <circle cx="123" cy="145" r="6" fill="#302720"/><circle cx="196" cy="145" r="6" fill="#302720"/>
        <path d="M157 150Q159 171 149 176Q154 187 171 179" fill="none" stroke="#bc826b" stroke-width="3"/>
        <path d="M127 200Q145 196 160 199Q174 197 193 200Q177 229 160 228Q142 228 127 200Z" fill="#853f48"/>
        <path d="M133 201Q160 207 187 201L180 208Q161 217 140 209Z" fill="#fff5eb"/>
      </svg>`);
    const prueba = {
      permisos: 0, rostro: false, pista: null as MediaStreamTrack | null, lienzo: null as HTMLCanvasElement | null,
      solicitudes: [] as { modo: string | undefined; anterior: string | undefined }[],
      espera: null as Promise<void> | null,
      reanudar: null as (() => void) | null,
    };
    Object.assign(window, { camaraSintetica: prueba });
    navigator.mediaDevices.enumerateDevices = async () =>
      Array.from({ length: modo === "unica" ? 1 : 2 }, () => ({ kind: "videoinput" } as MediaDeviceInfo));
    navigator.mediaDevices.getUserMedia = async restricciones => {
      prueba.permisos++;
      const preferencia = (restricciones?.video as MediaTrackConstraints)?.facingMode as { exact?: string; ideal?: string };
      prueba.solicitudes.push({ modo: preferencia.exact ?? preferencia.ideal, anterior: prueba.pista?.readyState });
      if (modo === "sin-alternativa" && preferencia.exact) {
        throw new DOMException("Orientación no disponible", "OverconstrainedError");
      }
      if (modo === "permiso-revocado" && preferencia.exact) {
        throw new DOMException("Permiso revocado durante la prueba", "NotAllowedError");
      }
      if (preferencia.exact && prueba.espera) await prueba.espera;
      const frente = modo === "unica" ? "user" : preferencia.exact ?? preferencia.ideal;
      const lienzo = document.createElement("canvas");
      lienzo.width = 640;
      lienzo.height = 480;
      prueba.lienzo = lienzo;
      const contexto = lienzo.getContext("2d")!;
      let indice = 0;
      const dibujar = () => {
        contexto.fillStyle = ++indice % 2 ? "#9aabcd" : "#99abcd";
        contexto.fillRect(0, 0, lienzo.width, lienzo.height);
        if (prueba.rostro && retrato.complete) {
          const lado = Math.min(lienzo.width, lienzo.height);
          contexto.drawImage(retrato, (lienzo.width - lado) / 2, (lienzo.height - lado) / 2, lado, lado);
        }
      };
      dibujar();
      const flujo = lienzo.captureStream(15);
      const pista = flujo.getVideoTracks()[0];
      prueba.pista = pista;
      pista.getSettings = () => modo === "sin-metadatos" && preferencia.exact
        ? {}
        : { facingMode: frente, deviceId: frente };
      const temporizador = setInterval(dibujar, 65);
      const detener = pista.stop.bind(pista);
      pista.stop = () => { clearInterval(temporizador); detener(); };
      return flujo;
    };
  }, modo);
}

test("activa el SDK con sesión de Preview, procesa localmente y permite capturar sin rostro", async ({ page, context, baseURL }) => {
  test.setTimeout(50_000);
  const cookiePreview = { name: "dentaia_preview_prueba", value: "autorizado" };
  await context.addCookies([{ ...cookiePreview, url: baseURL!, httpOnly: true }]);
  const wasm = recursos + "runtime/vision_wasm_module_internal.wasm";
  const cargas: string[] = [];
  const escrituras: string[] = [];
  const externos: string[] = [];
  const fallbacks: string[] = [];
  const respuestasWasm: Response[] = [];
  context.on("response", respuesta => {
    if (respuesta.url() === baseURL + wasm && respuesta.request().resourceType() === "fetch") respuestasWasm.push(respuesta);
  });
  page.on("console", mensaje => {
    if (/wasm streaming compile failed|falling back to ArrayBuffer/i.test(mensaje.text())) fallbacks.push(mensaje.text());
  });
  context.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith(recursos)) cargas.push(url.pathname);
    if (request.method() !== "GET" && request.method() !== "HEAD") escrituras.push(url.pathname);
    if (url.origin !== baseURL) externos.push(url.origin);
  });
  await context.route("**/*", async route => {
    const solicitud = route.request();
    const { origin, pathname } = new URL(solicitud.url());
    if (origin !== baseURL || !["GET", "HEAD"].includes(solicitud.method())) return route.abort();
    if (pathname.startsWith(recursos)) {
      const cookies = (await solicitud.headerValue("cookie"))?.split("; ") ?? [];
      if (!cookies.includes(`${cookiePreview.name}=${cookiePreview.value}`)) {
        return route.fulfill({ status: 302, headers: { location: "/autenticacion-preview-sintetica" } });
      }
    }
    return route.continue();
  });
  await simularCamara(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await abrirCarga(page);
  expect(await page.evaluate(() => Reflect.get(window, "camaraSintetica").permisos)).toBe(0);
  await page.getByRole("button", { name: "Tomar fotografía con tu cámara" }).click();
  const video = page.getByLabel("Vista previa de la cámara");
  await expect(video).toHaveAttribute("data-espejo", "false");
  await expect(page.getByRole("button", { name: "Capturar fotografía" })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(cargas).toEqual([]);

  const guia = page.getByRole("checkbox", { name: "Usar guía de encuadre" });
  const nuevoWorker = page.waitForEvent("worker", worker => worker.url().startsWith(baseURL + recursos));
  const cabecera = page.waitForResponse(response => response.url().endsWith("/runtime/guia.worker.js"));
  await guia.check();
  const worker = await nuevoWorker;
  expect((await cabecera).headers()["content-security-policy"])
    .toBe("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'");
  await expect(page.getByText(/Buscando tu rostro/)).toBeVisible({ timeout: 30_000 });
  expect(respuestasWasm).toHaveLength(1);
  const [binario] = respuestasWasm;
  expect(binario.status()).toBe(200);
  expect(binario.headers()["content-type"]).toBe("application/wasm");
  expect(await binario.request().headerValue("referer")).toBeNull();
  expect(cargas.filter(ruta => ruta === wasm)).toEqual([wasm]);
  expect(cargas).toEqual(expect.arrayContaining([
    recursos + "runtime/vision_bundle.mjs",
    recursos + "runtime/vision_wasm_module_internal.js",
    wasm,
    recursos + "face_landmarker.task",
  ]));

  const autorizados = [
    recursos + "runtime/vision_wasm_module_internal.js",
    wasm,
    recursos + "face_landmarker.task",
  ];
  const lecturas = await worker.evaluate(async rutas => Promise.all(rutas.map(async ruta => {
    const respuesta = await fetch(new URL(ruta, self.location.origin));
    const bytes = (await respuesta.arrayBuffer()).byteLength;
    return { estado: respuesta.status, bytes };
  })), autorizados);
  expect(lecturas).toEqual([
    { estado: 200, bytes: 336662 },
    { estado: 200, bytes: 14665738 },
    { estado: 200, bytes: 3758596 },
  ]);

  const noAutorizadas = [
    { ruta: autorizados[0], metodo: "HEAD" },
    { ruta: autorizados[1], metodo: "POST" },
    { ruta: autorizados[2], metodo: "PUT" },
    { ruta: autorizados[0] + "?variante=1", metodo: "GET" },
    { ruta: recursos + "runtime/vision_bundle.mjs", metodo: "GET" },
    { ruta: "/api/desarrollo/dentaia-smile", metodo: "POST" },
    { ruta: "/analisis", metodo: "GET" },
    { ruta: "https://example.invalid" + autorizados[0], metodo: "GET" },
    { ruta: "https://example.invalid/metricas", metodo: "POST" },
  ];
  const bloqueos = await worker.evaluate(async solicitudes => Promise.all(solicitudes.map(async ({ ruta, metodo }) => {
    try {
      await fetch(new URL(ruta, self.location.origin), { method: metodo });
      return false;
    } catch (error) {
      return error instanceof TypeError && error.message === "Solicitud no permitida en la guía local";
    }
  })), noAutorizadas);
  expect(bloqueos).toEqual(noAutorizadas.map(() => true));

  await page.evaluate(() => { Reflect.get(window, "camaraSintetica").rostro = true; });
  const contorno = page.locator("[data-alineada]");
  await expect(contorno).toBeVisible();
  await page.evaluate(() => { Reflect.get(window, "camaraSintetica").rostro = false; });
  await expect(contorno).toHaveCount(0);
  await expect(page.getByText(/Buscando tu rostro/)).toBeVisible();

  await page.evaluate(() => {
    const lienzo: HTMLCanvasElement = Reflect.get(window, "camaraSintetica").lienzo;
    lienzo.width = 480;
    lienzo.height = 640;
  });
  await expect.poll(() => video.evaluate(element => [
    (element as HTMLVideoElement).videoWidth, (element as HTMLVideoElement).videoHeight,
  ])).toEqual([480, 640]);
  await expect.poll(() => video.evaluate(element => element.clientWidth / element.clientHeight)).toBeCloseTo(.75, 1);
  await expect(page.getByText(/Buscando tu rostro/)).toBeVisible();
  const workerCerradoEnCambio = worker.waitForEvent("close");
  const workerFrontal = page.waitForEvent("worker", actual => actual.url() === worker.url());
  await page.getByRole("button", { name: "Cambiar a cámara frontal" }).click();
  await workerCerradoEnCambio;
  const frontal = await workerFrontal;
  await expect(video).toHaveAttribute("data-espejo", "true");
  await expect(guia).toBeChecked();
  await expect(page.getByText(/Buscando tu rostro/)).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => { Reflect.get(window, "camaraSintetica").rostro = true; });
  await expect(contorno).toBeVisible();

  const frontalCerrado = frontal.waitForEvent("close");
  const workerPosterior = page.waitForEvent("worker", actual => actual.url() === worker.url());
  await page.getByRole("button", { name: "Cambiar a cámara posterior" }).click();
  await frontalCerrado;
  const posterior = await workerPosterior;
  await expect(video).toHaveAttribute("data-espejo", "false");
  expect(await page.evaluate(() => Reflect.get(window, "camaraSintetica").solicitudes)).toEqual([
    { modo: "environment", anterior: undefined },
    { modo: "user", anterior: "ended" },
    { modo: "environment", anterior: "ended" },
  ]);

  await page.evaluate(() => { Reflect.get(window, "camaraSintetica").rostro = false; });
  const workerCerrado = posterior.waitForEvent("close");
  await guia.uncheck();
  await workerCerrado;
  expect(await page.evaluate(() => Reflect.get(window, "camaraSintetica").pista.readyState)).toBe("live");

  await guia.check();
  await expect(page.getByText(/Buscando tu rostro/)).toBeVisible({ timeout: 30_000 });
  const workerActivo = page.workers().find(actual => actual.url() === worker.url())!;
  const finCaptura = workerActivo.waitForEvent("close");
  await page.getByRole("button", { name: "Capturar fotografía" }).click();
  await finCaptura;
  await expect(page.getByAltText("Vista previa local de la sonrisa")).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "camaraSintetica").pista.readyState)).toBe("ended");
  await expect(page.getByRole("checkbox", { name: /Consentimiento de procesamiento/ })).not.toBeChecked();
  await expect(page.getByRole("button", { name: /Analizar fotografía/ })).toBeDisabled();
  await page.getByRole("button", { name: "Tomar otra fotografía" }).click();
  await expect(guia).not.toBeChecked();
  await page.getByRole("button", { name: "Volver" }).click();
  expect(await page.evaluate(() => Reflect.get(window, "camaraSintetica").pista.readyState)).toBe("ended");
  expect(escrituras).toEqual([]);
  expect(externos).toEqual([]);
  expect(fallbacks).toEqual([]);
});

test("permite capturar con una sola cámara aunque la orientación inicial sea distinta", async ({ page }) => {
  await simularCamara(page, "unica");
  await abrirCarga(page);
  await page.getByRole("button", { name: "Tomar fotografía con tu cámara" }).click();
  await expect(page.getByLabel("Vista previa de la cámara")).toHaveAttribute("data-espejo", "true");
  await expect(page.getByRole("button", { name: /Cambiar a cámara/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Capturar fotografía" }).click();
  await expect(page.getByAltText("Vista previa local de la sonrisa")).toBeVisible();
});

test("recupera la cámara disponible si el navegador rechaza la otra orientación", async ({ page }) => {
  await simularCamara(page, "sin-alternativa");
  await abrirCarga(page);
  await page.getByRole("button", { name: "Tomar fotografía con tu cámara" }).click();
  await page.getByRole("button", { name: "Cambiar a cámara frontal" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No se pudo cambiar de cámara" })).toBeVisible();
  await expect(page.getByLabel("Vista previa de la cámara")).toHaveAttribute("data-espejo", "false");
  await page.getByRole("button", { name: "Capturar fotografía" }).click();
  await expect(page.getByAltText("Vista previa local de la sonrisa")).toBeVisible();
});

test("recupera la captura si la pista candidata no permite confirmar el cambio", async ({ page }) => {
  await simularCamara(page, "sin-metadatos");
  await abrirCarga(page);
  await page.getByRole("button", { name: "Tomar fotografía con tu cámara" }).click();
  await page.getByRole("button", { name: "Cambiar a cámara frontal" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No se pudo cambiar de cámara" })).toBeVisible();
  await expect(page.getByLabel("Vista previa de la cámara")).toHaveAttribute("data-espejo", "false");
  expect(await page.evaluate(() => Reflect.get(window, "camaraSintetica").solicitudes.slice(1))).toEqual([
    { modo: "user", anterior: "ended" },
    { modo: "environment", anterior: "ended" },
  ]);
  await expect(page.getByRole("button", { name: "Capturar fotografía" })).toBeEnabled();
});

test("ignora pulsaciones consecutivas y libera la pista si se cancela un cambio pendiente", async ({ page }) => {
  await simularCamara(page);
  await abrirCarga(page);
  await page.getByRole("button", { name: "Tomar fotografía con tu cámara" }).click();
  await page.getByRole("button", { name: "Cambiar a cámara frontal" }).evaluate(boton => {
    const prueba = Reflect.get(window, "camaraSintetica");
    prueba.espera = new Promise<void>(resolve => { prueba.reanudar = resolve; });
    prueba.pistaInicial = prueba.pista;
    (boton as HTMLButtonElement).click();
    (boton as HTMLButtonElement).click();
  });
  await expect(page.getByRole("button", { name: "Abriendo cámara…" })).toBeDisabled();
  expect(await page.evaluate(() => Reflect.get(window, "camaraSintetica").permisos)).toBe(2);
  await page.getByRole("button", { name: "Volver" }).click();
  await page.evaluate(() => Reflect.get(window, "camaraSintetica").reanudar());
  await expect.poll(() => page.evaluate(() => {
    const prueba = Reflect.get(window, "camaraSintetica");
    return prueba.pista !== prueba.pistaInicial && prueba.pista.readyState === "ended";
  })).toBe(true);
  await expect(page.getByLabel("Vista previa de la cámara")).toHaveCount(0);
});

test("bloquea el cambio desde que comienza la captura manual", async ({ page }) => {
  await simularCamara(page);
  await abrirCarga(page);
  await page.getByRole("button", { name: "Tomar fotografía con tu cámara" }).click();
  const capturar = page.getByRole("button", { name: "Capturar fotografía" });
  const cambiar = page.getByRole("button", { name: "Cambiar a cámara frontal" });
  await expect(capturar).toBeEnabled();
  await cambiar.evaluate(boton => {
    const prueba = Reflect.get(window, "camaraSintetica");
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      prueba.reanudar = () => toBlob.apply(this, args);
    };
    const captura = [...document.querySelectorAll("button")].find(actual => actual.textContent === "Capturar fotografía")!;
    captura.click();
    (boton as HTMLButtonElement).click();
  });
  await expect(cambiar).toBeDisabled();
  expect(await page.evaluate(() => Reflect.get(window, "camaraSintetica").permisos)).toBe(1);
  await page.evaluate(() => Reflect.get(window, "camaraSintetica").reanudar());
  await expect(page.getByAltText("Vista previa local de la sonrisa")).toBeVisible();
});

test("informa si se revoca el permiso al cambiar de cámara", async ({ page }) => {
  await simularCamara(page, "permiso-revocado");
  await abrirCarga(page);
  const abrir = page.getByRole("button", { name: "Tomar fotografía con tu cámara" });
  await abrir.click();
  await page.getByRole("button", { name: "Cambiar a cámara frontal" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No se concedió permiso" })).toBeVisible();
  await expect(abrir).toBeEnabled();
  await expect(page.getByRole("button", { name: "Seleccionar archivo" })).toBeEnabled();
  expect(await page.evaluate(() => {
    const prueba = Reflect.get(window, "camaraSintetica");
    return [prueba.permisos, prueba.pista.readyState];
  })).toEqual([2, "ended"]);
});

for (const fallo of ["face_landmarker.task", "runtime/guia.worker.js"]) {
  test(`recupera la guía cuando falla ${fallo} y conserva la captura manual`, async ({ page, context }) => {
    await simularCamara(page);
    const interrumpir = `**${recursos}${fallo}`;
    await context.route(interrumpir, route => route.abort());
    await abrirCarga(page);
    await page.getByRole("button", { name: "Tomar fotografía con tu cámara" }).click();
    await page.getByRole("checkbox", { name: "Usar guía de encuadre" }).check();
    await expect(page.getByText(/La guía no está disponible/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Capturar fotografía" })).toBeEnabled();
    await context.unroute(interrumpir);
    await page.getByRole("button", { name: "Reintentar guía" }).click();
    await expect(page.getByText(/Buscando tu rostro/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Capturar fotografía" }).click();
    await expect(page.getByAltText("Vista previa local de la sonrisa")).toBeVisible();
  });
}

test("mantiene la carga de archivo si se deniega el permiso de cámara", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Permiso denegado en la prueba", "NotAllowedError");
    };
  });
  await abrirCarga(page);
  await page.getByRole("button", { name: "Tomar fotografía con tu cámara" }).click();
  const error = page.getByRole("alert").filter({ hasText: "No se concedió permiso" });
  await expect(error).toBeVisible();
  const png = await page.evaluate(() => document.createElement("canvas").toDataURL("image/png").split(",")[1]);
  const selector = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Seleccionar archivo" }).click();
  await (await selector).setFiles({ name: "prueba-sintetica.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await expect(page.getByAltText("Vista previa local de la sonrisa")).toBeVisible();
  await expect(error).toHaveCount(0);
});

test("libera la guía y permite reabrir la cámara si el dispositivo interrumpe la pista", async ({ page, baseURL }) => {
  await simularCamara(page);
  await abrirCarga(page);
  const abrir = page.getByRole("button", { name: "Tomar fotografía con tu cámara" });
  await abrir.click();
  const nuevoWorker = page.waitForEvent("worker", worker => worker.url().startsWith(baseURL + recursos));
  await page.getByRole("checkbox", { name: "Usar guía de encuadre" }).check();
  const worker = await nuevoWorker;
  await expect(page.getByText(/Buscando tu rostro/)).toBeVisible({ timeout: 20_000 });
  const finalizado = worker.waitForEvent("close");
  await page.evaluate(() => {
    const pista: MediaStreamTrack = Reflect.get(window, "camaraSintetica").pista;
    pista.stop();
    pista.dispatchEvent(new Event("ended"));
  });
  await finalizado;
  await expect(page.getByText(/La cámara dejó de mostrar imagen/)).toBeVisible();
  await abrir.click();
  await expect(page.getByRole("button", { name: "Capturar fotografía" })).toBeEnabled();
});
