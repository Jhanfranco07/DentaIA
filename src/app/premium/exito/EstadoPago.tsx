"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Payment } from "@/types/payments";

export default function EstadoPago({ sessionId }: { sessionId?: string }) {
  const [pago, setPago] = useState<Payment | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    getSupabaseBrowserClient()
      .from("payments")
      .select("*")
      .eq("stripe_session_id", sessionId)
      .maybeSingle()
      .then(({ data }) => setPago(data as Payment | null));
  }, [sessionId]);

  if (!sessionId) {
    return <p className="notice notice-error">Falta el identificador de la sesión.</p>;
  }
  if (!pago) {
    return <p className="notice">Aún no vemos tu pago registrado.</p>;
  }
  return (
    <p className="notice">
      <strong>Pago registrado</strong>
      Estado: {pago.status}
    </p>
  );
}