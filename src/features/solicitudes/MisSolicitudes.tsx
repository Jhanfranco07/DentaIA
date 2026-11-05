"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSesion } from "@/features/cuenta/useSesion";
import { puedeCancelarSolicitud } from "./validaciones";
import {
  obtenerMisSolicitudes,
  cancelarSolicitudDemo,
} from "./solicitudes";
import type { Tables } from "@/lib/supabase/database.types";
import styles from "./solicitudes.module.css";
import Link from "next/link";
import { Icono } from "@/components/Identidad";

type Solicitud = Tables<"appointment_requests"> & { dentists: Pick<Tables<"dentists">, "name"> | null };
type FiltroEstado = "todas" | "requested" | "cancelled";

export default function MisSolicitudes({ compacto = false }: { compacto?: boolean }) {
  const { usuario, cargando: cargandoSesion } = useSesion();

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [mensajeAccion, setMensajeAccion] = useState("");
  const [confirmacionId, setConfirmacionId] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todas");

  useEffect(() => {
    let activo = true;
    let numeroConsulta = 0;

    async function cargarSolicitudes() {
    if (!activo || cargandoSesion) return;

    const consultaActual = ++numeroConsulta;
    const esConsultaVigente = () =>
        activo && consultaActual === numeroConsulta;

      if (!usuario) {
        if (esConsultaVigente()) {
            setSolicitudes([]);
            setError("");
            setMensajeAccion("");
            setCargando(false);
        }
        return;
     }

        setCargando(true);
        setError("");
        setSolicitudes([]);

        try {
            const cliente = getSupabaseBrowserClient();

            const solicitudesObtenidas = await obtenerMisSolicitudes(
            cliente,
            usuario.id,
            );

            if (esConsultaVigente()) {
            setSolicitudes(solicitudesObtenidas);
            }
        } catch {
          if (esConsultaVigente()) {
            setError("No se pudieron cargar tus solicitudes.");
        }

        } finally {
          if (esConsultaVigente()) setCargando(false);
        }
    }

    void cargarSolicitudes();

    window.addEventListener("dentai:solicitud-registrada", cargarSolicitudes);

    return () => {
      activo = false;

      window.removeEventListener(
        "dentai:solicitud-registrada",
        cargarSolicitudes,
      );
    };
  }, [usuario, cargandoSesion]);

  async function cancelarSolicitud(id: string) {
    if (!usuario || cancelandoId) return;
    if (confirmacionId !== id) return;

    setCancelandoId(id);
    setError("");
    setMensajeAccion("");
    setConfirmacionId(null);

    try {
    const cliente = getSupabaseBrowserClient();

    await cancelarSolicitudDemo(cliente, usuario.id, id);

    setSolicitudes((actuales) =>
        actuales.map((solicitud) =>
        solicitud.id === id
            ? { ...solicitud, status: "cancelled" }
            : solicitud,
        ),
    );

    setMensajeAccion("Solicitud cancelada correctamente.");
    
    } catch (error) {
      setError(
        "No se pudo cancelar la solicitud. Actualiza la página e inténtalo nuevamente.",
      );
    } finally {
      setCancelandoId(null);
    }
  }

  const solicitudesFiltradas = solicitudes.filter(solicitud => filtroEstado === "todas" || solicitud.status === filtroEstado);

  return (
    <section className={`${styles.tarjeta} ${compacto ? styles.compacto : ""}`} id="mis-solicitudes">
      <header className={styles.encabezadoSolicitudes}>
        <div><h2 className={styles.tituloSeccion}>Mis solicitudes</h2><p className={styles.subtitulo}>Solicitudes de orientación de demostración; no representan citas clínicas confirmadas.</p></div>
        {compacto && <Link className={styles.verTodas} href="/solicitudes">Ver todas <span aria-hidden="true">→</span></Link>}
      </header>

      {mensajeAccion && (
        <p className={styles.exito} role="status">
          {mensajeAccion}
        </p>
      )}

      {cargando && <div className={styles.esqueletoSolicitudes} role="status"><span className="sr-only">Cargando tus solicitudes…</span><i /><i /><i /></div>}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!cargando && !error && solicitudes.length === 0 && (
        <div className={styles.vacio}>
          {usuario ? <>{compacto ? "Todavía no tienes solicitudes registradas." : "Todavía no tienes solicitudes. Puedes registrar una desde el formulario."} {compacto && <Link href="/directorio">Explorar odontólogos</Link>}</> : <><p>Inicia sesión para consultar tus solicitudes personales.</p><Link href="/cuenta">Ir a Mi perfil</Link></>}
        </div>
      )}

      {!compacto && solicitudes.length > 1 && <div className={styles.filtroSolicitudes}><label htmlFor="filtro-estado-solicitudes">Filtrar por estado</label><select id="filtro-estado-solicitudes" value={filtroEstado} onChange={evento => setFiltroEstado(evento.target.value as FiltroEstado)}><option value="todas">Todas</option><option value="requested">Solicitadas</option><option value="cancelled">Canceladas</option></select><span>{solicitudesFiltradas.length} de {solicitudes.length}</span></div>}

      {!cargando && !error && solicitudes.length > 0 && solicitudesFiltradas.length === 0 && <div className={styles.vacio} role="status">No hay solicitudes con este estado.</div>}

      {!cargando && !error && solicitudesFiltradas.length > 0 && (
        <div className={styles.lista}>
          {(compacto ? solicitudesFiltradas.slice(0, 3) : solicitudesFiltradas).map((solicitud) => (
            <article key={solicitud.id} className={styles.solicitud}>
              <div className={styles.solicitudCabecera}>
                <div className={styles.solicitudResumen}><span className={styles.iconoSolicitud}><Icono nombre={solicitud.status === "cancelled" ? "cerrar" : "reloj"} size={16} /></span><div><h3 className={styles.solicitudTitulo}>{solicitud.dentists?.name ?? "Profesional no disponible"}</h3><p>Orientación · <time dateTime={solicitud.preferred_date}>{solicitud.preferred_date}</time>{solicitud.preferred_time ? ` · ${solicitud.preferred_time}` : ""}</p></div></div>

                <span
                  className={`${styles.estado} ${solicitud.status === "cancelled" ? styles.estadoCancelado : styles.estadoSolicitada}`}
                  aria-label={`Estado: ${solicitud.status === "requested" ? "Solicitada" : solicitud.status === "cancelled" ? "Cancelada" : solicitud.status}`}
                >
                  {solicitud.status === "requested"
                    ? "Solicitada"
                    : solicitud.status === "cancelled"
                      ? "Cancelada"
                      : solicitud.status}
                </span>
              </div>

              <details className={styles.detallesExpandibles}><summary>Ver detalles de solicitud</summary><dl className={styles.detalles}>
                <div className={styles.detalle}><dt>Nombre de contacto</dt><dd>{solicitud.contact_name}</dd></div>
                <div className={styles.detalle}><dt>Correo</dt><dd>{solicitud.contact_email}</dd></div>
                <div className={styles.detalle}><dt>Fecha preferida</dt><dd>{solicitud.preferred_date}</dd></div>
                <div className={styles.detalle}><dt>Hora preferida</dt><dd>{solicitud.preferred_time || "No indicada"}</dd></div>
                <div className={`${styles.detalle} ${styles.detalleCompleto}`}><dt>Mensaje</dt><dd>{solicitud.message || "Sin mensaje"}</dd></div>
              </dl></details>

              {puedeCancelarSolicitud(solicitud.status) && (
                confirmacionId === solicitud.id ? <div className={styles.confirmacion} role="group" aria-label="Confirmar cancelación de solicitud"><span>¿Cancelar esta solicitud?</span><button type="button" className={styles.botonCancelar} onClick={() => void cancelarSolicitud(solicitud.id)} disabled={cancelandoId !== null}>{cancelandoId === solicitud.id ? "Cancelando…" : "Sí, cancelar"}</button><button type="button" className={styles.botonNeutral} onClick={() => setConfirmacionId(null)} disabled={cancelandoId !== null}>Conservar solicitud</button></div> : <button className={styles.botonCancelar} type="button" onClick={() => setConfirmacionId(solicitud.id)} disabled={cancelandoId !== null}>Cancelar solicitud</button>
              )}
            </article>
          ))}
        </div>
      )}
      {compacto && !cargando && !error && solicitudesFiltradas.length > 3 && <p className={styles.mensajeCompacto}>Se muestran las tres solicitudes más recientes. <Link href="/solicitudes">Abrir el historial completo</Link>.</p>}
    </section>
  );
}
