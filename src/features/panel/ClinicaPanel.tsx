"use client";
import { useEffect, useState } from "react";
import { useSesion } from "@/features/cuenta/useSesion";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { leerClinicaPropia, ErrorClinicaPanel, type ClinicaPropia } from "./clinica";
import EstadoPanel from "./EstadoPanel";
import styles from "./panel.module.css";

type Estado = { id: string; datos: ClinicaPropia } | { id: string; error: number } | null;
// Temporal: exclusivamente QA DI-213 en la rama de integración; no trasladar a main.
const QA_PATIENT = "798b53d9-9bfb-483b-8f6e-6d28403a1925";
const QA_ENCOUNTER = "1a710e35-c54d-4728-815e-4d811d083b59";
const QA_MEMBERSHIP = "6d610039-c626-43d4-9633-88a8c9366f17";
const ESTADOS = { vigente: "Vigente", vencido: "Expirada", revocado: "Revocada" };
export default function ClinicaPanel() {
  const { usuario, cargando, errorSesion } = useSesion(), id = usuario?.id ?? null;
  const [estado, setEstado] = useState<Estado>(null), [intento, setIntento] = useState(0);
  const [aceptado, setAceptado] = useState(false), [enviando, setEnviando] = useState(false), [mensaje, setMensaje] = useState("");
  const [solicitud, setSolicitud] = useState<{ id: string; expiresAt: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); let vigente = true;
    setEstado(null);
    if (id) void (async () => {
      try {
        const { data, error } = await getSupabaseBrowserClient().auth.getSession();
        if (error || data.session?.user.id !== id) throw new ErrorClinicaPanel(401);
        const datos = await leerClinicaPropia(data.session.access_token, fetch, controller.signal);
        if (vigente) setEstado({ id, datos });
      } catch (e) { if (vigente) setEstado({ id, error: e instanceof ErrorClinicaPanel ? e.status : 503 }); }
    })();
    return () => { vigente = false; controller.abort(); };
  }, [id, intento]);
  if (cargando) return <EstadoPanel tipo="cargando" titulo="Comprobando acceso clínico…" />;
  if (!id || errorSesion) return null;
  if (!estado || estado.id !== id) return <EstadoPanel tipo="cargando" titulo="Consultando autorizaciones e historial propios…" />;
  if ("error" in estado) return <EstadoPanel tipo="error" titulo="Lectura clínica no disponible." accion={<button type="button" className={styles.boton} onClick={() => setIntento(n => n + 1)}>Reintentar lectura clínica</button>}>
    {estado.error === 401 ? "La sesión debe verificarse de nuevo en Mi cuenta." : estado.error === 403 ? "Tu sesión no tiene permiso para esta lectura." : estado.error === 404 || estado.error === 503 ? "El servicio está cerrado o no disponible en este entorno. No se muestran datos simulados." : "No se pudo comprobar la respuesta del servicio."}
  </EstadoPanel>;
  const marker = usuario?.app_metadata?.dentaia_development;
  const qaPermitida = id === QA_PATIENT && marker?.dataset === "fase8-synthetic-v1" && estado.datos.atenciones.some(a => a.id === QA_ENCOUNTER);
  async function concederQa() {
    if (!qaPermitida || !aceptado || enviando) return;
    setEnviando(true); setMensaje("");
    const intentoActual = solicitud ?? { id: crypto.randomUUID(), expiresAt: new Date(Date.now() + 23 * 3600000).toISOString() };
    setSolicitud(intentoActual);
    try {
      const { data, error } = await getSupabaseBrowserClient().auth.getSession();
      if (error || !data.session || data.session.user.id !== QA_PATIENT) throw new Error("Sesión de prueba no válida");
      const response = await fetch("/api/clinical/access-grants", {
        method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { Authorization: "Bearer " + data.session.access_token, "Content-Type": "application/json", "Idempotency-Key": intentoActual.id },
        body: JSON.stringify({ membershipId: QA_MEMBERSHIP, encounterIds: [QA_ENCOUNTER], expiresAt: intentoActual.expiresAt, policyVersion: "QA-NO-CLINICO-v1", accepted: true }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        setMensaje("No se pudo conceder acceso (HTTP " + response.status + "). Verifica los permisos de QA.");
        if (response.status >= 400 && response.status < 500) setSolicitud(null);
        return;
      }
      setMensaje("Concesión clínica registrada. Odontólogo Demo A autorizado durante 23 horas.");
      setSolicitud(null); setAceptado(false); setIntento(n => n + 1);
    } catch {
      setMensaje("No se pudo confirmar la concesión. Puedes reintentar con la misma solicitud.");
    } finally { setEnviando(false); }
  }
  return <section className={styles.resumen} aria-labelledby="clinica-propia-titulo">
    <h2 id="clinica-propia-titulo">Autorizaciones e historial de prueba</h2>
    <p>Datos sintéticos leídos de Supabase con permisos reales. No son el reporte preventivo de demostración ni el historial de solicitudes.</p>
    <h3>Autorizaciones clínicas</h3>
    {estado.datos.autorizaciones.length ? <ul>{estado.datos.autorizaciones.map(a => <li key={a.id}>{ESTADOS[a.estado]} · vence <time dateTime={a.vence}>{new Date(a.vence).toLocaleDateString("es-PE")}</time></li>)}</ul> : <p>No tienes autorizaciones registradas.</p>}
    {qaPermitida && <fieldset>
      <legend>Autorización sintética temporal — QA DI-213</legend>
      <p>Odontólogo Demo A · Clínica Demo A · encuentro del 31/10/2026 · vigencia de 23 horas. Solo datos ficticios.</p>
      <label><input type="checkbox" checked={aceptado} disabled={enviando} onChange={e => setAceptado(e.target.checked)} /> Autorizo el acceso de prueba a este encuentro.</label>
      <p><button type="button" className={styles.boton} disabled={!aceptado || enviando} onClick={() => void concederQa()}>{enviando ? "Registrando…" : "Conceder acceso a Demo A"}</button></p>
      <p role="status">{mensaje}</p>
    </fieldset>}
    <h3>Atenciones propias</h3>
    {estado.datos.atenciones.length ? <ul>{estado.datos.atenciones.map(a => <li key={a.id}>{a.clinica} · <time dateTime={a.fecha}>{new Date(a.fecha).toLocaleDateString("es-PE")}</time></li>)}</ul> : <p>No hay atenciones registradas.</p>}
    {estado.datos.hayMas && <p>Se muestran hasta 50 elementos por sección; existen más registros.</p>}
  </section>;
}
