"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Tables } from "@/lib/supabase/database.types";

import { useSesion } from "@/features/cuenta/useSesion";
import { validarSolicitud } from "./validaciones";
import styles from "./solicitudes.module.css";
import Link from "next/link";

type Odontologo = Pick<
  Tables<"dentists">,
  "id" | "name" | "specialty" | "district"
>;

export default function FormularioSolicitud({ odontologoInicial = "" }: { odontologoInicial?: string }) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [fechaMinima, setFechaMinima] = useState("");

  const [odontologos, setOdontologos] = useState<Odontologo[]>([]);
  const [odontologoId, setOdontologoId] = useState("");
  const [cargandoOdontologos, setCargandoOdontologos] = useState(true);
  const [errorOdontologos, setErrorOdontologos] = useState("");

  const { usuario, cargando: cargandoSesion, errorSesion } = useSesion();
  const [guardando, setGuardando] = useState(false);
  const [errorRegistro, setErrorRegistro] = useState("");
  const [exitoRegistro, setExitoRegistro] = useState("");

  useEffect(() => {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const dia = String(ahora.getDate()).padStart(2, "0");

    setFechaMinima(`${anio}-${mes}-${dia}`);
  }, []);

  useEffect(() => {
    let activo = true;
    setCargandoOdontologos(true);
    setErrorOdontologos("");

    async function cargarOdontologos() {
      try {
        const { data, error } = await getSupabaseBrowserClient()
          .from("dentists")
          .select("id, name, specialty, district")
          .eq("is_active", true)
          .eq("is_demo", true)
          .order("name");

        if (error) throw error;

        if (activo) {
          setOdontologos(data ?? []);
          setOdontologoId(data?.some(d => d.id === odontologoInicial) ? odontologoInicial : "");
        }
      } catch {
        if (activo) {
          setErrorOdontologos("No se pudieron cargar los odontólogos.");
        }
      } finally {
        if (activo) setCargandoOdontologos(false);
      }
    }

    void cargarOdontologos();

    return () => {
      activo = false;
    };
  }, [odontologoInicial]);

  async function registrarSolicitud(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (guardando) return;

    setErrorRegistro("");
    setExitoRegistro("");

    if (cargandoSesion || !usuario) {
      setErrorRegistro("Debes iniciar sesión para registrar una solicitud.");
      return;
    }

    if (!odontologos.some((item) => item.id === odontologoId)) {
      setErrorRegistro("Selecciona un odontólogo válido.");
      return;
    }

    const nombreLimpio = nombre.trim();
    const correoLimpio = correo.trim();
    const mensajeLimpio = mensaje.trim();

    const ahora = new Date();
    const hoy = [
      ahora.getFullYear(),
      String(ahora.getMonth() + 1).padStart(2, "0"),
      String(ahora.getDate()).padStart(2, "0"),
    ].join("-");

    const errorValidacion = validarSolicitud(
      {
        odontologoId,
        nombre: nombreLimpio,
        correo: correoLimpio,
        fecha,
        mensaje: mensajeLimpio,
      },
      hoy,
    );

    if (errorValidacion) {
      setErrorRegistro(errorValidacion);
      return;
    }

    setGuardando(true);

    try {
      const cliente = getSupabaseBrowserClient();

      const { data: identidad, error: errorIdentidad } =
        await cliente.auth.getUser();

      if (
        errorIdentidad ||
        !identidad.user ||
        identidad.user.id !== usuario.id
      ) {
        throw new Error("La sesión no es válida. Inicia sesión nuevamente.");
      }

      const { error } = await cliente.from("appointment_requests").insert({
        dentist_id: odontologoId,
        contact_name: nombreLimpio,
        contact_email: correoLimpio,
        preferred_date: fecha,
        preferred_time: hora || null,
        message: mensajeLimpio,
        user_id: identidad.user.id,
        status: "requested",
        is_demo: true,
      });

      if (error) throw error;

      setExitoRegistro("Solicitud de demostración registrada correctamente.");
      window.dispatchEvent(new Event("dentai:solicitud-registrada"));
      setOdontologoId("");
      setNombre("");
      setCorreo("");
      setFecha("");
      setHora("");
      setMensaje("");
    } catch (error) {
      setErrorRegistro(
        "No se pudo registrar la solicitud. Verifica tu sesión e inténtalo nuevamente.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className={styles.tarjeta}>
      <h2 className={styles.tituloSeccion}>Nueva solicitud de demostración</h2>

      <p className={styles.subtitulo}>
        Selecciona un odontólogo y completa tus datos para registrar una
        solicitud de orientación.
      </p>

      <form className={styles.formulario} onSubmit={registrarSolicitud}>
        <div className={styles.grid}>
          <div className={`${styles.campo} ${styles.campoCompleto}`}>
            <label className={styles.etiqueta} htmlFor="odontologo">
              Odontólogo *
            </label>

            <select
              id="odontologo"
              className={styles.select}
              required
              value={odontologoId}
              onChange={(e) => setOdontologoId(e.target.value)}
              disabled={cargandoOdontologos || Boolean(errorOdontologos)}
            >
              <option value="">
                {cargandoOdontologos
                  ? "Cargando odontólogos..."
                  : "Selecciona un odontólogo"}
              </option>

              {odontologos.map((odontologo) => (
                <option key={odontologo.id} value={odontologo.id}>
                  {odontologo.name} — {odontologo.specialty}
                  {" · "}
                  {odontologo.district}
                </option>
              ))}
            </select>

            {errorOdontologos && (
              <p className={styles.error} role="alert">
                {errorOdontologos}
              </p>
            )}
          </div>

          <div className={styles.campo}>
            <label className={styles.etiqueta} htmlFor="nombre">
              Nombre completo *
            </label>
            <input
              id="nombre"
              className={styles.input}
              required
              autoComplete="name"
              placeholder="Ingresa tu nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className={styles.campo}>
            <label className={styles.etiqueta} htmlFor="correo">
              Correo electrónico *
            </label>
            <input
              id="correo"
              className={styles.input}
              type="email"
              required
              autoComplete="email"
              placeholder="ejemplo@correo.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </div>

          <div className={styles.campo}>
            <label className={styles.etiqueta} htmlFor="fecha">
              Fecha preferida *
            </label>
            <input
              id="fecha"
              className={styles.input}
              type="date"
              required
              min={fechaMinima || undefined}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div className={styles.campo}>
            <label className={styles.etiqueta} htmlFor="hora">
              Hora preferida (opcional)
            </label>
            <input
              id="hora"
              className={styles.input}
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>

          <div className={`${styles.campo} ${styles.campoCompleto}`}>
            <label className={styles.etiqueta} htmlFor="mensaje">
              Mensaje adicional (opcional)
            </label>
            <textarea
              id="mensaje"
              className={styles.textarea}
              maxLength={1000}
              placeholder="Escribe algún detalle sobre tu solicitud..."
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
            />
            <small className={styles.contador}>
              {mensaje.length}/1000 caracteres
            </small>
          </div>
        </div>

        <div className={styles.aviso}>
          Esta solicitud es únicamente demostrativa. No confirma una cita
          clínica real ni envía mensajes a profesionales.
        </div>

        {errorSesion && (
          <p className={styles.error} role="alert">
            {errorSesion}
          </p>
        )}

        {errorRegistro && (
          <p className={styles.error} role="alert">
            {errorRegistro}
          </p>
        )}

        {exitoRegistro && (
          <p className={styles.exito} role="status">
            {exitoRegistro}
          </p>
        )}

        <button
          className={styles.boton}
          type="submit"
          disabled={
            guardando ||
            cargandoSesion ||
            !usuario ||
            cargandoOdontologos ||
            Boolean(errorOdontologos)
          }
        >
          {guardando ? "Registrando..." : "Registrar solicitud"}
        </button>

        {!cargandoSesion && !usuario && (
          <p className={styles.aviso}>
            <Link href="/cuenta">Inicia sesión en Mi cuenta</Link> para registrar tu solicitud y consultar su estado.
          </p>
        )}
      </form>
    </section>
  );
}
