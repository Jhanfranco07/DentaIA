"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PLAN_PREMIUM_MENSUAL } from "@/lib/stripe/plan";
import styles from "./premium.module.css";
import PortalShell from "@/components/PortalShell";
import { NAVEGACION_PACIENTE } from "@/components/navegacion-portal";
import { useSesion } from "@/features/cuenta/useSesion";
import { rolesDelUsuario } from "@/features/autorizacion/roles";

type Estado = {
  plan: "basic" | "premium";
  subscription: { status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null;
};

const ESTADOS_EXISTENTES = ["active", "trialing", "past_due", "unpaid", "incomplete"];

export default function PremiumPage() {
  const { usuario } = useSesion();
  const paciente = rolesDelUsuario(usuario).includes("paciente");
  const [estado, setEstado] = useState<Estado | null>(null);
  const [correo, setCorreo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [iniciar, setIniciar] = useState(false);
  const inicioEjecutado = useRef(false);

  const token = useCallback(async () => {
    const { data, error: authError } = await getSupabaseBrowserClient().auth.getSession();
    if (authError || !data.session) throw new Error("Inicia sesión para continuar.");
    return data.session.access_token;
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const { data, error: authError } = await getSupabaseBrowserClient().auth.getSession();
      if (authError) throw authError;
      if (!data.session) {
        setCorreo(null);
        setEstado(null);
        return;
      }
      setCorreo(data.session.user.email ?? "Cuenta de DentaIA");
      const res = await fetch("/api/premium/status", {
        headers: { Authorization: "Bearer " + data.session.access_token },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error("No pudimos consultar tu plan. Inténtalo de nuevo.");
      const plan: Estado = await res.json();
      setEstado(plan);
    } catch (cause) {
      setEstado(null);
      setError(cause instanceof Error ? cause.message : "No se pudo consultar tu plan.");
    } finally {
      setCargando(false);
    }
  }, []);

  const contratar = useCallback(async () => {
    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      const accessToken = await token();
      const res = await fetch("/api/stripe/subscription/checkout", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken },
        signal: AbortSignal.timeout(15000),
      });
      const json: { error?: string; url?: string } = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No pudimos abrir Stripe Checkout.");
      if (!json.url) throw new Error("Stripe no devolvió una URL.");
      const url = new URL(json.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("URL de Stripe no válida.");
      window.location.assign(url.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos abrir Stripe Checkout.");
      setProcesando(false);
    }
  }, [token]);

  useEffect(() => {
    const solicitado = new URLSearchParams(window.location.search).get("iniciar") === "1";
    setIniciar(solicitado);
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!iniciar || cargando || inicioEjecutado.current) return;
    // No duplicar una suscripción ni saltar la verificación del estado.
    if (correo && !estado) return;
    inicioEjecutado.current = true;
    if (!correo) {
      window.location.replace("/cuenta?continuar=%2Fpremium%3Finiciar%3D1");
      return;
    }
    if (estado && !ESTADOS_EXISTENTES.includes(estado.subscription?.status ?? "") && estado.plan !== "premium") {
      void contratar();
    }
  }, [iniciar, cargando, correo, estado, contratar]);

  async function cancelar() {
    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      const accessToken = await token();
      const res = await fetch("/api/stripe/subscription/cancel", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken },
        signal: AbortSignal.timeout(15000),
      });
      const json: { error?: string } = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo cancelar.");
      setMensaje("La cancelación quedó solicitada. Mantendrás el acceso hasta el final del período.");
      await cargar();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cancelar.");
    } finally {
      setProcesando(false);
    }
  }

  const suscripcion = estado?.subscription;
  const vigente = estado?.plan === "premium";
  const existente = Boolean(suscripcion && ESTADOS_EXISTENTES.includes(suscripcion.status));
  const fecha = suscripcion?.current_period_end && !Number.isNaN(Date.parse(suscripcion.current_period_end))
    ? new Date(suscripcion.current_period_end).toLocaleDateString("es-PE") : null;
  const precio = (PLAN_PREMIUM_MENSUAL.amount / 100).toFixed(2);

  const contenido = (
    <main id="contenido" tabIndex={-1} className={styles.pagina}>
      <section className={styles.hero} aria-labelledby="premium-titulo">
        <div>
          <span className={styles.eyebrow}>✦ DentaIA Premium · Experiencia de prueba</span>
          <h1 id="premium-titulo">Más posibilidades para tu sonrisa.</h1>
          <p>Conoce tu plan, consulta el estado de tu cuenta y continúa de forma segura a Stripe Sandbox. Las funcionalidades avanzadas siguen en desarrollo.</p>
        </div>
        <div className={styles.precio}>
          <span>PLAN PREMIUM MENSUAL</span>
          <strong>S/ {precio}</strong>
          <small>por mes · importe simulado</small>
          <span>Sin cargos reales en Stripe Sandbox</span>
        </div>
      </section>

      <div className={styles.estadoCuenta} role="status">
        <div><strong>{cargando ? "Comprobando tu cuenta…" : correo ? "Tu cuenta DentaIA" : "Aún no has iniciado sesión"}</strong>
          <span>{correo ?? "Puedes ingresar con una cuenta existente o registrarte."}</span></div>
        <span className={styles.etiqueta}>{cargando ? "Verificando" : vigente ? "Premium activo" : correo ? "Plan Basic" : "Sin sesión"}</span>
      </div>

      <div className={styles.columnas}>
        <section className={styles.panel} aria-labelledby="plan-titulo">
          <h2 id="plan-titulo">{vigente ? "Tu suscripción Premium" : "Completa tu experiencia Premium"}</h2>
          {vigente ? (
            <p className={styles.destacado}>¡Tu plan Premium está activo!</p>
          ) : <p>Tu elección está lista. Si ya tienes cuenta, no necesitas registrarte nuevamente. La activación se confirmará únicamente mediante el webhook firmado de Stripe.</p>}
          {existente && <p className={styles.nota}>Suscripción registrada: <strong>{suscripcion?.status}</strong>. {fecha ? "Vigencia hasta " + fecha + "." : ""} No generaremos otra suscripción mientras esta siga en curso.</p>}
          {suscripcion?.cancel_at_period_end && <p className={styles.nota}>Tu suscripción está programada para finalizar al término del período.</p>}
          {cargando && <p role="status">Consultando el estado de la suscripción…</p>}
          <div className={styles.acciones}>
            {!cargando && !correo && (
              <>
                <Link className={styles.primario} href="/cuenta?continuar=%2Fpremium%3Finiciar%3D1">Ya tengo cuenta · Iniciar sesión</Link>
                <Link className={styles.secundario} href={"/cuenta?modo=registro&continuar=%2Fpremium%3Finiciar%3D1"}>Crear cuenta</Link>
              </>
            )}
            {!cargando && correo && estado && !existente && !vigente && (
              <button className={styles.primario} type="button" disabled={procesando} onClick={() => void contratar()}>
                {procesando ? "Conectando con Stripe…" : "Continuar a Stripe Sandbox →"}
              </button>
            )}
            {!cargando && existente && !suscripcion?.cancel_at_period_end && ["active", "trialing", "past_due"].includes(suscripcion?.status ?? "") && (
              <button className={styles.secundario} type="button" disabled={procesando} onClick={() => void cancelar()}>Cancelar al final del período</button>
            )}
            {correo && <button className={styles.secundario} type="button" disabled={procesando || cargando} onClick={() => void cargar()}>Actualizar estado</button>}
            {!cargando && correo && !estado && <button className={styles.secundario} type="button" onClick={() => void cargar()}>Reintentar consulta</button>}
          </div>
          {mensaje && <p role="status" className={styles.ok}>{mensaje}</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.nota}>🔒 Pago exclusivamente de prueba. Utiliza la tarjeta de Stripe <strong>4242 4242 4242 4242</strong>, una fecha futura y un CVC de prueba. Nunca ingreses una tarjeta real aquí.</div>
        </section>

        <aside className={styles.lateral} aria-labelledby="beneficios-titulo">
          <h2 id="beneficios-titulo">¿Qué incluye?</h2>
          <p>Información clara sobre las capacidades actuales y previstas.</p>
          <ul className={styles.lista}>
            <li><span>✓</span>Funciones de la experiencia Gratis.</li>
            <li><span>✓</span>Plan y suscripción consultables desde tu cuenta.</li>
            <li><span>↗</span>Evaluaciones adicionales — en desarrollo.</li>
            <li><span>↗</span>Seguimiento ampliado — en desarrollo.</li>
          </ul>
          <div className={styles.ayuda}>El pago de demostración no equivale a una atención clínica ni habilita funciones todavía no implementadas. <Link href="/panel">Volver al panel</Link></div>
        </aside>
      </div>
    </main>
  );

  // La suscripción es una sección del portal, no un destino aislado sin navegación.
  if (paciente) return <PortalShell area="Paciente" descripcion="Tu espacio personal" enlaces={NAVEGACION_PACIENTE} mostrarCuentaHeader={false}>{contenido}</PortalShell>;
  return contenido;
}
