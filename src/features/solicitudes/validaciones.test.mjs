
import test from "node:test";
import assert from "node:assert/strict";

import {
  validarSolicitud,
  puedeCancelarSolicitud,
} from "./validaciones.ts";

const hoy = "2026-10-27";

const solicitudValida = {
  odontologoId: "odontologo-demo-1",
  nombre: "Paciente Prueba",
  correo: "paciente@example.com",
  fecha: "2026-11-05",
  mensaje: "Solicitud de demostración",
};

test("acepta una solicitud válida", () => {
  assert.equal(
    validarSolicitud(solicitudValida, hoy),
    null
  );
});

test("rechaza campos obligatorios vacíos", () => {
  assert.ok(
    validarSolicitud(
      { ...solicitudValida, odontologoId: "" },
      hoy
    )
  );

  assert.ok(
    validarSolicitud(
      { ...solicitudValida, nombre: " " },
      hoy
    )
  );
});

test("rechaza correos inválidos", () => {
  assert.ok(
    validarSolicitud(
      { ...solicitudValida, correo: "correo-invalido" },
      hoy
    )
  );
});

test("rechaza fechas anteriores a hoy", () => {
  assert.ok(
    validarSolicitud(
      { ...solicitudValida, fecha: "2026-10-26" },
      hoy
    )
  );
});

test("acepta la fecha actual", () => {
  assert.equal(
    validarSolicitud(
      { ...solicitudValida, fecha: hoy },
      hoy
    ),
    null
  );
});

test("rechaza mensajes mayores a 1000 caracteres", () => {
  assert.ok(
    validarSolicitud(
      { ...solicitudValida, mensaje: "A".repeat(1001) },
      hoy
    )
  );
});

test("acepta mensajes de 1000 caracteres", () => {
  assert.equal(
    validarSolicitud(
      { ...solicitudValida, mensaje: "A".repeat(1000) },
      hoy
    ),
    null
  );
});

test("solo permite cancelar solicitudes solicitadas", () => {
  assert.equal(puedeCancelarSolicitud("requested"), true);
  assert.equal(puedeCancelarSolicitud("cancelled"), false);
  assert.equal(puedeCancelarSolicitud("confirmed"), false);
});


test("rechaza fechas inexistentes", () => {
  const fechasInvalidas = [
    "2026-02-29",
    "2026-02-31",
    "2026-04-31",
    "2026-13-05",
    "2026-00-10",
    "fecha-invalida",
  ];

  for (const fecha of fechasInvalidas) {
    assert.match(
      validarSolicitud({ ...solicitudValida, fecha }, hoy),
      /fecha válida/,
      `La fecha ${fecha} debería rechazarse`
    );
  }
});

test("acepta el 29 de febrero de un año bisiesto", () => {
  assert.equal(
    validarSolicitud(
      { ...solicitudValida, fecha: "2028-02-29" },
      hoy
    ),
    null
  );
});
