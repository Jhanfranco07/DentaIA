"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSesion } from "@/features/cuenta/useSesion";
import { esInteraccionElegible, fechaResena, ordenarResenas, resumirResenas, type CriterioResena, type ResenaPublica } from "./resenas";
import styles from "./resenas.module.css";

type SolicitudElegible = { id: string; dentist_id: string; is_demo: boolean; status: string };
type Reporte = { id: string; motivo: string; detalle: string };

export default function ResenasOdontologo({ dentistId }: { dentistId: string }) {
  const { usuario, cargando } = useSesion();
  const [resenas, setResenas] = useState<ResenaPublica[]>([]);
  const [estado, setEstado] = useState<"cargando" | "listo" | "no-configurado">("cargando");
  const [criterio, setCriterio] = useState<CriterioResena>("recientes");
  const [elegibles, setElegibles] = useState<SolicitudElegible[]>([]);
  const [motivoResena, setMotivoResena] = useState("");
  const [comentario, setComentario] = useState("");
  const [rating, setRating] = useState(0);
  const [solicitudResena, setSolicitudResena] = useState("");
  const [ocupada, setOcupada] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [reporteEnviado, setReporteEnviado] = useState("");

  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const { data, error } = await getSupabaseBrowserClient().from("dentist_reviews")
          .select("id,dentist_id,rating,comment,created_at").eq("dentist_id", dentistId).order("created_at", { ascending: false });
        if (!activo) return;
        if (error) setEstado("no-configurado");
        else { setResenas((data ?? []) as ResenaPublica[]); setEstado("listo"); }
      } catch { if (activo) setEstado("no-configurado"); }
    }
    void cargar();
    return () => { activo = false; };
  }, [dentistId]);

  useEffect(() => {
    let activo = true;
    async function cargarElegibles() {
      setElegibles([]);
      if (!usuario) return;
      try {
        const { data, error } = await getSupabaseBrowserClient().from("appointment_requests")
          .select("id,dentist_id,is_demo,status").eq("user_id", usuario.id).eq("dentist_id", dentistId)
          .eq("is_demo", false).eq("status", "completed");
        if (activo && !error) setElegibles((data ?? []).filter(esInteraccionElegible));
      } catch { /* Sin fuente verificable no se habilita la reseña. */ }
    }
    void cargarElegibles();
    return () => { activo = false; };
  }, [dentistId, usuario]);

  const visibles = useMemo(() => ordenarResenas(resenas, criterio), [resenas, criterio]);
  const resumen = useMemo(() => resumirResenas(resenas), [resenas]);
  const mostrarDistribucion = resumen.total >= 5;

  async function enviarResena(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(""); setMensaje("");
    if (!usuario || !elegibles.some(e => e.id === solicitudResena && e.dentist_id === dentistId && esInteraccionElegible(e))) {
      setError("No encontramos una interacción completada y elegible para este perfil."); return;
    }
    if (rating < 1 || rating > 5 || comentario.trim().length < 10 || comentario.trim().length > 1200) {
      setError("Elige de una a cinco estrellas y escribe entre 10 y 1200 caracteres."); return;
    }
    setOcupada(true);
    try {
      const { error } = await getSupabaseBrowserClient().from("dentist_reviews").insert({
        dentist_id: dentistId, appointment_request_id: solicitudResena, rating, comment: comentario.trim(),
      });
      if (error) throw error;
      setMensaje("La reseña se recibió para revisión. Solo será pública tras su moderación.");
      setComentario(""); setRating(0); setSolicitudResena("");
    } catch {
      setError("No se pudo enviar la reseña. Comprueba si la migración está habilitada y si la interacción sigue siendo elegible.");
    } finally { setOcupada(false); }
  }

  async function enviarReporte(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!reporte || !usuario || ocupada) return;
    setError(""); setReporteEnviado(""); setOcupada(true);
    try {
      const { error } = await getSupabaseBrowserClient().from("dentist_review_reports").insert({
        review_id: reporte.id, category: reporte.motivo, details: reporte.detalle.trim(),
      });
      if (error) throw error;
      setReporteEnviado("El reporte fue enviado para revisión."); setReporte(null);
    } catch {
      setError("No se pudo enviar el reporte. El servicio puede no estar habilitado en este entorno.");
    } finally { setOcupada(false); }
  }

  return <section className={styles.seccion} aria-labelledby="titulo-resenas">
    <header className={styles.cabecera}><div><span className={styles.etiqueta}>Opiniones verificables</span><h2 id="titulo-resenas">Calificaciones y reseñas</h2><p>Solo se publican opiniones moderadas asociadas a una atención elegible. No mostramos datos privados de quienes opinan.</p></div>
      {resumen.promedio === null ? <span className={styles.sinPromedio}>Sin reseñas publicadas</span> : <div className={styles.promedio} aria-label={`${resumen.promedio.toFixed(1)} de 5, ${resumen.total} reseñas`}><strong>{resumen.promedio.toFixed(1)}</strong><span aria-hidden="true">★</span><small>{resumen.total} {resumen.total === 1 ? "reseña" : "reseñas"}</small></div>}
    </header>
    {mostrarDistribucion && <div className={styles.distribucion} aria-label="Distribución de calificaciones">{resumen.distribucion.map((cantidad, indice) => <span key={indice}>{indice + 1} ★ <i><b style={{ width: `${cantidad / resumen.total * 100}%` }} /></i> {cantidad}</span>)}</div>}
    {estado === "cargando" && <p role="status">Cargando reseñas…</p>}
    {estado === "no-configurado" && <p className={styles.aviso} role="status">El servicio de reseñas no está configurado en esta versión. No se muestran calificaciones simuladas.</p>}
    {estado === "listo" && resenas.length === 0 && <p className={styles.vacio}>Aún no hay reseñas verificadas y publicadas.</p>}
    {estado === "listo" && resenas.length > 0 && <>
      <label className={styles.orden}>Ordenar <select value={criterio} onChange={e => setCriterio(e.target.value as CriterioResena)}><option value="recientes">Más recientes</option><option value="mejor-calificadas">Mejor calificadas</option></select></label>
      <ul className={styles.lista}>{visibles.map(resena => <li key={resena.id} className={styles.resena}><div className={styles.resenaMeta}><strong>Paciente verificado</strong><time dateTime={resena.created_at}>{fechaResena(resena.created_at)}</time><span aria-label={`${resena.rating} de 5 estrellas`}>{"★".repeat(resena.rating)}{"☆".repeat(5 - resena.rating)}</span></div><p>{resena.comment}</p>
        {usuario ? reporte?.id === resena.id ? <form className={styles.formReporte} onSubmit={enviarReporte}><label>Motivo<select required value={reporte.motivo} onChange={e => setReporte({ ...reporte, motivo: e.target.value })}><option value="">Selecciona un motivo</option><option value="inapropiado">Contenido inapropiado</option><option value="spam">Spam</option><option value="suplantacion">Suplantación</option><option value="otro">Otro</option></select></label><label>Detalle (opcional)<textarea maxLength={500} value={reporte.detalle} onChange={e => setReporte({ ...reporte, detalle: e.target.value })} /></label><button disabled={ocupada || !reporte.motivo}>Enviar reporte</button><button type="button" onClick={() => setReporte(null)}>Cancelar</button></form> : <button type="button" className={styles.botonReporte} onClick={() => setReporte({ id: resena.id, motivo: "", detalle: "" })}>Reportar contenido</button> : <Link href="/cuenta">Inicia sesión para reportar</Link>}
      </li>)}</ul>
    </>}
    {reporteEnviado && <p role="status" className={styles.exito}>{reporteEnviado}</p>}
    {cargando ? null : usuario ? elegibles.length ? <form className={styles.formResena} onSubmit={enviarResena}>
      <h3>Compartir una reseña</h3><p>Solo puedes valorar una atención real completada; una solicitud o una interacción de demostración no son suficientes.</p>
      <label>Atención elegible<select required value={solicitudResena} onChange={e => setSolicitudResena(e.target.value)}><option value="">Elige una atención</option>{elegibles.map((item, index) => <option key={item.id} value={item.id}>Atención completada {index + 1}</option>)}</select></label>
      <fieldset><legend>Calificación</legend><div className={styles.estrellas}>{[1,2,3,4,5].map(value => <label key={value}><input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} /><span aria-hidden="true">{value <= rating ? "★" : "☆"}</span><span className="sr-only">{value} {value === 1 ? "estrella" : "estrellas"}</span></label>)}</div></fieldset>
      <label>Comentario<textarea required minLength={10} maxLength={1200} value={comentario} onChange={e => setComentario(e.target.value)} /></label><small>{comentario.length}/1200 · No incluyas información clínica sensible.</small>
      <button type="submit" disabled={ocupada || !solicitudResena || !rating}>{ocupada ? "Enviando…" : "Enviar para moderación"}</button>
    </form> : usuario && <p className={styles.aviso}>Todavía no tienes una atención real completada y verificable para este profesional. Las solicitudes de demostración no permiten publicar reseñas.</p> : !usuario && <p className={styles.aviso}>Inicia sesión para enviar una reseña cuando tengas una atención real completada y verificable.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}{mensaje && <p className={styles.exito} role="status">{mensaje}</p>}
  </section>;
}
