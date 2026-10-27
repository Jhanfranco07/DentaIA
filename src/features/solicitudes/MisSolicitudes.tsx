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

type Solicitud = Tables<"appointment_requests">;

export default function MisSolicitudes() {
  const { usuario, cargando: cargandoSesion } = useSesion();

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [mensajeAccion, setMensajeAccion] = useState("");

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

    const confirmar = window.confirm(
      "¿Deseas cancelar esta solicitud de demostración?",
    );

    if (!confirmar) return;

    setCancelandoId(id);
    setError("");
    setMensajeAccion("");

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

  return (
    <section className={styles.tarjeta} id="mis-solicitudes">
      <h2 className={styles.tituloSeccion}>Mis solicitudes</h2>

      <p className={styles.subtitulo}>
        Consulta el historial y el estado de tus solicitudes de demostración.
      </p>

      {mensajeAccion && (
        <p className={styles.exito} role="status">
          {mensajeAccion}
        </p>
      )}

      {cargando && <p role="status">Cargando tus solicitudes…</p>}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!cargando && !error && solicitudes.length === 0 && (
        <div className={styles.vacio}>
          {usuario ? "Todavía no tienes solicitudes. Puedes registrar una de demostración en el formulario de arriba." : <><p>Inicia sesión para consultar tus solicitudes personales.</p><Link href="/cuenta">Ir a Mi cuenta</Link></>}
        </div>
      )}

      {!cargando && !error && solicitudes.length > 0 && (
        <div className={styles.lista}>
          {solicitudes.map((solicitud) => (
            <article key={solicitud.id} className={styles.solicitud}>
              <div className={styles.solicitudCabecera}>
                <h3 className={styles.solicitudTitulo}>
                  Solicitud de demostración
                </h3>

                <span
                  className={`${styles.estado} ${
                    solicitud.status === "cancelled"
                      ? styles.estadoCancelado
                      : ""
                  }`}
                >
                  {solicitud.status === "requested"
                    ? "Solicitada"
                    : solicitud.status === "cancelled"
                      ? "Cancelada"
                      : solicitud.status}
                </span>
              </div>

              <div className={styles.detalles}>
                <div className={styles.detalle}>
                  <strong>Nombre</strong>
                  {solicitud.contact_name}
                </div>

                <div className={styles.detalle}>
                  <strong>Correo electrónico</strong>
                  {solicitud.contact_email}
                </div>

                <div className={styles.detalle}>
                  <strong>Fecha preferida</strong>
                  {solicitud.preferred_date}
                </div>

                <div className={styles.detalle}>
                  <strong>Hora preferida</strong>
                  {solicitud.preferred_time || "No indicada"}
                </div>

                <div
                  className={styles.detalle}
                  style={{ gridColumn: "1 / -1" }}
                >
                  <strong>Mensaje</strong>
                  {solicitud.message || "Sin mensaje"}
                </div>
              </div>

              {puedeCancelarSolicitud(solicitud.status) && (
                <button
                  className={styles.botonCancelar}
                  type="button"
                  onClick={() => void cancelarSolicitud(solicitud.id)}
                  disabled={cancelandoId !== null}
                >
                  {cancelandoId === solicitud.id
                    ? "Cancelando..."
                    : "Cancelar solicitud"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
