"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./administracion.module.css";

type Profesional = { professionalId: string; dentistId: string; dentistName: string; specialty: string; clinicId: string | null; clinicName: string | null; membershipId: string | null; membershipStatus: string | null; validUntil: string | null };
type Clinica = { id: string; name: string; location: string | null };
type Listado = { profesionales: Profesional[]; clinicas: Clinica[] };

function leerListado(value: unknown): Listado | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.ok !== true || !Array.isArray(v.profesionales) || !Array.isArray(v.clinicas)) return null;
  return { profesionales: v.profesionales as Profesional[], clinicas: v.clinicas as Clinica[] };
}

export default function GestorVinculaciones() {
  const [listado, setListado] = useState<Listado>({ profesionales: [], clinicas: [] });
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [profesionalId, setProfesionalId] = useState("");
  const [clinicaId, setClinicaId] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    setEstado("cargando"); setError("");
    try {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error();
      const response = await fetch("/api/administracion/vinculaciones", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", credentials: "same-origin" });
      const body: unknown = await response.json();
      const result = leerListado(body);
      if (!response.ok || !result) throw new Error();
      setListado(result); setEstado("listo");
      if (!profesionalId && result.profesionales[0]) setProfesionalId(result.profesionales[0].professionalId);
      if (!clinicaId && result.clinicas[0]) setClinicaId(result.clinicas[0].id);
    } catch { setEstado("error"); setError("No se pudo cargar la lista protegida. Comprueba tu sesión AAL2 y la disponibilidad del servicio."); }
  }, [profesionalId, clinicaId]);

  useEffect(() => { void cargar(); }, [cargar]);

  const membresias = useMemo(() => listado.profesionales.filter(p => p.professionalId === profesionalId && p.membershipId), [listado, profesionalId]);
  const vinculada = membresias.some(m => m.clinicId === clinicaId && m.membershipStatus === "active");

  async function ejecutar(operacion: "vincular" | "revocar", item?: Profesional) {
    const clinic = operacion === "vincular" ? clinicaId : item?.clinicId;
    const membership = item?.membershipId;
    if (!profesionalId || !clinic || (operacion === "revocar" && !membership) || ocupado) return;
    if (operacion === "revocar" && !window.confirm("¿Revocar esta membresía? Las sedes públicas de esa clínica se ocultarán automáticamente.")) return;
    setOcupado(true); setError(""); setMensaje("");
    try {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      if (!data.session?.access_token) throw new Error();
      const response = await fetch("/api/administracion/vinculaciones", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ operacion, professionalId: profesionalId, clinicId: clinic, ...(operacion === "revocar" ? { membershipId: membership } : {}) }) });
      const body = await response.json() as { ok?: boolean; codigo?: string };
      if (!response.ok || body.ok !== true) throw new Error(body.codigo ?? "OPERACION_NO_CONFIRMADA");
      setMensaje(body.codigo === "MEMBRESIA_YA_VIGENTE" ? "La membresía ya estaba vigente." : body.codigo === "MEMBRESIA_VINCULADA" ? "La vinculación quedó registrada y auditada." : "La membresía fue revocada; las sedes asociadas quedaron ocultas.");
      await cargar();
    } catch (e) { setError(e instanceof Error && e.message === "ESCRITURAS_DESACTIVADAS" ? "Las escrituras administrativas están desactivadas para este entorno." : "La operación no se confirmó. No repitas hasta comprobar el estado."); }
    finally { setOcupado(false); }
  }

  return <section className={styles.bloque} aria-labelledby="vinculaciones-titulo">
    <div className={styles.tituloBloque}><h2 id="vinculaciones-titulo">Vincular odontólogos con clínicas</h2><span className={styles.indicador}>Verificación en servidor · AAL2</span></div>
    <p>La lista incluye solo cuentas autenticadas con rol odontólogo activo, verificación profesional aprobada, perfil público activo y no ficticio. Cada vínculo queda auditado.</p>
    {estado === "cargando" && <p role="status">Consultando profesionales y clínicas verificadas…</p>}
    {estado === "error" && <div role="alert" className={styles.errorAdmin}><p>{error}</p><button type="button" className={styles.accionEstado} onClick={() => void cargar()}>Reintentar</button></div>}
    {estado === "listo" && <>
      {listado.profesionales.length === 0 && <p role="status">No hay perfiles profesionales verificados y elegibles para vincular. No se crearán asociaciones por aproximación.</p>}
      {listado.clinicas.length === 0 && <p role="status">No hay clínicas activas disponibles.</p>}
      {listado.profesionales.length > 0 && listado.clinicas.length > 0 && <div className={styles.formularioAdmin}>
        <label>Profesional<select value={profesionalId} onChange={e => setProfesionalId(e.target.value)}>{listado.profesionales.map(p => <option key={p.professionalId} value={p.professionalId}>{p.dentistName} · {p.specialty}</option>)}</select></label>
        <label>Clínica<select value={clinicaId} onChange={e => setClinicaId(e.target.value)}>{listado.clinicas.map(c => <option key={c.id} value={c.id}>{c.name}{c.location ? ` · ${c.location}` : ""}</option>)}</select></label>
        <button type="button" className={styles.accionEstado} disabled={ocupado || vinculada} onClick={() => void ejecutar("vincular")}>{ocupado ? "Procesando…" : vinculada ? "Vínculo vigente" : "Vincular profesional"}</button>
      </div>}
      <h3>Membresías del profesional seleccionado</h3>
      {membresias.length === 0 ? <p role="status">No hay membresías vigentes o históricas visibles para este profesional.</p> : <div className={styles.tablaUsuarios}><table><thead><tr><th>Clínica</th><th>Estado</th><th>Vigencia</th><th>Acción</th></tr></thead><tbody>{membresias.map(m => <tr key={m.membershipId}><td>{m.clinicName ?? "Clínica"}</td><td>{m.membershipStatus}</td><td>{m.validUntil ? new Date(m.validUntil).toLocaleDateString("es-PE") : "Sin fecha de término"}</td><td>{m.membershipStatus === "active" && <button type="button" className={styles.accionEstado} disabled={ocupado} onClick={() => void ejecutar("revocar", m)}>Revocar</button>}</td></tr>)}</tbody></table></div>}
    </>}
    {error && estado !== "error" && <p className={styles.errorAdmin} role="alert">{error}</p>}{mensaje && <p className={styles.propuesta} role="status">{mensaje}</p>}
  </section>;
}
