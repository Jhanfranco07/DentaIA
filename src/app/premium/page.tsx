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
      if (!data.session) throw new Error("Inicia sesión para continuar.");

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        signal: AbortSignal.timeout(15000),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo iniciar el pago.");
      const checkoutUrl = new URL(json.url);
      if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") {
        throw new Error("Stripe devolvió una URL de pago no válida.");
      }
      window.location.assign(checkoutUrl.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setCargando(false);
    }
  }

  return (
    <main className="module-shell">
      <div className="page-intro">
        <p>
          Demostración de Checkout de pago único en Stripe Sandbox. El monto es
          ficticio y este flujo no activa una suscripción ni funciones Premium.
        </p>
        <span className="pill">PLAN PREMIUM</span>
        <h1>DentAI Premium</h1>
      </div>

      <section className="surface panel">
        <h2>{PLAN_PREMIUM.name}</h2>
        <p className="precio">{precio}</p>
        <button
          className="action"
          onClick={pagar}
          disabled={cargando}
          aria-busy={cargando}
        >
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