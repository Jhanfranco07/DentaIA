"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatearPrecio, inicialesDe, textoOpcional } from "./formato";
import type { Dentista } from "./tipos";
import styles from "./directorio.module.css";
import { contextoReporte, enlaceSolicitud } from "@/lib/navegacion";

type Carga =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "noEncontrado" }
  | { estado: "listo"; dentista: Dentista };

export default function DentistaDetalle({ id }: { id: string }) {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);
  const [contexto, setContexto] = useState("");
  useEffect(() => { setContexto(contextoReporte(window.location.search)); }, []);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const client = getSupabaseBrowserClient();
        const { data, error } = await client
          .from("dentists")
          .select("*")
          .eq("id", id)
          .eq("is_active", true)
          .maybeSingle();
        if (cancelado) return;
        // 22P02: el texto de la URL no es un UUID válido, así que ese perfil no existe.
        if (error && error.code === "22P02") setCarga({ estado: "noEncontrado" });
        else if (error) setCarga({ estado: "error", mensaje: error.message });
        else if (!data) setCarga({ estado: "noEncontrado" });
        else setCarga({ estado: "listo", dentista: data });
      } catch (e) {
        if (cancelado) return;
        setCarga({ estado: "error", mensaje: e instanceof Error ? e.message : "Error desconocido." });
      }
    }
    cargar();
    return () => { cancelado = true; };
  }, [id, intento]);

  function reintentar() {
    setCarga({ estado: "cargando" });
    setIntento(n => n + 1);
  }

  return (
    <section className={styles.pagina}>
      <nav aria-label="Volver al recorrido" className={styles.retorno}><Link href={`/directorio${contexto ? `?${contexto}` : ""}`} className={styles.volver}>← Volver al directorio</Link>{contexto && <Link href="/analisis/demo?reporte=1">Volver a mi reporte</Link>}</nav>

      {carga.estado === "cargando" && (
        <div className={styles.aviso} role="status" aria-live="polite">Cargando perfil…</div>
      )}

      {carga.estado === "error" && (
        <div className={`${styles.aviso} ${styles.avisoError}`} role="alert">
          <strong>No pudimos cargar este perfil.</strong>
          <p>Revisa tu conexión y vuelve a intentarlo.</p>
          <button type="button" className={styles.boton} onClick={reintentar}>Reintentar</button>
        </div>
      )}

      {carga.estado === "noEncontrado" && (
        <div className={styles.aviso} role="status">
          <strong>No encontramos este profesional.</strong>
          <p>Puede que el enlace no sea correcto o que el perfil ya no esté activo.</p>
        </div>
      )}

      {carga.estado === "listo" && (
        <article className={styles.detalle}>
          <div
            className={`${styles.avatar} ${styles.avatarGrande}`}
            style={{ background: carga.dentista.avatar_color?.trim() || "#e3f6f0" }}
            aria-hidden="true"
          >
            {inicialesDe(carga.dentista.initials, carga.dentista.name)}
          </div>
          <div className={styles.cuerpo}>
            {carga.dentista.is_demo && <span className={styles.ficticio}>Perfil ficticio</span>}
            <h1>{textoOpcional(carga.dentista.name, "Nombre no disponible")}</h1>
            <p className={styles.especialidad}>
              {textoOpcional(carga.dentista.specialty, "Especialidad no indicada")}
            </p>

            <dl className={styles.datos}>
              <div>
                <dt>Distrito</dt>
                <dd>{textoOpcional(carga.dentista.district, "No indicado")}</dd>
              </div>
              <div>
                <dt>{carga.dentista.is_demo ? "Precio de consulta (ilustrativo)" : "Precio de consulta"}</dt>
                <dd>{formatearPrecio(carga.dentista.consultation_price, carga.dentista.currency)}</dd>
              </div>
            </dl>

            <h2>Acerca del profesional</h2>
            <p>{textoOpcional(carga.dentista.description, "Este profesional aún no ha publicado una descripción.")}</p>

            <p className={styles.nota}>
              Este perfil y sus tarifas son ilustrativos. Una solicitud de demostración no confirma
              una cita ni se envía a una clínica.
            </p>
            {carga.dentista.is_demo && <Link className={styles.solicitar} href={enlaceSolicitud(carga.dentista.id, contexto)}>Solicitar atención de demostración</Link>}
          </div>
        </article>
      )}
    </section>
  );
}
