"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PLAN_PREMIUM_MENSUAL } from "@/lib/stripe/plan";

type Estado = {
  plan: "basic" | "premium";
  subscription: { status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null;
};

export default function PremiumPage() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const token = useCallback(async () => {
    const { data, error } = await getSupabaseBrowserClient().auth.getSession();
    if (error || !data.session) throw new Error("Inicia sesión para continuar.");
    return data.session.access_token;
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const accessToken = await token();
      const res = await fetch("/api/premium/status", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error("No se pudo consultar tu plan.");
      const data: Estado = await res.json();
      setEstado(data);
    } catch (cause) {
      setEstado(null);
      setError(cause instanceof Error ? cause.message : "No se pudo consultar tu plan.");
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function contratar() {
    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      const accessToken = await token();
      const res = await fetch("/api/stripe/subscription/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo iniciar la suscripción.");
      const url = new URL(json.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("URL de Stripe no válida.");
      window.location.assign(url.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar la suscripción.");
      setProcesando(false);
    }
  }

  async function cancelar() {
    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      const accessToken = await token();
      const res = await fetch("/api/stripe/subscription/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo cancelar.");
      setMensaje("Cancelación solicitada. Conservarás el acceso hasta que finalice el período pagado.");
      await cargar();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cancelar.");
    } finally {
      setProcesando(false);
    }
  }

  const suscripcion = estado?.subscription;
  const vigente = estado?.plan === "premium";
  const existente = suscripcion && ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(suscripcion.status);
  const fecha = suscripcion?.current_period_end && !Number.isNaN(Date.parse(suscripcion.current_period_end))
    ? new Date(suscripcion.current_period_end).toLocaleDateString("es-PE") : null;

  return (
    <main className="module-shell">
      <div className="page-intro">
        <span className="pill">STRIPE SANDBOX · SUSCRIPCIÓN MENSUAL</span>
        <h1>DentaIA Premium</h1>
        <p><strong>S/ {(PLAN_PREMIUM_MENSUAL.amount / 100).toFixed(2)} al mes</strong> (importe de prueba, sin cargos reales).</p>
        <p>Suscripción de prueba, con confirmación segura desde Stripe. No se realizan cargos reales.</p>
      </div>
      <section className="surface panel">
        <h2>Tu plan</h2>
        {cargando ? <p role="status">Consultando tu suscripción…</p> : estado && <>
          <p><strong>{vigente ? "Premium activo" : "Basic"}</strong></p>
          {suscripcion && <p>Estado de la suscripción: {suscripcion.status}. {fecha ? `Vigencia hasta: ${fecha}.` : ""}</p>}
          {suscripcion?.cancel_at_period_end && <p>Tu suscripción está programada para cancelarse al finalizar el período.</p>}
          {!existente && <button type="button" className="action" disabled={procesando} onClick={() => void contratar()}>
            {procesando ? "Procesando…" : "Contratar Premium mensual (prueba)"}
          </button>}
          {existente && !suscripcion?.cancel_at_period_end && ["active", "trialing", "past_due"].includes(suscripcion!.status) &&
            <button type="button" className="action" disabled={procesando} onClick={() => void cancelar()}>
              {procesando ? "Procesando…" : "Cancelar al final del período"}
            </button>}
          <button type="button" className="action" disabled={procesando || cargando} onClick={() => void cargar()}>Actualizar estado</button>
        </>}
        {!estado && !cargando && <button type="button" className="action" onClick={() => void cargar()}>Reintentar</button>}
        {mensaje && <p className="notice" role="status">{mensaje}</p>}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
      </section>
      <p className="notice">Usa solamente la tarjeta de prueba de Stripe 4242 4242 4242 4242, una fecha futura y un CVC de prueba. El plan se activa únicamente cuando el webhook firmado confirma una suscripción activa y vigente. Las funciones avanzadas que siguen en desarrollo no se habilitan automáticamente.</p>
    </main>
  );
}
