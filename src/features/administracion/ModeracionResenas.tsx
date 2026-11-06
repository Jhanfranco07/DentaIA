"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./administracion.module.css";

type Resena = { id: string; dentistId: string; dentistName: string; rating: number; comment: string; createdAt: string; status: string };
type Reporte = { id: string; reviewId: string; category: string; details: string; createdAt: string; status: string };
function lista<T>(value: unknown, key: string): T[] | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  return v.ok === true && Array.isArray(v[key]) ? v[key] as T[] : null;
}

export default function ModeracionResenas() {
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      if (!data.session?.access_token) throw new Error();
      const response = await fetch("/api/administracion/resenas", { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store", credentials: "same-origin" });
      const body = await response.json();
      const r = lista<Resena>(body, "resenas"), p = lista<Reporte>(body, "reportes");
      if (!response.ok || !r || !p) throw new Error();
      setResenas(r); setReportes(p);
    } catch { setError("No se pudo consultar la moderación protegida. Verifica tu sesión AAL2 y el servicio."); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  async function moderar(operacion: "resena" | "reporte", id: string, status: string) {
    if (ocupado) return;
    setOcupado(true); setError(""); setMensaje("");
    try {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      if (!data.session?.access_token) throw new Error();
      const response = await fetch("/api/administracion/resenas", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ operacion, ...(operacion === "resena" ? { reviewId: id } : { reportId: id }), status }) });
      const result = await response.json() as { ok?: boolean };
      if (!response.ok || result.ok !== true) throw new Error();
      setMensaje(operacion === "resena" ? "Estado de reseña actualizado y auditado." : "Reporte actualizado y auditado.");
      await cargar();
    } catch { setError("La moderación no se confirmó. Comprueba el estado antes de volver a intentarlo."); }
    finally { setOcupado(false); }
  }

  return <section className={styles.bloque} aria-labelledby="moderacion-resenas-titulo">
    <div className={styles.tituloBloque}><h2 id="moderacion-resenas-titulo">Reseñas y reportes</h2><span className={styles.indicador}>Solo datos enviados por pacientes</span></div>
    <p>Las reseñas se publican solo si tienen interacción real elegible; las solicitudes académicas no califican. Los reportes son privados y no se exponen en el directorio.</p>
    {cargando && <p role="status">Cargando reseñas y reportes…</p>}
    {error && <div role="alert" className={styles.errorAdmin}><p>{error}</p><button type="button" className={styles.accionEstado} onClick={() => void cargar()}>Reintentar</button></div>}
    {!cargando && !error && <>
      <h3>Reseñas recibidas</h3>
      {resenas.length === 0 ? <p role="status">No hay reseñas pendientes ni publicadas. No se generan calificaciones de ejemplo.</p> : <ul className={styles.pasos}>{resenas.map(r => <li key={r.id}><span>{r.rating}★</span><div><strong>{r.dentistName} · {r.status}</strong><p>{r.comment}</p><div className="actions">{r.status !== "published" && <button type="button" className={styles.accionEstado} disabled={ocupado} onClick={() => void moderar("resena", r.id, "published")}>Publicar</button>}{r.status !== "rejected" && <button type="button" className={styles.accionEstado} disabled={ocupado} onClick={() => void moderar("resena", r.id, "rejected")}>Rechazar</button>}{r.status === "published" && <button type="button" className={styles.accionEstado} disabled={ocupado} onClick={() => void moderar("resena", r.id, "hidden")}>Ocultar</button>}</div></div></li>)}</ul>}
      <h3>Reportes pendientes</h3>
      {reportes.length === 0 ? <p role="status">No hay reportes pendientes.</p> : <div className={styles.tablaUsuarios}><table><thead><tr><th>Reseña</th><th>Motivo</th><th>Detalle</th><th>Acción</th></tr></thead><tbody>{reportes.map(r => <tr key={r.id}><td><code>{r.reviewId}</code></td><td>{r.category}</td><td>{r.details || "Sin detalle"}</td><td><button type="button" className={styles.accionEstado} disabled={ocupado} onClick={() => void moderar("reporte", r.id, "reviewed")}>Revisado</button> <button type="button" className={styles.accionEstado} disabled={ocupado} onClick={() => void moderar("reporte", r.id, "dismissed")}>Descartar</button></td></tr>)}</tbody></table></div>}
    </>}
    {mensaje && <p className={styles.propuesta} role="status">{mensaje}</p>}
  </section>;
}
