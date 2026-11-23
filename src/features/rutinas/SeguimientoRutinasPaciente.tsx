"use client";

import { useCallback, useEffect, useState } from "react";
import { useSesion } from "@/features/cuenta/useSesion";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./seguimiento.module.css";

type Invitacion = {
  id: string;
  estado: "pendiente" | "aprobado" | "rechazado" | "revocado" | "expirado";
  vence: string;
  profesional: string;
};
type Actividad = { id: string; titulo: string; momento: string };
type Propuesta = {
  id: string;
  consentimientoId: string;
  estado: "propuesta" | "aceptada" | "rechazada" | "revocada";
  planTitulo: string;
  creado: string;
  actividades: Actividad[];
};
type Resumen = {
  ok: true;
  tipo: "paciente";
  consentimientos: Invitacion[];
  propuestas: Propuesta[];
  planActivo: { planId: string; propuestaId: string } | null;
};
const habilitado = process.env.NEXT_PUBLIC_DENTAIA_SEGUIMIENTO_RUTINAS === "true";

async function tokenPaciente(): Promise<string> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Tu sesión no está disponible.");
  return data.session.access_token;
}

function SeguimientoHabilitado() {
  const { usuario } = useSesion();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const cargar = useCallback(async (signal?: AbortSignal) => {
    if (!usuario?.id) return;
    setCargando(true);
    try {
      const token = await tokenPaciente();
      const res = await fetch("/api/rutinas/seguimiento", {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal,
      });
      if (!res.ok) throw new Error("No se pudieron consultar tus solicitudes.");
      const data: Resumen = await res.json();
      if (data.tipo !== "paciente" || data.ok !== true) throw new Error("Respuesta no válida.");
      if (!signal?.aborted) { setResumen(data); setError(""); }
    } catch {
      if (!signal?.aborted) { setResumen(null); setError("No pudimos consultar tus propuestas de seguimiento."); }
    } finally { if (!signal?.aborted) setCargando(false); }
  }, [usuario?.id]);
  useEffect(() => {
    setResumen(null);
    if (!usuario?.id) { setCargando(false); return; }
    const controlador = new AbortController();
    void cargar(controlador.signal);
    return () => controlador.abort();
  }, [usuario?.id, cargar]);

  async function actuar(accion: string, identificador: "consentId" | "proposalId", id: string) {
    if (guardando) return;
    setGuardando(id); setError("");
    try {
      const token = await tokenPaciente();
      const res = await fetch("/api/rutinas/seguimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accion, [identificador]: id }), cache: "no-store",
      });
      if (!res.ok) throw new Error("No se pudo registrar la decisión.");
      await cargar();
      window.dispatchEvent(new Event("dentaia:rutina-actualizada"));
    } catch { setError("No se pudo guardar tu decisión. Nada ha cambiado; inténtalo nuevamente."); }
    finally { setGuardando(null); }
  }
  const invitaciones = resumen?.consentimientos ?? [];
  const propuestas = resumen?.propuestas ?? [];
  return <section className={styles.seccion} aria-labelledby="seguimiento-rutinas-titulo">
    <header className={styles.cabecera}>
      <div>
        <span className={styles.etiqueta}>CONTROL DEL PACIENTE</span>
        <h2 id="seguimiento-rutinas-titulo">Planes propuestos por tu odontólogo</h2>
        <p>Tú decides si autorizas el seguimiento y si aceptas cada propuesta. Tus rutinas no cambian automáticamente.</p>
      </div>
      <button type="button" className={styles.botonSecundario} onClick={() => void cargar()} disabled={cargando || !!guardando}>Actualizar</button>
    </header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {cargando ? <p role="status">Consultando tus solicitudes…</p> : !invitaciones.length && !propuestas.length ?
      <p className={styles.vacio}>No tienes solicitudes de seguimiento odontológico. Tu rutina preventiva general continúa disponible.</p> : <>
        {invitaciones.map(invitacion => <article className={styles.elemento} key={invitacion.id}>
          <div><strong>{invitacion.profesional}</strong>
            <p>Solicitud de seguimiento de hábitos · {invitacion.estado === "pendiente" ? "Esperando tu autorización" : invitacion.estado}</p>
            <small>Vigencia hasta: {new Date(invitacion.vence).toLocaleDateString("es-PE")}</small>
          </div>
          {invitacion.estado === "pendiente" && <div className={styles.acciones}>
            <button disabled={!!guardando} type="button" onClick={() => void actuar("aprobar_seguimiento", "consentId", invitacion.id)}>Autorizar seguimiento</button>
            <button disabled={!!guardando} className={styles.botonSecundario} type="button" onClick={() => void actuar("rechazar_seguimiento", "consentId", invitacion.id)}>Rechazar</button>
          </div>}
          {invitacion.estado === "aprobado" && <button type="button" disabled={!!guardando}
            className={styles.botonSecundario} onClick={() => void actuar("revocar_seguimiento", "consentId", invitacion.id)}>Revocar autorización</button>}
        </article>)}
        {propuestas.map(propuesta => <article className={styles.elemento} key={propuesta.id}>
          <div><span className={styles.etiqueta}>PLAN EDUCATIVO · {propuesta.estado.toUpperCase()}</span>
            <h3>{propuesta.planTitulo}</h3>
            <p>Actividades seleccionadas de un catálogo preventivo validado:</p>
            <ul>{propuesta.actividades.map(actividad => <li key={actividad.id}>{actividad.titulo}</li>)}</ul>
            {propuesta.estado === "aceptada" && <small>Este plan fue aceptado por ti. Puedes retirarlo cuando quieras.</small>}
          </div>
          {propuesta.estado === "propuesta" && <div className={styles.acciones}>
            <button disabled={!!guardando} type="button" onClick={() => void actuar("aceptar_plan", "proposalId", propuesta.id)}>Aceptar actividades</button>
            <button disabled={!!guardando} type="button" className={styles.botonSecundario} onClick={() => void actuar("rechazar_plan", "proposalId", propuesta.id)}>Rechazar</button>
          </div>}
          {propuesta.estado === "aceptada" && <button type="button" disabled={!!guardando}
            className={styles.botonSecundario} onClick={() => void actuar("revocar_plan", "proposalId", propuesta.id)}>Retirar este plan</button>}
        </article>)}
      </>}
    <p className={styles.nota}>Las actividades son educativas. Ninguna fotografía genera un tratamiento ni activa un plan sin tu aceptación.</p>
  </section>;
}

export default function SeguimientoRutinasPaciente() {
  return habilitado ? <SeguimientoHabilitado /> : null;
}
