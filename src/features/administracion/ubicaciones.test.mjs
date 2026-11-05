import test from "node:test";
import assert from "node:assert/strict";
import { leerOperacionUbicacion, tablaUbicacionesAusente, validarResultadoUbicacion } from "./ubicaciones.ts";

const guardar = {
  operacion: "guardar", dentistId: "44444444-4444-4444-8444-444444444444", clinicId: "77777777-7777-4777-8777-777777777777",
  practiceName: "Clínica", practiceAddress: "Dirección verificada", latitude: -12.1, longitude: -77.1,
};

test("valida y normaliza la entrada de guardar sin aceptar campos adicionales", () => {
  assert.equal(leerOperacionUbicacion(guardar).latitude, -12.1);
  assert.throws(() => leerOperacionUbicacion({ ...guardar, isDemo: true }));
  assert.throws(() => leerOperacionUbicacion({ ...guardar, latitude: Number.NaN }));
  assert.throws(() => leerOperacionUbicacion({ ...guardar, longitude: 181 }));
  assert.throws(() => leerOperacionUbicacion({ ...guardar, practiceAddress: " " }));
});

test("restringe publicar a referencia de verificación y operaciones de ocultar/retirar por ID", () => {
  const id = "88888888-8888-4888-8888-888888888888";
  assert.equal(leerOperacionUbicacion({ operacion: "publicar", ubicacionId: id, verificationReference: "Documento verificado 001" }).ubicacionId, id);
  assert.throws(() => leerOperacionUbicacion({ operacion: "publicar", ubicacionId: id, verificationReference: "corto" }));
  assert.equal(leerOperacionUbicacion({ operacion: "retirar", ubicacionId: id }).operacion, "retirar");
});

test("acepta solo respuestas RPC acotadas sin filtrar campos inesperados", () => {
  assert.equal(validarResultadoUbicacion({ ok: true, status: 200, codigo: "UBICACION_PENDIENTE", ubicacionId: "88888888-8888-4888-8888-888888888888" }).ok, true);
  assert.equal(validarResultadoUbicacion({ ok: false, status: 403, codigo: "ACCESO_DENEGADO" }).status, 403);
  assert.throws(() => validarResultadoUbicacion({ ok: false, status: 403, codigo: "TOKEN_PRIVADO", token: "no" }));
  assert.throws(() => validarResultadoUbicacion({ ok: true, status: 200, codigo: "OK", ubicacionId: "not-uuid" }));
});

test("identifica errores de tabla no expuesta sin confundirlos con denegación o caída", () => {
  assert.equal(tablaUbicacionesAusente({ code: "42P01" }), true);
  assert.equal(tablaUbicacionesAusente({ code: "PGRST205" }), true);
  assert.equal(tablaUbicacionesAusente({ code: "42501" }), false);
  assert.equal(tablaUbicacionesAusente({ code: "08006" }), false);
  assert.equal(tablaUbicacionesAusente(null), false);
});
