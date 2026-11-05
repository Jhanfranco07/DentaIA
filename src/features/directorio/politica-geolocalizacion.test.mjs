import assert from "node:assert/strict";
import test from "node:test";
import config from "../../../next.config.ts";

test("la política permite geolocalización voluntaria del origen y mantiene cámara y micrófono bloqueados", async () => {
  const rutas = await config.headers();
  const politica = rutas.flatMap(ruta => ruta.headers)
    .find(header => header.key.toLowerCase() === "permissions-policy")?.value;

  assert.equal(politica, "camera=(), microphone=(), geolocation=(self)");
});
