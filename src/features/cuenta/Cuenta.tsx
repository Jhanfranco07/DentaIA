"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { mensajeError, validarFormularioCuenta, type CampoCuenta } from "./validaciones";
import styles from "./cuenta.module.css";
import PerfilPaciente from "./PerfilPaciente";
import { useSesion } from "./useSesion";
import Link from "next/link";
import { Icono } from "@/components/Identidad";

export default function Cuenta({ modoInicial = false }: { modoInicial?: boolean }) {
  const { usuario, cargando, errorSesion, verificar } = useSesion();
  const operacion = useRef(false);
  const activo = useRef(true);
  const [registro, setRegistro] = useState(modoInicial);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [campoInvalido, setCampoInvalido] = useState<CampoCuenta | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    activo.current = true;
    return () => { activo.current = false; };
  }, []);

  useEffect(() => {
    // No conservar formularios ni mensajes de otra sesión.
    setNombre(""); setEmail(""); setPassword(""); setConfirmacion("");
    setError(""); setAviso(""); setCampoInvalido(null);
  }, [usuario?.id]);

  function limpiarValidacion(campo: CampoCuenta) {
    if (campoInvalido === campo) { setCampoInvalido(null); setError(""); }
  }

  function cambiarModo(crear: boolean) {
    setRegistro(crear); setError(""); setAviso(""); setCampoInvalido(null);
    setPassword(""); setConfirmacion("");
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operacion.current || cargando || errorSesion) return;
    setError(""); setAviso(""); setCampoInvalido(null);
    const invalido = validarFormularioCuenta({ registro, nombre, email, password, confirmacion });
    if (invalido) {
      setError(invalido.mensaje); setCampoInvalido(invalido.campo);
      const campo = event.currentTarget.elements.namedItem(invalido.campo);
      if (campo instanceof HTMLInputElement) campo.focus();
      return;
    }
    operacion.current = true; setOcupado(true);
    try {
      const client = getSupabaseBrowserClient();
      const { data, error } = registro
        ? await client.auth.signUp({ email: email.trim(), password, options: { data: { full_name: nombre.trim() } } })
        : await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!activo.current) return;
      if (data.session) {
        await verificar();
      } else {
        setAviso("Si el registro puede completarse, recibirás un correo de confirmación. Revisa tu bandeja de entrada y spam, confirma el correo y vuelve para iniciar sesión.");
        setRegistro(false);
      }
    } catch (error) { if (activo.current) setError(mensajeError(error)); }
    finally {
      operacion.current = false;
      if (activo.current) { setPassword(""); setConfirmacion(""); setOcupado(false); }
    }
  }

  async function cerrarSesion() {
    if (operacion.current) return;
    operacion.current = true; setOcupado(true); setError(""); setAviso("");
    try {
      // Cierra este navegador sin interrumpir otras sesiones de la cuenta compartida.
      const { error } = await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      await verificar();
      if (activo.current) { setRegistro(false); setAviso("Cerraste tu sesión en este navegador."); }
    } catch (error) { if (activo.current) setError(mensajeError(error)); }
    finally { operacion.current = false; if (activo.current) setOcupado(false); }
  }

  return <section className={styles.pagina} aria-labelledby="cuenta-titulo">
    <header className={styles.cabecera}><span className={styles.etiqueta}>TU ESPACIO EN DENTAIA</span><h1 id="cuenta-titulo">Mi cuenta</h1><p>Tu perfil, tus fotografías de prueba y el seguimiento de tus solicitudes, en un solo lugar.</p></header>
    <div className={styles.panel}>
      <aside className={styles.presentacion}><span className={styles.simbolo}><Icono size={32}/></span><h2>Una sonrisa más informada empieza contigo.</h2><p>Conserva tus datos a mano y continúa tu recorrido cuando lo necesites.</p><span className={styles.nota}>Esta versión utiliza profesionales ficticios e imágenes de prueba. La demostración no reemplaza la atención odontológica.</span><Link href="/analisis/demo" className="text-link">Conocer la demostración</Link></aside>
      <div className={styles.contenido}>
        {cargando ? <p role="status">Comprobando tu sesión…</p> : <>
          {error && <p id="cuenta-error" className={styles.error} role="alert">{error}</p>}
          {aviso && <p className={styles.aviso} role="status">{aviso}</p>}
          {errorSesion ? <><p className={styles.error} role="alert">{errorSesion}</p><button type="button" className={styles.boton} onClick={() => { void verificar(); }}>Volver a comprobar la sesión</button></> : usuario ? <>
            <PerfilPaciente key={usuario.id} usuario={usuario} bloqueado={ocupado} />
            <nav aria-label="Continuar mi recorrido" className={styles.accesos}><Link href="/analisis/demo">Explorar la demostración</Link><Link href="/fotografias">Mis fotografías</Link><Link href="/solicitudes">Mis solicitudes</Link></nav>
            <button className={styles.secundario} type="button" disabled={ocupado} onClick={() => { void cerrarSesion(); }}>{ocupado ? "Cerrando sesión…" : "Cerrar sesión"}</button>
          </> : <>
            <div className={styles.opciones} aria-label="Opciones de acceso">
              <button type="button" aria-pressed={!registro} disabled={ocupado} onClick={() => cambiarModo(false)}>Iniciar sesión</button>
              <button type="button" aria-pressed={registro} disabled={ocupado} onClick={() => cambiarModo(true)}>Crear cuenta</button>
            </div>
            <h2>{registro ? "Crea tu cuenta" : "Qué bueno verte de nuevo"}</h2>
            <form className={styles.formulario} onSubmit={enviar} noValidate aria-busy={ocupado}>
              <fieldset disabled={ocupado}>
                {registro && <label>Nombre completo<input name="nombre" autoComplete="name" required minLength={2} maxLength={120} value={nombre} aria-invalid={campoInvalido === "nombre" || undefined} aria-describedby={campoInvalido === "nombre" ? "cuenta-error" : undefined} onChange={e => { setNombre(e.target.value); limpiarValidacion("nombre"); }} /></label>}
                <label>Correo electrónico<input name="email" type="email" autoComplete="username" required value={email} aria-invalid={campoInvalido === "email" || undefined} aria-describedby={campoInvalido === "email" ? "cuenta-error" : undefined} onChange={e => { setEmail(e.target.value); limpiarValidacion("email"); }} /></label>
                <label>Contraseña<input name="password" type="password" autoComplete={registro ? "new-password" : "current-password"} required value={password} onChange={e => { setPassword(e.target.value); limpiarValidacion("password"); }} aria-invalid={campoInvalido === "password" || undefined} aria-describedby={[registro ? "password-ayuda" : "", campoInvalido === "password" ? "cuenta-error" : ""].filter(Boolean).join(" ") || undefined} /></label>
                {registro && <><small id="password-ayuda">Al menos 8 caracteres. También se aplican las reglas de seguridad del servicio.</small><label>Confirmar contraseña<input name="confirmacion" type="password" autoComplete="new-password" required value={confirmacion} aria-invalid={campoInvalido === "confirmacion" || undefined} aria-describedby={campoInvalido === "confirmacion" ? "cuenta-error" : undefined} onChange={e => { setConfirmacion(e.target.value); limpiarValidacion("confirmacion"); }} /></label></>}
                <button className={styles.boton} type="submit">{ocupado ? "Procesando…" : registro ? "Registrarme" : "Entrar a mi cuenta"}</button>
              </fieldset>
            </form>
          </>}
        </>}
      </div>
    </div>
  </section>;
}
