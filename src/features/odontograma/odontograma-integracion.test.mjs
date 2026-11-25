import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { ARCADA_INFERIOR, ARCADA_SUPERIOR, esFdi, faseValida, superficiesDe, ubicacionValida } from "./modelo.ts";
import { observacionesSmile } from "./observaciones.ts";

registerHooks({
  resolve(spec, context, next) {
    if (spec.startsWith(".") && context.parentURL?.includes("/clinica-http/") && !/\.[a-z]+$/i.test(spec)) {
      return next(new URL(spec + ".ts", context.parentURL).href, context);
    }
    return next(spec, context);
  },
});
const { crearApiClinica } = await import("../clinica-http/http.ts");
const id = n => `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const date = "2026-11-25T10:00:00Z";

test("las 32 piezas FDI tienen superficies según arcada y tipo", () => {
  const teeth = [...ARCADA_SUPERIOR, ...ARCADA_INFERIOR];
  assert.equal(new Set(teeth).size, 32);
  assert.ok(teeth.every(esFdi));
  assert.deepEqual(superficiesDe(11), ["mesial", "distal", "vestibular", "palatina", "incisal"]);
  assert.deepEqual(superficiesDe(46), ["mesial", "distal", "vestibular", "lingual", "oclusal"]);
  assert.equal(ubicacionValida(46, "oclusal", "ausencia"), false);
  assert.equal(faseValida("endodoncia", "planificado"), true);
});

const region = {
  region_id: 2, label: "tooth", evaluable: true, reason: null, valid_pixels: 200, valid_fraction: 1, b_median: 1,
  level: "Leve", delta_l_halves: null, delta_b_halves: null, illumination_warning: false, partial: false,
  zone_fraction: 0, zone_level: null,
};
const result = {
  status: "evaluable", model: "teeth-4coz7/1", image_width: 400, image_height: 300, inference_ms: 10, analysis_ms: 12,
  thresholds: {}, detected_regions: 1, evaluable_regions: 1, lighting_quality: "adequate",
  regions: [region], warnings: [], limitations: ["Observación educativa"],
};

test("Smile conserva región y procedencia sin inventar FDI, superficie ni confianza", () => {
  const [observation] = observacionesSmile({ id: id(7), date, version: "qa", result: { result } });
  assert.equal(observation.key, "region:2");
  assert.equal(observation.date, date);
  assert.deepEqual(observation.limitations, ["Observación educativa"]);
  assert.equal("tooth" in observation, false);
  assert.equal("surface" in observation, false);
  assert.equal("confidence" in observation, false);
  assert.deepEqual(observacionesSmile({ id: id(7), date, version: "qa", result: { regions: [] } }), []);
});

const url = `http://localhost/api/clinical/patients/${id(1)}/odontogram`;
const record = { tooth: 11, surface: "incisal", condition: "caries", phase: "hallazgo", note: "Nota sintética", replacesId: null, correctionReason: null };
const body = { membershipId: id(2), encounterId: id(3), record, review: null };
const req = (data, headers = {}) => new Request(data ? url : url + "?membershipId=" + id(2), {
  method: data ? "POST" : "GET",
  headers: { Authorization: "Bearer a.b.c", "Content-Type": "application/json", "Idempotency-Key": id(5), ...headers },
  body: data && JSON.stringify(data),
});

function prepare(payload, status) {
  const calls = [];
  const api = crearApiClinica({
    enabled: true, cursorSecret: "local", cursorTtl: 60, autenticar: async () => ({
      ok: true, usuario: { id: id(9), sessionId: id(8), exp: 9999999999, roles: ["odontologo"] },
      async rpc(name, args) {
        calls.push({ name, args });
        return { data: { ok: status < 400, status, requestId: id(11), data: payload }, error: null };
      },
    }),
  });
  return { api, calls };
}

test("BFF rechaza superficie inaplicable, suplantación y origen cruzado antes del RPC", async () => {
  const { api, calls } = prepare({}, 200);
  assert.equal((await api.odontograma(req({ ...body, record: { ...record, surface: "oclusal" } }), id(1))).status, 400);
  assert.equal((await api.odontograma(req({ ...body, author: id(1) }), id(1))).status, 400);
  assert.equal((await api.odontograma(req(body, { Origin: "https://example.test" }), id(1))).status, 403);
  assert.equal(calls.length, 0);
});

test("BFF conserva el alcance del RPC y entrega DTO sin rutas de Storage ni datos técnicos", async () => {
  const { api, calls } = prepare({
    patientId: id(1), patientName: "Paciente sintético", encounters: [], records: [], reviews: [],
    analyses: [{ id: id(7), date, version: "qa", path: "private/path.png", result }],
  }, 200);
  const res = await api.odontograma(req(), id(1));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("cache-control"), /no-store/);
  assert.equal(calls[0].name, "access_clinical_odontogram");
  assert.equal(calls[0].args.p_membership, id(2));
  assert.equal(calls[0].args.p_patient, id(1));
  const raw = await res.text();
  assert.doesNotMatch(raw, /private\/path|thresholds/);
  assert.match(raw, /region:2/);
});

test("BFF respeta la denegación del RPC y conserva la llave idempotente", async () => {
  const authorized = prepare({ id: id(5) }, 201);
  assert.equal((await authorized.api.odontograma(req(body), id(1))).status, 201);
  assert.equal(authorized.calls[0].args.p_id, id(5));
  const forbidden = prepare(null, 403);
  assert.equal((await forbidden.api.odontograma(req(body), id(1))).status, 403);
});

test("los módulos comparten sesión y conservan permisos de descarga independientes", async () => {
  const calls = [];
  const downloads = [];
  let premiumShared = true;
  const path = id(9) + "/" + id(3) + "/foto.png";
  const photo = new Blob(["foto sintética"], { type: "image/png" });
  const api = crearApiClinica({
    enabled: true, cursorSecret: "local", cursorTtl: 60,
    downloadPremiumPhoto: async (_token, reference) => {
      downloads.push(["premium", reference.path]);
      return photo;
    },
    autenticar: async () => ({
      ok: true, usuario: { id: id(9), sessionId: id(8), exp: 9999999999, roles: ["odontologo"] },
      descargarFoto: async (reference) => {
        downloads.push(["odontograma", reference]);
        return photo;
      },
      async rpc(name, args) {
        calls.push({ name, args });
        const isPremium = name === "access_premium_history";
        const allowed = !isPremium || premiumShared;
        const data = isPremium ? { path, mime: "image/png", size: photo.size, digest: "ab".repeat(32) } : { path };
        return { data: { ok: allowed, status: allowed ? 200 : 403, requestId: id(11), data }, error: null };
      },
    }),
  });
  const premium = () => api.premiumHistory(new Request("http://localhost/api/professional/premium-history", {
    method: "POST",
    headers: { Authorization: "Bearer a.b.c", "Content-Type": "application/json" },
    body: JSON.stringify({ patientId: id(1), membershipId: id(2), photo: id(7) }),
  }), true);
  const chart = () => api.odontograma(new Request(url + "?membershipId=" + id(2) + "&photo=" + id(7), {
    headers: { Authorization: "Bearer a.b.c" },
  }), id(1));

  const initial = await premium();
  assert.equal(initial.status, 200);
  assert.match(initial.headers.get("cache-control"), /private.*no-store/);
  assert.equal(initial.headers.get("x-content-type-options"), "nosniff");
  premiumShared = false;
  assert.equal((await premium()).status, 403);
  const original = await chart();
  assert.equal(original.status, 200);
  assert.match(original.headers.get("cache-control"), /private.*no-store/);
  assert.equal(original.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(downloads, [["premium", path], ["odontograma", path]]);
  assert.deepEqual(calls.map(call => [call.name, call.args.p_patient, call.args.p_member ?? call.args.p_membership]), [
    ["access_premium_history", id(1), id(2)],
    ["access_premium_history", id(1), id(2)],
    ["access_clinical_odontogram", id(1), id(2)],
  ]);
});
