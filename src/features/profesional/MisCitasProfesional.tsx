"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./citas-profesional.module.css";

type Cita = {
  id: string; contact_name: string; contact_email: string;
  preferred_date: string; preferred_time: string | null;
  status: string; message: string;
};
const etiquetas: Record<string,string> = {
  requested: "Pendiente", confirmed: "Confirmada", completed: "Atendida",
  declined: "Rechazada", cancelled: "Cancelada",
};
export default function MisCitasProfesional({ dentistId }: { dentistId: string }) {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [cargando, setCargando] = useState(true);
  const [operando, setOperando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargando(true); setError(""); setCitas([]);
    void (async () => {
      try {
        const { data, error } = await getSupabaseBrowserClient().from("appointment_requests")
          .select("id,contact_name,contact_email,preferred_date,preferred_time,status,message")
          .eq("dentist_id",dentistId).eq("is_demo",false)
          .order("preferred_date",{ascending:false}).limit(60);
        if (!activo) return;
        if (error) throw error;
        setCitas(data ?? []);
      } catch { if (activo) setError("No se pudo consultar las solicitudes reales de este consultorio."); }
      finally { if (activo) setCargando(false); }
    })();
    return () => { activo = false; };
  },[dentistId,revision]);

  async function gestionar(id: string, accion: "confirmar"|"rechazar"|"completar"|"cancelar") {
    if (operando) return;
    setOperando(id);setError("");
    try {
      const { data,error } = await getSupabaseBrowserClient().rpc("gestionar_cita_profesional",{
        p_solicitud_id:id,p_accion:accion,
      });
      if (error || !data || typeof data !== "object" || !("ok" in data) || data.ok !== true)
        throw new Error("ERROR");
      setRevision(v=>v+1);
    } catch { setError("No se pudo actualizar la cita. Comprueba la fecha y el estado antes de reintentar."); }
    finally { setOperando(null); }
  }

  return <section className={styles.panel} aria-labelledby="mis-citas-reales">
    <header className={styles.cabecera}>
      <div><span className={styles.etiqueta}>AGENDA PROFESIONAL</span>
        <h2 id="mis-citas-reales">Solicitudes de citas reales</h2>
        <p>Confirma o rechaza solicitudes. Una atención solo se marca completada cuando corresponda.</p></div>
      <button type="button" onClick={()=>setRevision(v=>v+1)} disabled={cargando||!!operando}>Actualizar</button>
    </header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {cargando ? <p role="status">Consultando citas…</p> :
      !citas.length ? <p className={styles.vacio}>Todavía no recibiste solicitudes de citas reales.</p> :
      <div className={styles.lista}>{citas.map(cita=><article key={cita.id} className={styles.cita}>
        <div className={styles.info}><span className={styles.estado} data-estado={cita.status}>{etiquetas[cita.status]??cita.status}</span>
          <h3>{cita.contact_name}</h3>
          <p><strong>Fecha solicitada:</strong> {cita.preferred_date}{cita.preferred_time ? " · "+cita.preferred_time.slice(0,5):""}</p>
          <p><strong>Contacto registrado:</strong> {cita.contact_email}</p>
          {cita.message && <p className={styles.mensaje}>Nota: {cita.message}</p>}</div>
        <div className={styles.acciones}>
          {cita.status==="requested" && <>
            <button disabled={!!operando} onClick={()=>void gestionar(cita.id,"confirmar")}>Confirmar</button>
            <button className={styles.secundario} disabled={!!operando} onClick={()=>void gestionar(cita.id,"rechazar")}>Rechazar</button>
          </>}
          {cita.status==="confirmed" && <>
            <button disabled={!!operando||cita.preferred_date>new Date().toLocaleDateString("en-CA",{timeZone:"America/Lima"})}
              onClick={()=>void gestionar(cita.id,"completar")}>Marcar atendida</button>
            <button className={styles.secundario} disabled={!!operando} onClick={()=>void gestionar(cita.id,"cancelar")}>Cancelar</button>
          </>}
        </div>
      </article>)}</div>}
    <p className={styles.nota}>La atención completada permite al paciente dejar una reseña moderada. Nunca marques una consulta como atendida antes de realizarla.</p>
  </section>;
}
