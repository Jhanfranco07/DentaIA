"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatStripeAmount } from "@/lib/stripe/format";
import type { Payment } from "@/types/payments";

type LoadState = "loading" | "ready" | "error";

const ESTADOS: Record<Payment["status"], string> = {
  paid: "Pagado",
  unpaid: "Pendiente",
  expired: "Expirado",
  failed: "No completado",
};

export default function MisPagos() {
  const [pagos, setPagos] = useState<Payment[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setState("loading");

    async function loadPayments() {
      try {
        const { data, error } = await getSupabaseBrowserClient()
          .from("payments")
          .select("*")
          .order("created_at", { ascending: false });
        if (!active) return;
        if (error) {
          setState("error");
          return;
        }
        setPagos(data);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    }

    void loadPayments();
    return () => { active = false; };
  }, [retry]);

  return (
    <section className="surface panel" aria-labelledby="mis-pagos-title">
      <h2 id="mis-pagos-title">Mis pagos de prueba</h2>
      {state === "loading" && <p role="status">Cargando tus pagos…</p>}
      {state === "error" && (
        <div className="notice notice-error" role="alert">
          <p>No se pudo consultar el historial de pagos.</p>
          <button className="action" type="button" onClick={() => setRetry((value) => value + 1)}>
            Reintentar
          </button>
        </div>
      )}
      {state === "ready" && pagos.length === 0 && (
        <p className="muted">Aún no tienes pagos de prueba.</p>
      )}
      {state === "ready" && pagos.length > 0 && (
        <ul className="pago-lista">
          {pagos.map((payment) => (
            <li className="pago-fila" key={payment.id}>
              <span>{new Date(payment.created_at).toLocaleDateString("es-PE")}</span>
              <span>{formatStripeAmount(payment.amount_total, payment.currency)}</span>
              <span>{ESTADOS[payment.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}