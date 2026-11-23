"use client";

import { useEffect, useState } from "react";
import { useSesion } from "@/features/cuenta/useSesion";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./citas-reales.module.css";

type Cita = {
  id: string; preferred_date: string; preferred_time: string | null;
  status: string; dentists: { name: string } | null;
};
const estados: Record<string, string> = {
  requested: "Pendiente de confirmación", confirmed: "Confirmada",
  completed: "Atención completada", declined: "Rechazada", cancelled: "Cancelada",
};
export default function MisCitasRealesPaciente() {
  const { usuario } = useSesion();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [cargando,setCargando] = useState(true);
  const [error,setError] = useState("");
  const [revision,setRevision] = useState(0);
  const [cancelando,setCancelando] = useState<string | null>(null);

  useEffect(()=>{
    let vivo=true;
    setCitas([]);setCargando(true);setError("");
    if(!usuario?.id){setCargando(false);return;}
    const userId=usuario.id;
    void (async()=>{
      try {
        const { data,error }=await getSupabaseBrowserClient()
          .from("appointment_requests")
          .select("id,preferred_date,preferred_time,status,dentists(name)")
          .eq("user_id",userId).eq("is_demo",false)
          .order("created_at",{ascending:false}).limit(60);
        if (!vivo) return;
        if(error) throw error;
        setCitas(data??[]);
      } catch {if(vivo)setError("No pudimos consultar tus citas reales.");}
      finally{if(vivo)setCargando(false);}
    })();
    return()=>{vivo=false;};
  },[usuario?.id,revision]);
  async function cancelar(id:string){
    if(cancelando)return;
    if(!window.confirm("¿Deseas cancelar esta solicitud o cita?"))return;
    setCancelando(id);setError("");
    const {data,error}=await getSupabaseBrowserClient().rpc("cancelar_cita_paciente",{p_solicitud_id:id});
    if(error||!data)setError("No se pudo cancelar. Actualiza el estado y vuelve a intentar.");
    else setRevision(v=>v+1);
    setCancelando(null);
  }
  return <section className={styles.panel} aria-labelledby="citas-reales-titulo">
    <header><div><span className={styles.etiqueta}>AGENDA REAL</span>
      <h2 id="citas-reales-titulo">Mis citas odontológicas</h2>
      <p>Consulta el estado de las solicitudes a profesionales reales. Una solicitud no equivale a una cita confirmada.</p></div>
      <button type="button" disabled={cargando||!!cancelando} onClick={()=>setRevision(v=>v+1)}>Actualizar</button>
    </header>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {cargando?<p role="status">Consultando citas…</p>:
      !citas.length?<p className={styles.vacio}>Aún no tienes citas solicitadas a profesionales reales.</p>:
      <div className={styles.lista}>{citas.map(cita=><article className={styles.cita} key={cita.id}>
        <div><span className={styles.estado} data-estado={cita.status}>{estados[cita.status]??cita.status}</span>
          <h3>{cita.dentists?.name??"Profesional odontológico"}</h3>
          <p>Fecha solicitada: {cita.preferred_date}{cita.preferred_time?" · "+cita.preferred_time.slice(0,5):""}</p>
          {cita.status==="completed"&&<p>Ya puedes valorar esta atención desde la ficha del odontólogo.</p>}
        </div>
        {(cita.status==="requested"||cita.status==="confirmed")&&<button type="button"
          disabled={!!cancelando} onClick={()=>void cancelar(cita.id)}>{cancelando===cita.id?"Cancelando…":"Cancelar cita"}</button>}
      </article>)}</div>}
  </section>;
}
