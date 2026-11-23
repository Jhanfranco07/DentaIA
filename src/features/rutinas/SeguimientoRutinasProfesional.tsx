"use client";

import { useCallback, useEffect, useState } from "react";
import { useSesion } from "@/features/cuenta/useSesion";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./seguimiento.module.css";

type Actividad = { id: string; titulo: string; momento: string };
type Plan = { id: string; titulo: string; actividades: Actividad[] };
type Solicitud = {
  consentimientoId: string;
  pacienteRegistroId: string;
  estado: "pendiente" | "aprobado";
  vence: string;
  propuestas: { id: string; estado: string; planId: string }[];
  progresoHoy?: { completadas: number; total: number } | null;
};
type Datos = { ok: true; tipo: "odontologo"; solicitudes: Solicitud[]; catalogo: Plan[] };
const habilitado = process.env.NEXT_PUBLIC_DENTAIA_SEGUIMIENTO_RUTINAS === "true";

async function tokenProfesional(): Promise<string> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error || !data.session?.access_token) throw new Error("SESION_NO_DISPONIBLE");
  return data.session.access_token;
}

function SeguimientoHabilitado({ membershipId, patientRecordId }: {
  membershipId: string; patientRecordId: string | null;
}) {
  const { usuario } = useSesion();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [planId, setPlanId] = useState("");
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const cargar = useCallback(async (signal?: AbortSignal) => {
    if (!usuario?.id || !membershipId) return;
    setCargando(true);
    try {
      const token = await tokenProfesional();
      const res = await fetch("/api/rutinas/seguimiento?membershipId=" + encodeURIComponent(membershipId), {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal,
      });
      if (!res.ok) throw new Error("CONSULTA_DENEGADA");
      const body: Datos = await res.json();
      if (!body.ok || body.tipo !== "odontologo") throw new Error("RESPUESTA_INVALIDA");
      if (!signal?.aborted) { setDatos(body); setError(""); }
    } catch {
      if (!signal?.aborted) { setDatos(null); setError("No se pudo consultar el seguimiento de este contexto clínico."); }
    } finally { if (!signal?.aborted) setCargando(false); }
  }, [usuario?.id, membershipId]);

  useEffect(() => {
    setDatos(null);
    setSeleccionadas([]);
    setPlanId("");
    if (!usuario?.id || !membershipId) { setCargando(false); return; }
    const controller = new AbortController();
    void cargar(controller.signal);
    return () => controller.abort();
  }, [usuario?.id, membershipId, cargar]);

  async function enviar(cuerpo: Record<string, unknown>) {
    if (guardando) return;
    setGuardando(true); setError("");
    try {
      const token = await tokenProfesional();
      const respuesta = await fetch("/api/rutinas/seguimiento", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(cuerpo),
      });
      if (!respuesta.ok) throw new Error("OPERACION_DENEGADA");
      setSeleccionadas([]);
      await cargar();
    } catch { setError("No se pudo guardar la solicitud o propuesta. Comprueba la autorización y vuelve a intentarlo."); }
    finally { setGuardando(false); }
  }

  const solicitud = datos?.solicitudes.find(item => item.pacienteRegistroId === patientRecordId);
  const catalogo = datos?.catalogo ?? [];
  const plan = catalogo.find(p => p.id === planId) ?? catalogo[0];
  const pendientes = solicitud?.propuestas.filter(p => p.estado === "propuesta") ?? [];
  return <section className={styles.seccion} aria-labelledby="seguimiento-profesional-titulo">
    <header className={styles.cabecera}>
      <div>
        <span className={styles.etiqueta}>SEGUIMIENTO PREVENTIVO AUTORIZADO</span>
        <h2 id="seguimiento-profesional-titulo">Proponer rutinas educativas</h2>
        <p>El paciente debe aceptar primero el seguimiento y después cada plan. No se generan tratamientos automáticamente.</p>
      </div>
      <button type="button" className={styles.botonSecundario} disabled={cargando || guardando} onClick={() => void cargar()}>Actualizar</button>
    </header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!patientRecordId ? <p className={styles.vacio}>Selecciona un paciente autorizado en el contexto clínico para gestionar una invitación.</p> :
      cargando ? <p role="status">Cargando seguimiento…</p> : !solicitud ? <>
        <p className={styles.nota}>Este paciente todavía no autorizó seguimiento de rutinas para esta membresía.</p>
        <div className={styles.acciones}>
          <button type="button" disabled={guardando} onClick={() => void enviar({
            accion: "invitar", membershipId, patientRecordId,
          })}>Invitar a seguimiento</button>
        </div>
      </> : <div className={styles.elemento}>
        <div>
          <strong>{solicitud.estado === "pendiente" ? "Autorización pendiente" : "Seguimiento autorizado"}</strong>
          <p>{solicitud.estado === "pendiente"
            ? "El paciente debe revisar y aprobar tu invitación antes de recibir propuestas."
            : "Puedes proponer actividades de un catálogo preventivo publicado."}</p>
          {solicitud.propuestas.length > 0 && <small>Propuestas registradas: {solicitud.propuestas.length}. Pendientes de respuesta: {pendientes.length}.</small>}
          {solicitud.progresoHoy && <p>Avance registrado hoy: {solicitud.progresoHoy.completadas} de {solicitud.progresoHoy.total} actividades.</p>}
        </div>
        {solicitud.estado === "aprobado" && <div className={styles.formularioPropuesta}>
          <label>Plan publicado
            <select value={plan?.id ?? ""} onChange={evento => { setPlanId(evento.target.value); setSeleccionadas([]); }}>
              {catalogo.map(item => <option value={item.id} key={item.id}>{item.titulo}</option>)}
            </select>
          </label>
          {plan && <fieldset><legend>Selecciona las actividades que deseas proponer</legend>
            {plan.actividades.map(actividad => <label key={actividad.id} className={styles.seleccionActividad}>
              <input type="checkbox" checked={seleccionadas.includes(actividad.id)} onChange={evento => setSeleccionadas(prev =>
                evento.target.checked ? [...prev, actividad.id] : prev.filter(id => id !== actividad.id))} />
              {actividad.titulo}
            </label>)}
          </fieldset>}
          <button type="button" disabled={guardando || !plan || seleccionadas.length === 0} onClick={() => void enviar({
            accion: "proponer_plan", consentId: solicitud.consentimientoId,
            planId: plan?.id, activityIds: seleccionadas,
          })}>Enviar propuesta para aprobación</button>
        </div>}
      </div>}
    <p className={styles.nota}>No puedes marcar actividades por el paciente ni consultar sus registros sin una autorización específica y vigente.</p>
  </section>;
}

export default function SeguimientoRutinasProfesional({
  membershipId, patientRecordId,
}: { membershipId: string; patientRecordId: string | null }) {
  if (!habilitado || !membershipId) return null;
  return <SeguimientoHabilitado membershipId={membershipId} patientRecordId={patientRecordId}/>;
}
