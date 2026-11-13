"use client";
import { PLAN_PREMIUM } from "@/lib/stripe/plan";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useState } from "react";

const precio = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: PLAN_PREMIUM.currency.toUpperCase(),
}).format(PLAN_PREMIUM.amount / 100);

export default function PremiumPage() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function pagar() {
    setError("");
    setCargando(true);
    try {
      const client = getSupabaseBrowserClient();
      const { data } = await client.auth.getSession();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo iniciar el pago.");
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setCargando(false);
    }
  }

  return (
    <main className="module-shell">
      <div className="page-intro">
        <p>
          Plan de demostración con el recorrido premium: reporte educativo A4 y
          recomendaciones. Es un plan ficticio para probar el flujo de pago.
        </p>
        <span className="pill">PLAN PREMIUM</span>
        <h1>DentAI Premium</h1>
      </div>

      <section className="surface panel">
        <h2>{PLAN_PREMIUM.name}</h2>
        <p className="precio">{precio}</p>
        <button className="action" onClick={pagar} disabled={cargando}>
          {cargando ? "Redirigiendo…" : "Pagar con Stripe (modo prueba)"}
        </button>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <p className="notice">
        <strong>Modo prueba</strong>
        No se cobra dinero real. Usa la tarjeta 4242 4242 4242 4242, cualquier
        fecha futura y cualquier CVC.
      </p>
    </main>
  );
}