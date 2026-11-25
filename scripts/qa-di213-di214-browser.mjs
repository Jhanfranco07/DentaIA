import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { expect } from "playwright/test";

// Use only with the disposable integration fixture described in the QA report.
const fixturePath = process.argv[2] ?? "node_modules/.qa-di213-di214/fixture.json";
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const { app, users, password, patientId, membership, encounter, freeId,
  otherMembership, photoEvaluation, manualGrant, objectPath } = fixture;
const local = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(app, "http://localhost:57530");
assert.equal(local, "http://127.0.0.1:57521");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key);
assert.ok(Object.values(users).every(email => email.endsWith("@di214.test")));
const browser = await chromium.launch();
const dentist = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const patient = await browser.newPage({ viewport: { width: 1280, height: 900 } });
dentist.on("dialog", dialog => void dialog.accept());

async function login(page, role) {
  await page.goto(app + "/desarrollo/acceso");
  await page.getByLabel(/correo/i).fill(users[role]);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión de prueba" }).click();
  await expect(page.getByRole("button", { name: /Cerrar sesión/i })).toBeEnabled({ timeout: 30000 });
}

async function session(role) {
  const client = createClient(local, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: users[role], password });
  if (error || !data.session) throw new Error("No se pudo iniciar una sesión sintética");
  return { client, token: data.session.access_token };
}

async function http(path, actor, status, body, id) {
  const response = await fetch(app + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: "Bearer " + actor.token,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(id ? { "Idempotency-Key": id } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.status, status, path.split("?")[0]);
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  return response;
}

try {
  const [owner, professional, free, outside] = await Promise.all(
    ["paciente", "odontologo", "free", "ajeno"].map(session)
  );
  const chart = id => "/api/clinical/patients/" + id + "/odontogram";
  const chartPath = chart(patientId) + "?membershipId=" + membership;
  const historyPath = "/api/professional/premium-history";
  const historyBody = { patientId, membershipId: membership };
  const photoBody = { ...historyBody, photo: photoEvaluation };
  const manage = "/api/patient/premium-history";
  const scope = { evaluationId: photoEvaluation, grantId: manualGrant };
  const share = photo => http(manage, owner, 200, { ...scope, action: "share", accepted: true, photo });
  const unshare = () => http(manage, owner, 200, { ...scope, action: "unshare" });
  const readChart = async () => (await (await http(chartPath, professional, 200)).json()).data;
  const readHistory = async () => (await (await http(historyPath, professional, 200, historyBody)).json()).items;
  const storage = (bucket, path, actor) => fetch(local + "/storage/v1/object/authenticated/" + bucket + "/" + path,
    { headers: { apikey: key, Authorization: "Bearer " + actor.token } });
  const lookup = async (path, schema) => fetch(local + "/rest/v1/" + path,
    { headers: { apikey: key, Authorization: "Bearer " + professional.token, "Accept-Profile": schema } });

  assert.equal((await lookup("odontogram_events", "clinical")).status, 406);
  assert.equal((await lookup("premium_evaluations", "clinical")).status, 406);
  assert.equal((await lookup("rpc/premium_history", "clinical_service")).status, 406);
  await http(chartPath, owner, 403);
  await http(chart(patientId) + "?membershipId=" + otherMembership, outside, 403);
  await http(chart(freeId) + "?membershipId=" + membership, professional, 403);
  await http(historyPath, outside, 403, { ...historyBody, membershipId: otherMembership });
  const freeResult = await (await http("/api/patient/premium-history/read", free, 200, {})).json();
  assert.equal(freeResult.premium, false);
  assert.deepEqual(freeResult.items, []);

  const before = await readChart();
  assert.ok(before.encounters.some(item => item.id === encounter && item.editable));
  const smileId = before.observations.find(item => item.source === "smile-v17")?.analysisId;
  assert.ok(smileId, "Falta la observación sintética de Smile");
  const smilePhoto = chartPath + "&photo=" + smileId;
  const originalSmile = await http(smilePhoto, professional, 200);
  assert.equal(originalSmile.headers.get("content-type"), "image/png");
  await unshare();
  assert.deepEqual(await readHistory(), []);
  assert.equal((await storage("dental-photos", objectPath, professional)).ok, false);
  await share(false);
  assert.equal((await readHistory()).length, 1);
  await http(historyPath, professional, 403, photoBody);
  assert.equal((await storage("dental-photos", objectPath, professional)).ok, false);
  await share(true);
  const originalPremium = await http(historyPath, professional, 200, photoBody);
  const premiumBytes = Buffer.from(await originalPremium.arrayBuffer());
  assert.deepEqual(premiumBytes, Buffer.from(await originalSmile.arrayBuffer()));
  assert.equal((await storage("dental-photos", objectPath, outside)).ok, false);
  assert.equal((await professional.client.storage.from("dental-photos").createSignedUrl(objectPath, 60)).data, null);

  if (process.argv.includes("--after-restart")) {
    assert.ok((await readChart()).records.some(row => row.note === "QA cruzada corregida"));
    assert.equal((await readHistory()).length, 1);
    function setFixtureDigest(digest) {
      assert.match(photoEvaluation, /^[0-9a-f-]{36}$/);
      assert.match(digest, /^[0-9a-f]{64}$/);
      const sql = "UPDATE clinical.premium_evaluations SET photo_digest='" + digest
        + "' WHERE id='" + photoEvaluation + "';";
      const result = spawnSync("docker", ["exec", "-i", "supabase_db_dentaia_di213_di214_qa", "psql",
        "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
      assert.equal(result.status, 0, "No se pudo ajustar el digest de la fixture local");
      assert.match(result.stdout, /UPDATE 1/);
    }
    try {
      setFixtureDigest("0".repeat(64));
      const denied = await http(historyPath, professional, 404, photoBody);
      assert.deepEqual(await denied.json(), { ok: false, code: "NOT_FOUND" });
    } finally {
      setFixtureDigest(createHash("sha256").update(premiumBytes).digest("hex"));
    }
    await http(historyPath, professional, 200, photoBody);
    await Promise.all(Array.from({ length: 4 }, () => share(true)));
    assert.equal((await readHistory()).length, 1);
    console.log("Digest, concesión concurrente y persistencia conjunta comprobados después del reinicio de Next.");
  } else {
    const write = { membershipId: membership, encounterId: encounter, review: null,
      record: { tooth: 16, surface: "oclusal", condition: "caries", phase: "hallazgo",
        note: "Encuentro sintético incorrecto", replacesId: null, correctionReason: null } };
    await http(chart(patientId), professional, 403, { ...write, encounterId: randomUUID() }, randomUUID());
    await login(dentist, "odontologo");
    await dentist.goto(app + "/profesional");
    const chooser = dentist.getByLabel("Paciente autorizado", { exact: true });
    async function openChart() {
      await chooser.selectOption(patientId);
      await dentist.getByRole("button", { name: "Abrir odontograma" }).click();
      await expect(dentist.getByRole("button", { name: /^Pieza \d+:/ })).toHaveCount(32);
    }
    await openChart();
    const tooth = dentist.getByRole("button", { name: /^Pieza 16:/ });
    await tooth.focus();
    await dentist.keyboard.press("Enter");
    await expect(tooth).toHaveAttribute("aria-pressed", "true");
    await dentist.getByLabel("Superficie").selectOption("oclusal");
    const note = dentist.getByRole("textbox", { name: "Nota clínica", exact: true });
    await note.fill("QA cruzada original");
    await dentist.getByRole("button", { name: "Confirmar y guardar" }).click();
    await expect(dentist.getByText("Registro guardado.")).toBeVisible();
    await dentist.reload();
    await openChart();
    await tooth.click();
    await expect(dentist.getByText("QA cruzada original")).toBeVisible();
    await dentist.getByRole("button", { name: "Corregir", exact: true }).click();
    await dentist.getByLabel("Motivo de corrección").fill("Revisión sintética");
    await note.fill("QA cruzada corregida");
    await dentist.getByRole("button", { name: "Confirmar y guardar" }).click();
    await expect(dentist.getByText("Versión histórica")).toBeVisible();
    await dentist.getByRole("button", { name: "Asociar manualmente a pieza 16" }).click();
    await note.fill("QA cruzada revisión Smile");
    await dentist.getByRole("button", { name: "Confirmar vínculo y guardar" }).click();
    await expect(dentist.getByText("Asociada y confirmada")).toBeVisible();
    await dentist.getByRole("button", { name: "Consultar evaluaciones compartidas" }).click();
    const professionalItems = dentist.locator("[class*='evaluations'] > li");
    await expect(professionalItems).toHaveCount(1);
    await professionalItems.first().locator("summary").click();
    const download = dentist.waitForEvent("download");
    await dentist.getByRole("button", { name: "Descargar fotografía privada" }).click();
    assert.equal((await download).suggestedFilename(), "fotografia.png");

    await login(patient, "paciente");
    await patient.goto(app + "/resultados");
    await expect(patient.getByText(/Las nuevas evaluaciones visuales Premium todavía no están disponibles/)).toBeVisible();
    const items = patient.locator("[class*='evaluations'] > li");
    await expect(items).toHaveCount(7);
    const full = items.filter({ has: patient.locator("summary").getByText(/· Evaluación completa$/) }).first();
    const empty = items.filter({ has: patient.locator("summary").getByText(/Evaluación completa sin detecciones/) }).first();
    await full.getByRole("checkbox").check();
    await empty.getByRole("checkbox").check();
    await expect(patient.getByRole("table")).toBeVisible();
    await patient.reload();
    await expect(items).toHaveCount(7);

    const verified = await readChart();
    assert.ok(verified.reviews.some(item => item.analysisId === smileId));
    assert.ok(verified.records.some(item => item.note === "QA cruzada original" && !item.active));
    assert.ok(verified.records.some(item => item.note === "QA cruzada corregida" && item.active));
    await unshare();
    await http(historyPath, professional, 403, photoBody);
    assert.equal((await readChart()).records.length, verified.records.length);
    await http(smilePhoto, professional, 200);
    await share(true);
    const revoked = await owner.client.rpc("revoke_clinical_access", { p_id: manualGrant });
    assert.equal(revoked.data?.ok, true);
    await http(chartPath, professional, 403);
    await http(smilePhoto, professional, 403);
    await http(historyPath, professional, 403, historyBody);
    assert.equal((await storage("dental-photos", objectPath, professional)).ok, false);

    // Restore a fresh grant through the patient's real session for the manual handoff.
    const newGrant = randomUUID();
    const restored = await owner.client.rpc("grant_clinical_access", {
      p_id: newGrant, p_membership_id: membership, p_encounter_ids: [encounter],
      p_expires_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      p_policy_version: "qa-di214.v1", p_accepted: true,
    });
    assert.equal(restored.data?.ok, true);
    await http(manage, owner, 200, { ...scope, grantId: newGrant, action: "share", accepted: true, photo: true });
    assert.equal((await readChart()).records.length, verified.records.length);
    writeFileSync(fixturePath, JSON.stringify({ ...fixture, manualGrant: newGrant }));
    console.log("Chromium, Auth, PostgREST y Storage: coexistencia y revocación cruzada verificadas.");
  }
} finally {
  await browser.close();
}
