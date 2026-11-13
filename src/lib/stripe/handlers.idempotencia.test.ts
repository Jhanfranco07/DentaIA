import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

type Fila = {
  stripe_session_id: string;
  stripe_event_id: string;
  status: string;
};

const mocks = vi.hoisted(() => ({ admin: null as unknown }));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => mocks.admin,
}));

import {
  handleAsyncPaymentSucceeded,
  handleCheckoutCompleted,
  handleCheckoutExpired,
} from "./handlers";

// Tabla en memoria con las MISMAS restricciones UNIQUE que `payments`:
// stripe_session_id y stripe_event_id.
function crearAdminFalso() {
  const filas: Fila[] = [];

  return {
    filas,
    from: () => ({
      insert: async (row: Fila) => {
        const choca = filas.some(
          (f) =>
            f.stripe_session_id === row.stripe_session_id ||
            f.stripe_event_id === row.stripe_event_id
        );
        if (choca) {
          return {
            error: {
              code: "23505",
              message: "duplicate key value violates unique constraint",
            },
          };
        }
        filas.push({ ...row });
        return { error: null };
      },
      select: () => ({
        eq: (columna: string, valor: string) => ({
          maybeSingle: async () => ({
            data: filas.find((f) => (columna === "stripe_event_id" ? f.stripe_event_id : f.stripe_session_id) === valor) ?? null,
            error: null,
          }),
        }),
      }),
      update: (cambios: Partial<Fila>) => ({
        eq: (_columna1: string, sesion: string) => ({
          eq: async (_columna2: string, estado: string) => {
            const fila = filas.find(
              (f) => f.stripe_session_id === sesion && f.status === estado
            );
            if (fila) Object.assign(fila, cambios);
            return { error: null };
          },
        }),
      }),
    }),
  };
}

function evento(
  id: string,
  sesion: string,
  pago: "paid" | "unpaid",
  tipo = "checkout.session.completed"
) {
  return {
    id,
    type: tipo,
    data: {
      object: {
        id: sesion,
        client_reference_id: "user-1",
        amount_total: 1000,
        currency: "usd",
        metadata: { plan: "premium-demo" },
        payment_status: pago,
      },
    },
  } as unknown as Stripe.Event;
}

const ASYNC_OK = "checkout.session.async_payment_succeeded";
const EXPIRADO = "checkout.session.expired";

let admin = crearAdminFalso();

beforeEach(() => {
  admin = crearAdminFalso();
  mocks.admin = admin;
});

describe("idempotencia del webhook con restricciones UNIQUE", () => {
  it("el mismo evento reenviado no duplica ni falla", async () => {
    const e = evento("evt_1", "cs_1", "paid");

    await handleCheckoutCompleted(e);
    await expect(handleCheckoutCompleted(e)).resolves.toBeUndefined();

    expect(admin.filas).toHaveLength(1);
  });

  it("un evento distinto de la misma sesión avanza unpaid -> paid sin error", async () => {
    await handleCheckoutCompleted(evento("evt_1", "cs_1", "unpaid"));
    await handleAsyncPaymentSucceeded(evento("evt_2", "cs_1", "paid", ASYNC_OK));

    expect(admin.filas).toHaveLength(1);
    expect(admin.filas[0]).toMatchObject({
      stripe_event_id: "evt_1",
      status: "paid",
    });
  });

  it("los eventos fuera de orden no retroceden un pago ya pagado", async () => {
    await handleAsyncPaymentSucceeded(evento("evt_2", "cs_1", "paid", ASYNC_OK));
    await handleCheckoutCompleted(evento("evt_1", "cs_1", "unpaid"));

    expect(admin.filas).toHaveLength(1);
    expect(admin.filas[0].status).toBe("paid");
  });

  it("reenviar eventos antiguos no altera el estado final", async () => {
    const e1 = evento("evt_1", "cs_1", "unpaid");
    const e2 = evento("evt_2", "cs_1", "paid", ASYNC_OK);

    await handleCheckoutCompleted(e1);
    await handleAsyncPaymentSucceeded(e2);
    await handleCheckoutCompleted(e1);
    await handleAsyncPaymentSucceeded(e2);

    expect(admin.filas).toHaveLength(1);
    expect(admin.filas[0].status).toBe("paid");
  });

  it("sesiones distintas generan filas distintas", async () => {
    await handleCheckoutCompleted(evento("evt_1", "cs_1", "paid"));
    await handleCheckoutCompleted(evento("evt_2", "cs_2", "paid"));

    expect(admin.filas).toHaveLength(2);
  });

  it("un pago expirado no pasa a pagado por un evento tardío", async () => {
    await handleCheckoutExpired(evento("evt_1", "cs_1", "unpaid", EXPIRADO));
    await handleAsyncPaymentSucceeded(evento("evt_2", "cs_1", "paid", ASYNC_OK));

    expect(admin.filas[0].status).toBe("expired");
  });

  it("entregas concurrentes del mismo evento dejan una sola fila", async () => {
    const e = evento("evt_1", "cs_1", "paid");
    await Promise.all([handleCheckoutCompleted(e), handleCheckoutCompleted(e)]);
    expect(admin.filas).toHaveLength(1);
  });

  it("un evento de expiración no retrocede un pago paid", async () => {
    await handleCheckoutCompleted(evento("evt_1", "cs_1", "paid"));
    await handleCheckoutExpired(evento("evt_2", "cs_1", "unpaid", EXPIRADO));
    expect(admin.filas[0].status).toBe("paid");
  });

  it("una sesión unpaid puede expirar sin crear otra fila", async () => {
    await handleCheckoutCompleted(evento("evt_1", "cs_1", "unpaid"));
    await handleCheckoutExpired(evento("evt_2", "cs_1", "unpaid", EXPIRADO));
    expect(admin.filas).toHaveLength(1);
    expect(admin.filas[0]).toMatchObject({ status: "expired", stripe_event_id: "evt_1" });
  });

  it("no ignora un event_id que colisiona con otra sesión", async () => {
    await handleCheckoutCompleted(evento("evt_1", "cs_1", "paid"));
    await expect(handleCheckoutCompleted(evento("evt_1", "cs_2", "paid"))).rejects.toMatchObject({ code: "23505" });
    expect(admin.filas).toHaveLength(1);
  });

  it("no ignora una colisión de sesión con otro propietario", async () => {
    await handleCheckoutCompleted(evento("evt_1", "cs_1", "unpaid"));
    const otro = evento("evt_2", "cs_1", "paid", ASYNC_OK);
    (otro.data.object as Stripe.Checkout.Session).client_reference_id = "user-2";
    await expect(handleAsyncPaymentSucceeded(otro)).rejects.toMatchObject({ code: "23505" });
    expect(admin.filas[0].status).toBe("unpaid");
  });

  it("no aplica un evento de otra sesión aunque ambas sesiones ya existan", async () => {
    await handleCheckoutCompleted(evento("evt_1", "cs_1", "paid"));
    await handleCheckoutCompleted(evento("evt_2", "cs_2", "unpaid"));
    await expect(handleAsyncPaymentSucceeded(evento("evt_1", "cs_2", "paid", ASYNC_OK))).rejects.toMatchObject({ code: "23505" });
    expect(admin.filas.find(f => f.stripe_session_id === "cs_2")?.status).toBe("unpaid");
  });

});