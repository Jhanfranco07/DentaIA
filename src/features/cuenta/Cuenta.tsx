"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { mensajeError, validarAcceso, validarRegistro } from "./validaciones";
import styles from "./cuenta.module.css";

export default function Cuenta() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);
  const [registro, setRegistro] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let activo = true;
    async function consultar() {
      try {
        const { data, error } = await getSupabaseBrowserClient().auth.getUser();
        if (!activo) return;
        if (error && error.name !== "AuthSessionMissingError") throw error;
        setUsuario(data.user);
      } catch (error) { if (activo) setError(mensajeError(error)); }
      finally { if (activo) setCargando(false); }
    }
    void consultar();
    return () => { activo = false; };
  }, []);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ocupado) return;
    setError(""); setAviso("");
    const invalido = registro ? validarRegistro(nombre, email, password, confirmacion) : validarAcceso(email, password);
    if (invalido) { setError(invalido); return; }
    setOcupado(true);
    try {
      const client = getSupabaseBrowserClient();
      const { data, error } = registro
        ? await client.auth.signUp({ email: email.trim(), password, options: { data: { full_name: nombre.trim() } } })
        : await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (data.session) {
        const resultado = await client.auth.getUser();
        if (resultado.error) throw resultado.error;
        setUsuario(resultado.data.user);
        setAviso("Sesión iniciada correctamente.");
      } else {
        setAviso("Si el registro puede completarse, recibirás un correo de confirmación. Revisa tu bandeja de entrada y spam, confirma el correo y vuelve para iniciar sesión.");
        setRegistro(false);
      }
    } catch (error) { setError(mensajeError(error)); }
    finally { setPassword(""); setConfirmacion(""); setOcupado(false); }
  }

  return <section className={styles.pagina} aria-labelledby="cuenta-titulo">
    <header className={styles.cabecera}><span className={styles.etiqueta}>TU ESPACIO EN DENTAIA</span><h1 id="cuenta-titulo">Tu cuenta, cerca de ti.</h1><p>Accede a tu espacio personal para continuar tu recorrido de orientación bucal.</p></header>
    <div className={styles.panel}>
      <aside className={styles.presentacion}><span className={styles.simbolo} aria-hidden="true">✦</span><h2>Una sonrisa más informada empieza contigo.</h2><p>Tu cuenta te acompaña en cada visita. Mantén tus datos a mano y vuelve cuando lo necesites.</p><span className={styles.nota}>Prototipo académico · Usa datos de demostración.</span></aside>
      <div className={styles.contenido}>
        {cargando ? <p role="status">Comprobando tu sesión…</p> : <>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {aviso && <p className={styles.aviso} role="status">{aviso}</p>}
          {usuario ? <><span className={styles.estado}>Sesión activa</span><h2>Bienvenido a tu cuenta</h2><p>{usuario.email}</p></> : <>
            <div className={styles.opciones} aria-label="Opciones de acceso">
              <button type="button" aria-pressed={!registro} disabled={ocupado} onClick={() => { setRegistro(false); setError(""); setAviso(""); setPassword(""); setConfirmacion(""); }}>Iniciar sesión</button>
              <button type="button" aria-pressed={registro} disabled={ocupado} onClick={() => { setRegistro(true); setError(""); setAviso(""); setPassword(""); setConfirmacion(""); }}>Crear cuenta</button>
            </div>
            <h2>{registro ? "Crea tu cuenta" : "Qué bueno verte de nuevo"}</h2>
            <form className={styles.formulario} onSubmit={enviar} noValidate aria-busy={ocupado}>
              <fieldset disabled={ocupado}>
                {registro && <label>Nombre completo<input name="nombre" autoComplete="name" required minLength={2} maxLength={120} value={nombre} onChange={e => setNombre(e.target.value)} /></label>}
                <label>Correo electrónico<input name="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
                <label>Contraseña<input name="password" type="password" autoComplete={registro ? "new-password" : "current-password"} required value={password} onChange={e => setPassword(e.target.value)} aria-describedby={registro ? "password-ayuda" : undefined} /></label>
                {registro && <><small id="password-ayuda">Al menos 8 caracteres. También se aplican las reglas de seguridad del servicio.</small><label>Confirmar contraseña<input name="confirmacion" type="password" autoComplete="new-password" required value={confirmacion} onChange={e => setConfirmacion(e.target.value)} /></label></>}
                <button className={styles.boton} type="submit">{ocupado ? "Procesando…" : registro ? "Registrarme" : "Entrar a mi cuenta"}</button>
              </fieldset>
            </form>
          </>}
        </>}
      </div>
    </div>
  </section>;
}
