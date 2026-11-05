import assert from "node:assert/strict";
import test from "node:test";
import config from "../../../next.config.ts";

test("la política permite cámara y geolocalización al origen y mantiene bloqueado el micrófono", async () => {
  const rutas = await config.headers();
  const politica = rutas.flatMap(ruta => ruta.headers)
    .find(header => header.key.toLowerCase() === "permissions-policy")?.value;

  assert.equal(politica, "camera=(self), microphone=(), geolocation=(self)");
});
