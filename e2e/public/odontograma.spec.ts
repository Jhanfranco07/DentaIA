import { expect, test } from "playwright/test";
import type { ExpedienteOdontograma, GuardarOdontograma, Registro } from "../../src/features/odontograma/modelo";

const id = (n: number) => `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const date = "2026-11-25T10:00:00Z";

test("odontólogo usa el odontograma desde su portal con un BFF sintético", async ({ page, context, baseURL }) => {
  const user = { id: id(3), aud: "authenticated", role: "authenticated", app_metadata: { dentaia: { version: 1, estado: "activo", roles: ["odontologo"] } }, user_metadata: {} };
  await page.addInitScript(({ user }) => {
    const expires_at = Math.floor(Date.now() / 1000) + 3600;
    const token = [btoa('{"alg":"HS256","typ":"JWT"}'), btoa(JSON.stringify({ sub: user.id, exp: expires_at })), "test"].join(".");
    localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: token, refresh_token: "synthetic", expires_at, token_type: "bearer", user }));
  }, { user });
  const observation = { analysisId: id(7), key: "region:2", source: "smile-v17" as const, label: "Amarillo visible · región 2", date, model: "Smile V17 QA", limitations: [] };
  let consultasDirectorio = 0;
  let pausaLecturas: Promise<void> | undefined;
  let estadoOdontograma = 200;
  let estadoHistorial = 200;
  const records: Registro[] = [];
  const reviews: ExpedienteOdontograma["reviews"] = [];
  const workspace = (kind: string, data: object) => ({ ok: true, apiVersion: "clinical.workspace.v1", kind, nextAfterId: null, requestId: id(20), environment: "qa_local", data });
  await context.route("**/*", async route => {
    const request = route.request();
    const { origin, pathname } = new URL(request.url());
    const json = (data: object) => route.fulfill({ json: data });
    if (pathname === "/auth/v1/user" && origin === "http://127.0.0.1:1") return json(user);
    if (origin !== baseURL) return route.abort();
    if (pathname === "/api/professional/me") return json(workspace("professional", {
      professionalId: id(3), dentistId: null, contexts: [{ membershipId: id(4), clinicId: id(5), clinicName: "Clínica sintética", validFrom: date, validUntil: null }],
    }));
    if (pathname === "/api/professional/requests") {
      consultasDirectorio++;
      return route.fulfill({ status: 403, json: { ok: false, code: "ACCESS_DENIED", requestId: id(20) } });
    }
    if (pathname === "/api/professional/patients") return json(workspace("patients", { membershipId: id(4), items: [{ patientId: id(1) }, { patientId: id(2) }] }));
    if (pathname.endsWith("/history")) {
      await pausaLecturas;
      if (estadoHistorial !== 200) return route.fulfill({ status: estadoHistorial, json: { ok: false, code: "ACCESS_DENIED", requestId: id(20) } });
      return json({
        ok: true, apiVersion: "clinical.v1", origen: "supabase", environment: "qa_local", estado: "listo",
        caso: { patientId: pathname.split("/")[4], professionalContext: id(3), clinicContext: id(5) },
        entries: [{
          encounterId: id(6), attendedAt: date, recordedAt: date, status: "recorded",
          replacesId: null, correctionReason: null,
          origin: { clinicId: id(5), clinicName: "Clínica sintética", professionalId: id(3), professionalName: null },
          background: { state: "not_recorded", value: null },
          clinicalEntries: [], diagnoses: [], treatments: [], exams: [],
        }], nextCursor: null, requestId: id(20),
      });
    }
    if (pathname.endsWith("/odontogram")) {
      const patientId = pathname.split("/")[4];
      if (request.method() === "POST") {
        const input = request.postDataJSON() as GuardarOdontograma;
        const entryId = (await request.headerValue("idempotency-key"))!;
        if (input.record) {
          const previous = records.find(item => item.id === input.record?.replacesId);
          if (previous) previous.active = false;
          records.unshift({ ...input.record, encounterId: input.encounterId, id: entryId, recordedAt: date, author: "Odontólogo QA", active: true });
        }
        if (input.review) reviews.push({ ...input.review, entryId: input.record ? entryId : null, recordedAt: date });
        return json({ ok: true, id: entryId });
      }
      await pausaLecturas;
      if (estadoOdontograma !== 200) {
        return route.fulfill({ status: estadoOdontograma, json: { ok: false } });
      }
      const first = patientId === id(1);
      const data: ExpedienteOdontograma = { patientId, patientName: first ? "Paciente sintético uno" : "Paciente sintético dos",
        encounters: first ? [{ id: id(6), date, editable: true }] : [], records: first ? records : [], observations: first ? [observation] : [],
        reviews: first ? reviews : [], availablePhotos: [] };
      return json({ ok: true, data });
    }
    return route.continue();
  });
  page.on("dialog", dialog => void dialog.accept());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto("/profesional");
  const select = page.getByLabel("Paciente autorizado", { exact: true });
  const abrir = async () => {
    await select.selectOption(id(1));
    await page.getByRole("button", { name: "Abrir odontograma" }).click();
    await expect(page.getByText("Paciente sintético uno")).toBeVisible();
  };
  await abrir();
  const tooth = page.getByRole("button", { name: /^Pieza 16:/ });
  await tooth.focus();
  await page.keyboard.press("Enter");
  await expect(tooth).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Superficie").selectOption("oclusal");
  const nota = page.getByRole("textbox", { name: "Nota clínica", exact: true });
  const guardar = page.getByRole("button", { name: "Confirmar y guardar" });
  await nota.fill("Nota sintética");
  await expect(page.getByRole("heading", { name: "Atención clínica autorizada" })).toBeVisible();
  await nota.scrollIntoViewIfNeeded();
  await expect(nota).toBeInViewport();

  const posicion = () => nota.evaluate(element => ({
    scroll: window.scrollY, top: element.getBoundingClientRect().top,
  }));
  for (const origen of ["foco", "intervalo"]) {
    await test.step(`Conserva el editor durante la revalidación por ${origen}`, async () => {
      const antes = await posicion();
      let liberar!: () => void;
      pausaLecturas = new Promise<void>(resolve => { liberar = resolve; });
      const lecturas = Promise.all(["/history", "/odontogram"].map(ruta =>
        page.waitForRequest(request => new URL(request.url()).pathname.endsWith(ruta)),
      ));
      try {
        if (origen === "foco") await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        else await page.clock.fastForward(60_000);
        await lecturas;
        await expect(nota).toBeFocused({ timeout: 1000 });
        await expect(guardar).toBeDisabled();
        await expect.poll(posicion).toEqual(antes);
        await page.keyboard.type(origen === "foco" ? " original" : " verificada");
      } finally {
        pausaLecturas = undefined;
        liberar();
      }
      await expect(guardar).toBeEnabled();
      await expect(page.getByRole("heading", { name: "Atención clínica autorizada" })).toBeVisible();
      await expect(nota).toBeFocused();
      await expect.poll(posicion).toEqual(antes);
    });
  }
  await expect(nota).toHaveValue("Nota sintética original verificada");
  await page.getByRole("button", { name: "Confirmar y guardar" }).click();
  await expect(page.getByText("Registro guardado.")).toBeVisible();
  await page.reload();
  await abrir();
  await tooth.click();
  await expect(page.getByText("Nota sintética original verificada")).toBeVisible();
  await page.getByRole("button", { name: "Corregir", exact: true }).click();
  await page.getByLabel("Motivo de corrección").fill("Actualización de la evaluación");
  await page.getByRole("textbox", { name: "Nota clínica", exact: true }).fill("Nota sintética corregida");
  await page.getByRole("button", { name: "Confirmar y guardar" }).click();
  await expect(page.getByText("Versión histórica")).toBeVisible();
  await page.getByRole("button", { name: "Asociar manualmente a pieza 16" }).click();
  await page.getByRole("textbox", { name: "Nota clínica", exact: true }).fill("Observación revisada en la consulta");
  await page.getByRole("button", { name: "Confirmar vínculo y guardar" }).click();
  await expect(page.getByText("Asociada y confirmada")).toBeVisible();
  await select.selectOption(id(2));
  await page.getByRole("button", { name: "Abrir odontograma" }).click();
  await expect(page.getByText("Paciente sintético dos")).toBeVisible();
  await expect(page.getByText("Nota sintética corregida")).toHaveCount(0);
  await test.step("Retira datos ante errores y descarta el borrador al perder autorización", async () => {
    await abrir();
    await nota.fill("Borrador clínico por revocar");
    const actualizar = page.getByRole("button", { name: "Actualizar expediente" });
    estadoOdontograma = 503;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(actualizar).toBeVisible();
    await expect(nota).toHaveCount(0);
    await expect(page.getByText("Paciente sintético uno")).toHaveCount(0);
    estadoOdontograma = 200;
    await actualizar.click();
    await expect(nota).toHaveValue("Borrador clínico por revocar");

    estadoOdontograma = 403;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByText("El acceso clínico ya no está autorizado.")).toBeVisible();
    await expect(nota).toHaveCount(0);
    await expect(page.getByText("Paciente sintético uno")).toHaveCount(0);
    estadoOdontograma = 200;
    await actualizar.click();
    await expect(nota).toHaveValue("");

    await expect(page.getByRole("heading", { name: "Atención clínica autorizada" })).toBeVisible();
    await nota.fill("Borrador con autorización del historial");
    estadoHistorial = 403;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(select).toHaveValue("");
    await expect(nota).toHaveCount(0);
    await expect(page.getByText("Paciente sintético uno")).toHaveCount(0);
  });
  expect(consultasDirectorio).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
