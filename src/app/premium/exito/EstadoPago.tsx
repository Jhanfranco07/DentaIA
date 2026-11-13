"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Payment } from "@/types/payments";
import type { ReactNode } from "react";

export default function EstadoPago({ sessionId }: { sessionId?: string }) {
  const [pago, setPago] = useState<Payment | null>(null);
  const [intentos, setIntentos] = useState(0);

  useEffect(() => {
    if (!sessionId || pago || intentos >= 6) return;

    const timer = setTimeout(async () => {
      const { data } = await getSupabaseBrowserClient()
        .from("payments")
        .select("*")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (data) setPago(data as Payment);
      setIntentos((n) => n + 1);
    }, intentos === 0 ? 0 : 2000);

    return () => clearTimeout(timer);
  }, [sessionId, pago, intentos]);

  let mensaje: ReactNode;
  if (!sessionId) {
    mensaje = <p className="notice notice-error">Falta el identificador de la sesión.</p>;
  } else if (pago) {
    mensaje = (
      <p className="notice">
        <strong>Pago registrado</strong>
        Estado: {pago.status}
      </p>
    );
  } else if (intentos >= 6) {
    mensaje = <p className="notice">Todavía no recibimos la confirmación. Revisa «Mis pagos» en unos minutos.</p>;
  } else {
    mensaje = <p className="notice">Confirmando tu pago de prueba…</p>;
  }

  return (
    <div role="status" aria-live="polite">
      {mensaje}
    </div>
  );
}