"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { normalizarWhatsapp } from "@/features/directorio/contacto";
import styles from "@/features/directorio/contacto.module.css";

export default function MiWhatsappProfesional({ dentistId }: { dentistId: string }) {
  const [telefono, setTelefono] = useState("");
  const [publicado, setPublicado] = useState(false);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    let vivo = true; setEstado("cargando"); setTelefono(""); setPublicado(false);
    void (async () => {
      const { data, error } = await getSupabaseBrowserClient().from("dentist_contact_channels")
        .select("whatsapp_e164,whatsapp_publicado").eq("dentist_id", dentistId).maybeSingle();
      if (!vivo) return;
      if (error) setEstado("error");
      else { setTelefono(data?.whatsapp_e164 ?? ""); setPublicado(Boolean(data?.whatsapp_publicado)); setEstado("listo"); }
    })();
    return () => { vivo = false; };
  }, [dentistId]);
  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); if (guardando) return;
    const numero = normalizarWhatsapp(telefono);
    if (!numero) { setMensaje("Ingresa un número válido, por ejemplo +519XXXXXXXX."); return; }
    setGuardando(true); setMensaje("");
    const resultado = await getSupabaseBrowserClient().from("dentist_contact_channels").upsert({
      dentist_id: dentistId, whatsapp_e164: numero, whatsapp_publicado: publicado,
      consentimiento_publicacion_en: publicado ? new Date().toISOString() : null,
    }, { onConflict: "dentist_id" });
    if (resultado.error) setMensaje("No fue posible guardar. Comprueba que tu cuenta esté verificada y tenga una membresía activa.");
    else { setTelefono(numero); setMensaje(publicado ? "Tu WhatsApp profesional puede mostrarse en tu ficha pública." : "Contacto guardado como privado. No aparece en el directorio."); }
    setGuardando(false);
  }
  return <section className={styles.tarjeta} aria-labelledby="mi-whatsapp-titulo">
    <div className={styles.encabezado}><span className={styles.icono} aria-hidden="true">✉</span>
      <div><h2 id="mi-whatsapp-titulo">Mi contacto profesional</h2>
        <p>Ofrece a tus pacientes una forma rápida de consultar sin abandonar el proceso de citas en DentaIA.</p></div></div>
    {estado === "cargando" ? <p role="status">Cargando tu contacto…</p> :
      estado === "error" ? <p role="alert">No se pudo consultar tu contacto. Inténtalo más tarde.</p> :
      <form className={styles.formulario} onSubmit={guardar}>
        <label>Número de WhatsApp profesional
          <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
            placeholder="+519XXXXXXXX" maxLength={22} autoComplete="tel" required /></label>
        <label className={styles.consentimiento}><input type="checkbox" checked={publicado}
          onChange={e => setPublicado(e.target.checked)} />
          Autorizo publicar este número profesional en mi ficha para consultas externas.</label>
        <p className={styles.aclaracion}>Puedes desactivar su publicación cuando quieras. DentaIA no envía fotografías ni datos clínicos a WhatsApp.</p>
        <button className={styles.guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar contacto"}</button>
      </form>}
    {mensaje && <p role="status" className={styles.nota}>{mensaje}</p>}
  </section>;
}
