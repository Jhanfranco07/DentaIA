"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Payment } from "@/types/payments";

const ESTADOS: Record<Payment["status"], string> = {
  paid: "Pagado",
  unpaid: "Pendiente",
  expired: "Expirado",
};

export default function MisPagos() {
  const [pagos, setPagos] = useState<Payment[]>([]);

  useEffect(() => {
    getSupabaseBrowserClient()
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPagos((data as Payment[]) ?? []));
  }, []);

  return (
    <section className="surface panel">
      <h2>Mis pagos</h2>
            {pagos.length === 0 ? (
        <p className="muted">Aún no tienes pagos de prueba.</p>
      ) : (
        <ul className="pago-lista">
          {pagos.map((p) => (
            <li className="pago-fila" key={p.id}>
              <span>{new Date(p.created_at).toLocaleDateString("es-PE")}</span>
              <span>
                {(p.amount_total / 100).toFixed(2)} {p.currency.toUpperCase()}
              </span>
              <span>{ESTADOS[p.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}