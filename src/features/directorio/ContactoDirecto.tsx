"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { enlaceWhatsappProfesional } from "./contacto";
import styles from "./contacto.module.css";

export default function ContactoDirecto({ dentistId, nombre }: { dentistId: string; nombre: string }) {
  const [estado, setEstado] = useState<"cargando" | "disponible" | "no-disponible">("cargando");
  const [telefono, setTelefono] = useState("");
  useEffect(() => {
    let vivo = true;
    setEstado("cargando"); setTelefono("");
    void (async () => {
      try {
        const { data, error } = await getSupabaseBrowserClient().from("dentist_contact_channels")
          .select("whatsapp_e164").eq("dentist_id", dentistId)
          .eq("whatsapp_publicado", true).maybeSingle();
        if (!vivo) return;
        if (error || !data?.whatsapp_e164) { setEstado("no-disponible"); return; }
        setTelefono(data.whatsapp_e164);
        setEstado("disponible");
      } catch { if (vivo) setEstado("no-disponible"); }
    })();
    return () => { vivo = false; };
  }, [dentistId]);
  const enlace = enlaceWhatsappProfesional(telefono, nombre);
  return <section className={styles.tarjeta} aria-labelledby="contacto-profesional">
    <div className={styles.encabezado}>
      <span className={styles.icono} aria-hidden="true">✉</span>
      <div><h2 id="contacto-profesional">Consulta directamente al odontólogo</h2>
        <p>Resuelve dudas sobre horarios, servicios o disponibilidad antes de programar tu visita.</p></div>
    </div>
    {estado === "cargando" ? <p role="status" className={styles.nota}>Comprobando canales de contacto…</p> :
      estado === "disponible" && enlace ?
        <a className={styles.whatsapp} href={enlace} target="_blank" rel="noopener noreferrer"
          aria-label={`Consultar a ${nombre} mediante WhatsApp, se abrirá una aplicación externa`}>
          <span aria-hidden="true">◉</span> Consultar por WhatsApp <span aria-hidden="true">↗</span>
        </a> :
        <p className={styles.nota}>Este profesional aún no ha publicado un WhatsApp profesional.</p>}
    <p className={styles.aclaracion}>WhatsApp es un canal externo. No envíes fotografías ni resultados clínicos sensibles. Una conversación no equivale a una cita confirmada.</p>
  </section>;
}
