"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Payment } from "@/types/payments";
import type { ReactNode } from "react";

export default function EstadoPago({ sessionId }: { sessionId?: string }) {
  const [pago, setPago] = useState<Payment | null>(null);
  const [intentos, setIntentos] = useState(0);
  const [consultaFallida, setConsultaFallida] = useState(false);
  const [reintentoManual, setReintentoManual] = useState(0);

  useEffect(() => {
    if (!sessionId || pago?.status === "paid" || pago?.status === "expired"
      || pago?.status === "failed" || intentos >= 6) return;
    let active = true;

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await getSupabaseBrowserClient()
          .from("payments")
          .select("*")
          .eq("stripe_session_id", sessionId)
          .maybeSingle();
        if (!active) return;
        if (error) {
          setConsultaFallida(true);
        } else {
          setConsultaFallida(false);
          if (data) setPago(data);
        }
      } catch {
        if (active) setConsultaFallida(true);
      } finally {
        if (active) setIntentos((n) => n + 1);
      }
    }, intentos === 0 ? 0 : 2000);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [sessionId, pago, intentos, reintentoManual]);

  let mensaje: ReactNode;
  if (!sessionId) {
    mensaje = <p className="notice notice-error">Falta el identificador de la sesión.</p>;
  } else if (pago?.status === "paid") {
    mensaje = (
      <p className="notice">
        <strong>Pago de demostración confirmado.</strong>
        Este registro no activa una suscripción ni funciones Premium.
      </p>
    );
  } else if (pago?.status === "expired") {
    mensaje = <p className="notice">La sesión de pago de prueba expiró. Puedes iniciar otra desde Premium.</p>;
  } else if (pago?.status === "failed") {
    mensaje = <p className="notice notice-error">El pago de prueba no se completó. No se activó ninguna función Premium.</p>;
  } else if (intentos >= 6) {
    mensaje = (
      <div className={consultaFallida ? "notice notice-error" : "notice"} role={consultaFallida ? "alert" : undefined}>
        <p>{consultaFallida
          ? "No pudimos consultar la confirmación."
          : "El pago sigue pendiente; aún no recibimos la confirmación final."}</p>
        <button
          className="action"
          type="button"
          onClick={() => {
            setIntentos(0);
            setConsultaFallida(false);
            setReintentoManual((value) => value + 1);
          }}
        >
          Reintentar
        </button>
      </div>
    );
  } else if (consultaFallida) {
    mensaje = <p className="notice notice-error" role="alert">No se pudo consultar el pago; volveremos a intentarlo.</p>;
  } else if (pago?.status === "unpaid") {
    mensaje = <p className="notice">El pago de prueba está pendiente de confirmación.</p>;
  } else {
    mensaje = <p className="notice">Confirmando tu pago de prueba…</p>;
  }

  return (
    <div role="status" aria-live="polite">
      {mensaje}
    </div>
  );
}