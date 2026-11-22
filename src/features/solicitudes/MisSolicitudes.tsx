"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { MAX_CONSULTA, MAX_PAGINA_BUSQUEDA } from "@/lib/busqueda/bm25";
import { useConsultaEstable } from "@/lib/busqueda/useConsultaEstable";
import { useSesion } from "@/features/cuenta/useSesion";
import { puedeCancelarSolicitud } from "./validaciones";
import {
  obtenerMisSolicitudesPaginadas,
  cancelarSolicitudDemo,
  type FiltroEstado,
  type PaginaSolicitudes,
} from "./solicitudes";
import styles from "./solicitudes.module.css";
import Link from "next/link";
import { Icono } from "@/components/Identidad";
import MisCitasRealesPaciente from "./MisCitasRealesPaciente";

export default function MisSolicitudes({ compacto = false }: { compacto?: boolean }) {
  const { usuario, cargando: cargandoSesion } = useSesion();
  const usuarioId = usuario?.id;

  const [carga, setCarga] = useState<{ usuarioId: string; resultado: PaginaSolicitudes } | null>(null);
  const resultado = carga?.usuarioId === usuarioId ? carga?.resultado : undefined;
  const [pagina, setPagina] = useState(1);
  const [revision, setRevision] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [mensajeAccion, setMensajeAccion] = useState("");
  const [confirmacionId, setConfirmacionId] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todas");
  const [busqueda, setBusqueda] = useState("");
  const texto = useConsultaEstable(busqueda);

  useEffect(() => {
    const actualizar = () => { setPagina(1); setRevision(n => n + 1); };
    window.addEventListener("dentai:solicitud-registrada", actualizar);
    return () => window.removeEventListener("dentai:solicitud-registrada", actualizar);
  }, []);

  useEffect(() => {
    if (cargandoSesion) return;
    if (!usuarioId) {
      setCarga(null);
      setError("");
      setMensajeAccion("");
      setCargando(false);
      return;
    }
    setCargando(true);
    setError("");
    if (texto === undefined) return;
    const id = usuarioId;
    const controller = new AbortController();
    const consulta = { texto, estado: filtroEstado, pagina, tamano: compacto ? 3 : 12 };
    async function cargarSolicitudes() {
      try {
        const respuesta = await obtenerMisSolicitudesPaginadas(getSupabaseBrowserClient(), consulta, controller.signal);
        if (!controller.signal.aborted) setCarga({ usuarioId: id, resultado: respuesta });
      } catch {
        if (!controller.signal.aborted) setError("No se pudieron cargar tus solicitudes.");
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }
    void cargarSolicitudes();
    return () => controller.abort();
  }, [usuarioId, cargandoSesion, texto, filtroEstado, pagina, revision, compacto]);

  async function cancelarSolicitud(id: string) {
    if (!usuario || cancelandoId) return;
    if (confirmacionId !== id) return;

    setCancelandoId(id);
    setError("");
    setMensajeAccion("");
    setConfirmacionId(null);

    try {
      await cancelarSolicitudDemo(getSupabaseBrowserClient(), usuario.id, id);
      setRevision(n => n + 1);
      setMensajeAccion("Solicitud cancelada correctamente.");
    } catch {
      setError(
        "No se pudo cancelar la solicitud. Actualiza la página e inténtalo nuevamente.",
      );
    } finally {
      setCancelandoId(null);
    }
  }

  const solicitudes = resultado?.items ?? [];
  const total = resultado?.totalSolicitudes ?? 0;
  const paginas = resultado ? Math.max(1, Math.ceil(resultado.total / resultado.tamano)) : 1;

  return (
    <>
    {!compacto && usuarioId && <MisCitasRealesPaciente />}
    <section className={`${styles.tarjeta} ${compacto ? styles.compacto : ""}`} id="mis-solicitudes">
      <header className={styles.encabezadoSolicitudes}>
        <div><h2 className={styles.tituloSeccion}>Mis solicitudes</h2><p className={styles.subtitulo}>Este listado contiene las solicitudes de demostración; las citas reales se consultan en la sección superior.</p></div>
        {compacto && <Link className={styles.verTodas} href="/solicitudes">Ver todas <span aria-hidden="true">→</span></Link>}
      </header>

      {!compacto && usuarioId && (
        <>
          {resultado && <div className={styles.resumenSolicitudes} aria-label="Resumen de solicitudes demostrativas">
            <div className={styles.resumenTarjeta}><span>Total de solicitudes</span><strong>{total}</strong><small>Historial registrado</small></div>
            <div className={styles.resumenTarjeta}><span>Solicitadas</span><strong>{resultado.solicitadas}</strong><small>Sin cita confirmada</small></div>
            <div className={styles.resumenTarjeta}><span>Canceladas</span><strong>{resultado.canceladas}</strong><small>Solicitudes anuladas</small></div>
          </div>}
          <div className={styles.herramientasSolicitudes}>
            <div className={styles.pestanasSolicitudes} role="group" aria-label="Filtrar solicitudes por estado">
              {([["todas", "Todas", resultado?.totalSolicitudes], ["requested", "Solicitadas", resultado?.solicitadas], ["cancelled", "Canceladas", resultado?.canceladas]] as const).map(([valor, etiqueta, cantidad]) => (
                <button key={valor} type="button" className={filtroEstado === valor ? styles.pestanaActiva : styles.pestana}
                  aria-pressed={filtroEstado === valor} onClick={() => { setFiltroEstado(valor); setPagina(1); }}>
                  {etiqueta} {cantidad !== undefined && <span>{cantidad}</span>}
                </button>
              ))}
            </div>
            <label className={styles.buscarSolicitud}>
              <span>Buscar en mis solicitudes</span>
              <input type="search" value={busqueda} maxLength={MAX_CONSULTA} onChange={evento => { setBusqueda(evento.target.value); setPagina(1); }}
                placeholder="Profesional, fecha o motivo…" />
            </label>
          </div>
        </>
      )}

      {mensajeAccion && (
        <p className={styles.exito} role="status">
          {mensajeAccion}
        </p>
      )}

      {cargando && <div className={styles.esqueletoSolicitudes} role="status"><span className="sr-only">Cargando tus solicitudes…</span><i /><i /><i /></div>}

      {error && (
        <div className={styles.error} role="alert">{error} <button type="button" className={styles.botonNeutral} onClick={() => setRevision(n => n + 1)}>Reintentar</button></div>
      )}

      {!cargando && !error && (!usuarioId || (resultado && total === 0)) && (
        <div className={styles.vacio}>
          {usuario ? <>{compacto ? "Todavía no tienes solicitudes registradas." : "Todavía no tienes solicitudes. Puedes registrar una desde el formulario."} {compacto && <Link href="/directorio">Explorar odontólogos</Link>}</> : <><p>Inicia sesión para consultar tus solicitudes personales.</p><Link href="/cuenta">Ir a Mi perfil</Link></>}
        </div>
      )}

      {!compacto && !cargando && !error && resultado && total > 0 && <p className={styles.contadorResultados} role="status">{resultado.total} de {total} solicitudes</p>}

      {!cargando && !error && total > 0 && solicitudes.length === 0 && <div className={styles.vacio} role="status">No encontramos solicitudes con estos filtros. Prueba otra búsqueda o selecciona «Todas».</div>}

      {!cargando && !error && solicitudes.length > 0 && (
        <div className={styles.lista}>
          {solicitudes.map((solicitud) => (
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

              <details className={styles.detallesExpandibles}><summary>Ver detalles de la solicitud</summary><dl className={styles.detalles}>
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
      {!compacto && !error && resultado && paginas > 1 && <nav className={styles.herramientasSolicitudes} aria-label="Paginación de solicitudes">
        <button type="button" className={styles.botonNeutral} disabled={cargando || resultado.pagina <= 1} onClick={() => setPagina(resultado.pagina - 1)}>Anterior</button>
        <span>Página {resultado.pagina} de {paginas}</span>
        <button type="button" className={styles.botonNeutral} disabled={cargando || resultado.pagina >= Math.min(paginas, MAX_PAGINA_BUSQUEDA)} onClick={() => setPagina(resultado.pagina + 1)}>Siguiente</button>
      </nav>}
      {compacto && !cargando && !error && total > 3 && <p className={styles.mensajeCompacto}>Se muestran las tres solicitudes más recientes. <Link href="/solicitudes">Abrir el historial completo</Link>.</p>}
    </section>
    </>
  );
}
