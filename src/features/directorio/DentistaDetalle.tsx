"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatearPrecio, inicialesDe, textoOpcional } from "./formato";
import type { Dentista, MarcadorConsultorio, UbicacionPublica } from "./tipos";
import styles from "./directorio.module.css";
import { enlaceSolicitud } from "@/lib/navegacion";
import dynamic from "next/dynamic";
import ResenasOdontologo from "./ResenasOdontologo";
import mapStyles from "./mapa-directorio.module.css";
import { AVISO_PERFILES_DEMO, perfilDemo, unirCatalogoDemo } from "./catalogo-demo";

const MapaDirectorio = dynamic(() => import("./MapaDirectorio"), { ssr: false, loading: () => <div className={mapStyles.contenedorMapa} role="status">Cargando mapa…</div> });

type Carga =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "noEncontrado" }
  | { estado: "listo"; dentista: Dentista; ubicaciones: UbicacionPublica[]; ubicacionesDisponibles: boolean };

export default function DentistaDetalle({ id }: { id: string }) {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const client = getSupabaseBrowserClient();
        const demo = perfilDemo(id);
        if (demo) {
          const respuesta = await client.from("directory_demo_locations")
            .select("id,slug,name,district,city,country,latitude,longitude,is_demo,is_published,requests_enabled,public_label")
            .eq("slug", demo.slug).eq("is_demo", true).eq("is_published", true).eq("requests_enabled", false).maybeSingle();
          if (cancelado) return;
          if (respuesta.error) { setCarga({ estado: "error", mensaje: respuesta.error.message }); return; }
          const perfil = respuesta.data ? unirCatalogoDemo([respuesta.data])[0] : undefined;
          if (!perfil) { setCarga({ estado: "noEncontrado" }); return; }
          setCarga({ estado: "listo", dentista: perfil, ubicaciones: perfil.ubicaciones, ubicacionesDisponibles: true });
          return;
        }
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
        else {
          const respuestaUbicaciones = await client.from("dentist_public_locations")
            .select("id,dentist_id,practice_name,practice_address,latitude,longitude,created_at")
            .eq("dentist_id", data.id);
          if (cancelado) return;
          setCarga({
            estado: "listo",
            dentista: data,
            ubicaciones: (respuestaUbicaciones.data ?? []) as UbicacionPublica[],
            ubicacionesDisponibles: !respuestaUbicaciones.error,
          });
        }
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
      <nav aria-label="Navegación de perfil" className={styles.retorno}><Link href="/directorio" className={styles.volver}>← Volver al directorio</Link></nav>

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
            {carga.dentista.is_demo && <><span className={styles.ficticio}>Perfil ficticio</span><p className={styles.avisoDemo}>{AVISO_PERFILES_DEMO}.</p></>}
            <h1>{textoOpcional(carga.dentista.name, "Nombre no disponible")}</h1>
            <p className={styles.especialidad}>
              {textoOpcional(carga.dentista.specialty, "Especialidad no indicada")}
            </p>

            <dl className={styles.datos}>
              <div>
                <dt>Distrito</dt>
                <dd>{textoOpcional(carga.dentista.district, "No indicado")}</dd>
              </div>
              {!carga.dentista.is_demo && <div>
                <dt>Precio de consulta</dt>
                <dd>{formatearPrecio(carga.dentista.consultation_price, carga.dentista.currency)}</dd>
              </div>}
              <div>
                <dt>Consultorio</dt>
                <dd>{carga.ubicaciones.length ? carga.ubicaciones.map(u => u.practice_name).join(", ") : carga.ubicacionesDisponibles ? "No registrado" : "No disponible en este entorno"}</dd>
              </div>
              <div>
                <dt>Dirección</dt>
                <dd>{carga.ubicaciones.length ? carga.ubicaciones.map(u => u.practice_address).join(" · ") : carga.ubicacionesDisponibles ? "Ubicación no registrada" : "No disponible en este entorno"}</dd>
              </div>
            </dl>

            <h2>{carga.dentista.is_demo ? "Acerca del perfil ficticio" : "Acerca del profesional"}</h2>
            <p>{textoOpcional(carga.dentista.description, "Este profesional aún no ha publicado una descripción.")}</p>

            {carga.dentista.is_demo && <p className={styles.nota}>
              Este perfil es ilustrativo. El punto del mapa no corresponde a un consultorio real y no hay citas disponibles.
            </p>}
            {carga.dentista.is_demo && !perfilDemo(carga.dentista.id) && <Link className={styles.solicitar} href={enlaceSolicitud(carga.dentista.id)}>Solicitud de demostración</Link>}
            {!carga.dentista.is_demo && <p className={styles.nota}>Este perfil no tiene activo un flujo de solicitudes desde DentaIA.</p>}
            {carga.ubicaciones.length ? <section className={styles.ubicacionPerfil} aria-labelledby="titulo-ubicacion-perfil"><div><h2 id="titulo-ubicacion-perfil">{carga.dentista.is_demo ? "Punto de demostración" : "Consultorios publicados"}</h2><p>{carga.dentista.is_demo ? "Coordenada representativa; no indica un consultorio ni una dirección de atención." : "La distancia desde tu dispositivo solo se calcula si tú das permiso en el directorio."}</p><ul>{carga.ubicaciones.map(ubicacion => <li key={ubicacion.id}><strong>{ubicacion.practice_name}</strong><p>{ubicacion.practice_address}</p>{!carga.dentista.is_demo && <a href={`https://www.openstreetmap.org/directions?to=${ubicacion.latitude}%2C${ubicacion.longitude}`} target="_blank" rel="noopener noreferrer">Cómo llegar en OpenStreetMap ↗</a>}</li>)}</ul></div><MapaDirectorio ubicaciones={carga.dentista.is_demo ? carga.ubicaciones.map(ubicacion => ({ id: ubicacion.id, slug: carga.dentista.slug, name: ubicacion.practice_name, district: carga.dentista.district, city: "Lima", country: "Perú", latitude: ubicacion.latitude, longitude: ubicacion.longitude, public_label: "DEMO — Clínica ficticia, no ofrece atención real", tipo: "demo" as const, dentist_id: carga.dentista.id })) : carga.ubicaciones.map(ubicacion => ({ ...ubicacion, tipo: "consultorio" as const, dentista: { id: carga.dentista.id, name: carga.dentista.name, is_demo: carga.dentista.is_demo } })) satisfies MarcadorConsultorio[]} ubicacion={null} /></section> : <p className={styles.nota}>{carga.ubicacionesDisponibles ? "Ubicación no registrada. Este perfil no se coloca en el mapa." : "El servicio de ubicaciones aún no está disponible en este entorno."}</p>}
            <ResenasOdontologo dentistId={carga.dentista.id} />
          </div>
        </article>
      )}
    </section>
  );
}
