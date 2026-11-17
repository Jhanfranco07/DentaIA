"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Plan } from "@/features/planes/catalogo";

type PlanState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "error" }
  | { kind: "ready"; plan: Plan };

export default function EstadoPlanPremium() {
  const [state, setState] = useState<PlanState>({ kind: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    async function loadPlan() {
      try {
        const { data, error } = await getSupabaseBrowserClient().auth.getSession();
        if (!active) return;
        if (error) {
          setState({ kind: "error" });
          return;
        }
        if (!data.session) {
          setState({ kind: "anonymous" });
          return;
        }

        const response = await fetch("/api/premium/status", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error("No se pudo verificar el plan.");
        const body: unknown = await response.json();
        if (!body || typeof body !== "object" || !("plan" in body)
          || (body.plan !== "basic" && body.plan !== "premium")) {
          throw new Error("Respuesta de plan no válida.");
        }
        if (active) setState({ kind: "ready", plan: body.plan });
      } catch {
        if (active) setState({ kind: "error" });
      }
    }

    void loadPlan();
    return () => { active = false; };
  }, [retry]);

  return (
    <section className="surface panel" aria-labelledby="plan-premium-title">
      <h2 id="plan-premium-title">Tu plan</h2>
      {state.kind === "loading" && <p role="status">Verificando tu plan…</p>}
      {state.kind === "anonymous" && (
        <div>
          <p>Inicia sesión para consultar tu plan.</p>
          <button className="action" type="button" onClick={() => setRetry((value) => value + 1)}>
            Volver a consultar
          </button>
        </div>
      )}
      {state.kind === "error" && (
        <div className="notice notice-error" role="alert">
          <p>No se pudo verificar tu plan en este momento.</p>
          <button className="action" type="button" onClick={() => setRetry((value) => value + 1)}>
            Reintentar
          </button>
        </div>
      )}
      {state.kind === "ready" && (
        <p role="status">
          Plan {state.plan === "premium" ? "Premium verificado" : "Basic"}.
          Las funciones Premium futuras siguen deshabilitadas.
        </p>
      )}
    </section>
  );
}
