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
      return route.fulfill({ status: 403, json: { ok: false, code: "ACCESS_DENIED" } });
    }
    if (pathname === "/api/professional/patients") return json(workspace("patients", { membershipId: id(4), items: [{ patientId: id(1) }, { patientId: id(2) }] }));
    if (pathname.endsWith("/history")) return json({
      ok: true, apiVersion: "clinical.v1", origen: "supabase", environment: "qa_local", estado: "sin_datos",
      caso: { patientId: pathname.split("/")[4], professionalContext: id(3), clinicContext: id(5) },
      entries: [], nextCursor: null, requestId: id(20),
    });
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
  await page.getByRole("textbox", { name: "Nota clínica", exact: true }).fill("Nota sintética original");
  await page.getByRole("button", { name: "Confirmar y guardar" }).click();
  await expect(page.getByText("Registro guardado.")).toBeVisible();
  await page.reload();
  await abrir();
  await tooth.click();
  await expect(page.getByText("Nota sintética original")).toBeVisible();
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
  expect(consultasDirectorio).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
