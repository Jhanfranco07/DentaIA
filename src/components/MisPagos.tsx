"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatStripeAmount } from "@/lib/stripe/format";
import type { Payment } from "@/types/payments";

type LoadState = "checking" | "loading" | "signedOut" | "ready" | "error";
type PaymentHistoryEntry = Pick<Payment, "id" | "amount_total" | "currency" | "status" | "created_at">;

const ESTADOS: Record<Payment["status"], string> = {
  paid: "Pagado",
  unpaid: "Pendiente",
  expired: "Expirado",
  failed: "No completado",
};

export default function MisPagos() {
  const [pagos, setPagos] = useState<PaymentHistoryEntry[]>([]);
  const [state, setState] = useState<LoadState>("checking");
  const [retry, setRetry] = useState(0);
  const [authChange, setAuthChange] = useState(0);

  useEffect(() => {
    let active = true;
    let client: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      client = getSupabaseBrowserClient();
    } catch {
      setState("error");
      return () => { active = false; };
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      if (session?.user.id || event === "SIGNED_OUT") setAuthChange((value) => value + 1);
    });

    setState("checking");
    setPagos([]);
    void (async () => {
      try {
        const { data: identidad, error: errorIdentidad } = await client.auth.getUser();
        if (!active) return;
        if (errorIdentidad && errorIdentidad.name !== "AuthSessionMissingError") {
          setState("error");
          return;
        }
        if (!identidad.user) {
          setState("signedOut");
          return;
        }

        setState("loading");
        const { data, error } = await client
          .from("payments")
          .select("id,amount_total,currency,status,created_at")
          .order("created_at", { ascending: false });
        if (!active) return;
        if (error || !data) {
          setState("error");
          return;
        }
        setPagos(data);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [authChange, retry]);

  function retryHistory() {
    setRetry((value) => value + 1);
  }

  return (
    <section className="surface panel" aria-labelledby="mis-pagos-title">
      <h2 id="mis-pagos-title">Mis pagos de prueba</h2>
      {state === "checking" && <p role="status">Comprobando tu sesión…</p>}
      {state === "loading" && <p role="status">Cargando tus pagos…</p>}
      {state === "error" && (
        <div className="notice notice-error" role="alert">
          <p>No se pudo consultar el historial de pagos.</p>
          <button className="action" type="button" onClick={retryHistory}>Reintentar</button>
        </div>
      )}
      {state === "signedOut" && (
        <p className="muted">Inicia sesión para consultar tus pagos de prueba.</p>
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