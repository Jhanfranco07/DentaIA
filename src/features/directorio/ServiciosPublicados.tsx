"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatearPrecio } from "./formato";
import { consultarServicios, type ServicioOdontologico } from "./servicios-odontologicos";

export default function ServiciosPublicados({ dentistId }: { dentistId: string }) {
  const [servicios, setServicios] = useState<ServicioOdontologico[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const control = new AbortController();
    async function cargar() {
      try {
        const resultado = await consultarServicios(getSupabaseBrowserClient(), dentistId, true, control.signal);
        if (resultado.error) throw resultado.error;
        if (!control.signal.aborted) setServicios(resultado.data);
      } catch {
        if (!control.signal.aborted) setError(true);
      }
    }
    void cargar();
    return () => control.abort();
  }, [dentistId]);

  return (
    <section aria-labelledby="titulo-servicios-publicados">
      <h2 id="titulo-servicios-publicados">Servicios</h2>
      {error && <p role="status">Los servicios no están disponibles en este momento.</p>}
      {!error && servicios === null && <p role="status">Cargando servicios…</p>}
      {servicios?.length === 0 && <p>Este profesional todavía no tiene servicios publicados.</p>}
      {!!servicios?.length && (
        <ul>
          {servicios.map(servicio => (
            <li key={servicio.id}>
              <strong>{servicio.name}</strong>
              {servicio.description && <p>{servicio.description}</p>}
              {servicio.duration_minutes !== null && <p>Duración: {servicio.duration_minutes} min</p>}
              {servicio.price_amount !== null && <p>Tarifa publicada: {formatearPrecio(servicio.price_amount, servicio.currency_code)}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
