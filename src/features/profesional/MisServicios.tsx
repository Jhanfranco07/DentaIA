"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatearPrecio } from "../directorio/formato";
import {
  consultarServicios,
  datosServicio,
  guardarServicio,
  type FormularioServicio,
  type ServicioOdontologico,
} from "../directorio/servicios-odontologicos";
import styles from "./profesional.module.css";

const VACIO: FormularioServicio = {
  nombre: "", descripcion: "", duracion: "", precio: "", moneda: "PEN", publicado: false,
};

export default function MisServicios({ dentistId, estadoDirectorio }: { dentistId: string; estadoDirectorio: "cargando" | "visible" | "oculto" | "error" }) {
  const [servicios, setServicios] = useState<ServicioOdontologico[] | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [revision, setRevision] = useState(0);
  const [formulario, setFormulario] = useState<FormularioServicio | null>(null);
  const [editando, setEditando] = useState<ServicioOdontologico | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const control = new AbortController();
    async function cargar() {
      try {
        const resultado = await consultarServicios(getSupabaseBrowserClient(), dentistId, false, control.signal);
        if (resultado.error) throw resultado.error;
        if (!control.signal.aborted) setServicios(resultado.data);
      } catch {
        if (!control.signal.aborted) setErrorCarga(true);
      }
    }
    void cargar();
    return () => control.abort();
  }, [dentistId, revision]);

  function recargar() {
    setServicios(null);
    setErrorCarga(false);
    setRevision(valor => valor + 1);
  }

  function abrirFormulario(servicio: ServicioOdontologico | null) {
    setError("");
    setMensaje("");
    setEditando(servicio);
    setFormulario(servicio ? {
      nombre: servicio.name,
      descripcion: servicio.description ?? "",
      duracion: servicio.duration_minutes?.toString() ?? "",
      precio: servicio.price_amount?.toString() ?? "",
      moneda: servicio.currency_code,
      publicado: servicio.is_active,
    } : VACIO);
  }

  function cambiar<K extends keyof FormularioServicio>(campo: K, valor: FormularioServicio[K]) {
    setFormulario(actual => actual && { ...actual, [campo]: valor });
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formulario || guardando) return;
    setError("");
    let datos: ReturnType<typeof datosServicio>;
    try {
      datos = datosServicio(formulario);
    } catch (problema) {
      if (problema instanceof Error) setError(problema.message);
      return;
    }

    setGuardando(true);
    try {
      const resultado = await guardarServicio(getSupabaseBrowserClient(), dentistId, datos, editando);
      if (resultado.error?.code === "23505") {
        setError("Ya tienes un servicio registrado con ese nombre.");
        return;
      }
      if (resultado.error?.code === "42501") {
        setError("Solo un odontólogo verificado puede administrar los servicios de su perfil.");
        return;
      }
      if (resultado.error) throw resultado.error;
      if (!resultado.data) {
        setError("El servicio cambió o ya no tienes acceso para editarlo. Cancela la edición y vuelve a cargar la lista.");
        return;
      }

      setFormulario(null);
      setEditando(null);
      setMensaje(editando ? "Servicio actualizado." : "Servicio registrado.");
      recargar();
    } catch {
      setError("No pudimos guardar el servicio. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section id="mis-servicios" className={styles.tarjeta} tabIndex={-1} aria-labelledby="titulo-mis-servicios">
      <header className={styles.cabeceraSeccion}>
        <h2 id="titulo-mis-servicios">Mis servicios</h2>
        <p>Administra los servicios de tu ficha. Solo se muestran públicamente cuando el servicio está activo y el perfil del odontólogo también está publicado.</p>
      </header>

      {estadoDirectorio === "oculto" && <p className={styles.estadoVacio} role="status">Esta ficha no está publicada en el directorio. Puedes registrar y editar servicios de prueba, pero no aparecerán en el catálogo público mientras el perfil esté inactivo.</p>}
      {estadoDirectorio === "error" && <p role="status">No se pudo confirmar la visibilidad pública de la ficha.</p>}
      {errorCarga && <div className={styles.estadoError} role="alert">No pudimos cargar tus servicios.</div>}
      {errorCarga && <button type="button" className={styles.botonSecundario} onClick={recargar}>Reintentar</button>}
      {!errorCarga && servicios === null && <div className={styles.estadoCarga} role="status">Cargando servicios…</div>}
      {servicios?.length === 0 && <div className={styles.estadoVacio}>Aún no tienes servicios registrados.</div>}
      {!!servicios?.length && (
        <ul className={styles.listaServicios}>
          {servicios.map(servicio => (
            <li key={servicio.id}>
              <div>
                <strong>{servicio.name}</strong>
                <p>{servicio.is_active ? (estadoDirectorio === "visible" ? "Publicado en el directorio" : "Servicio activado · ficha no publicada") : "Sin publicar"}</p>
                {servicio.price_amount !== null && <p>{formatearPrecio(servicio.price_amount, servicio.currency_code)}</p>}
              </div>
              <button type="button" className={styles.botonSecundario} aria-label={`Editar ${servicio.name}`}
                disabled={guardando} onClick={() => abrirFormulario(servicio)}>Editar</button>
            </li>
          ))}
        </ul>
      )}
      {servicios !== null && !formulario && (
        <div className={styles.accionesEstado}>
          <button type="button" className={styles.botonSecundario} onClick={() => abrirFormulario(null)}>Agregar servicio</button>
          <button type="button" className={styles.botonSecundario} onClick={recargar}>Actualizar lista</button>
        </div>
      )}

      {formulario && (
        <form className={styles.formularioServicio} onSubmit={guardar} aria-labelledby="titulo-formulario-servicio">
          <h3 id="titulo-formulario-servicio">{editando ? "Editar servicio" : "Registrar servicio"}</h3>
          <fieldset disabled={guardando}>
            <div className={styles.campo}>
              <label htmlFor="servicio-nombre">Nombre del servicio</label>
              <input id="servicio-nombre" value={formulario.nombre} onChange={evento => cambiar("nombre", evento.target.value)} required maxLength={160} />
            </div>
            <div className={styles.campo}>
              <label htmlFor="servicio-descripcion">Descripción (opcional)</label>
              <textarea id="servicio-descripcion" rows={3} value={formulario.descripcion} onChange={evento => cambiar("descripcion", evento.target.value)} maxLength={2000} />
            </div>
            <div className={styles.campo}>
              <label htmlFor="servicio-duracion">Duración en minutos (opcional)</label>
              <input id="servicio-duracion" type="number" min={5} max={480} step={1} value={formulario.duracion} onChange={evento => cambiar("duracion", evento.target.value)} />
            </div>
            <div className={styles.campo}>
              <label htmlFor="servicio-precio">Precio (opcional)</label>
              <input id="servicio-precio" inputMode="decimal" value={formulario.precio} onChange={evento => cambiar("precio", evento.target.value)} />
            </div>
            <div className={styles.campo}>
              <label htmlFor="servicio-moneda">Código de moneda</label>
              <input id="servicio-moneda" value={formulario.moneda} onChange={evento => cambiar("moneda", evento.target.value)} required maxLength={3} />
            </div>
            <label className={styles.publicarServicio}>
              <input type="checkbox" checked={formulario.publicado} onChange={evento => cambiar("publicado", evento.target.checked)} />
              Activar servicio para el directorio (requiere una ficha pública activa)
            </label>
            <div className={styles.accionesEstado}>
              <button type="submit" className={styles.botonSecundario}>{guardando ? "Guardando…" : "Guardar servicio"}</button>
              <button type="button" className={styles.botonSecundario} onClick={() => { setFormulario(null); setError(""); }}>Cancelar</button>
            </div>
          </fieldset>
        </form>
      )}
      {error && <div className={styles.estadoError} role="alert">{error}</div>}
      {mensaje && <p role="status">{mensaje}</p>}
    </section>
  );
}
