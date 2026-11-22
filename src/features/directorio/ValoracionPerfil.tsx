"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { resumirResenas } from "./resenas";
import styles from "./valoracion.module.css";

export default function ValoracionPerfil({ dentistId }: { dentistId: string }) {
  const [estado, setEstado] = useState<{promedio:number|null,total:number}|null>(null);
  useEffect(()=>{
    let vivo=true;setEstado(null);
    void (async()=>{
      const {data,error}=await getSupabaseBrowserClient()
        .from("dentist_reviews").select("rating").eq("dentist_id",dentistId);
      if(vivo && !error){
        const resumen=resumirResenas(data??[]);
        setEstado({promedio:resumen.promedio,total:resumen.total});
      }
    })();
    return()=>{vivo=false;};
  },[dentistId]);
  if(!estado)return null;
  return <div className={styles.insignia} aria-label={estado.promedio===null
      ? "Sin calificaciones publicadas" : `${estado.promedio.toFixed(1)} de 5 en ${estado.total} opiniones publicadas`}>
    <span className={styles.estrella} aria-hidden="true">★</span>
    <strong>{estado.promedio===null?"Sin calificaciones":estado.promedio.toFixed(1)+"/5"}</strong>
    <span>{estado.total===0?"Sé el primero después de una atención real":`${estado.total} ${estado.total===1?"reseña verificada":"reseñas verificadas"}`}</span>
    <a href="#titulo-resenas">Ver opiniones <span aria-hidden="true">↘</span></a>
  </div>;
}
