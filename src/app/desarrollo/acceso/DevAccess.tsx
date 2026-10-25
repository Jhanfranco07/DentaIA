"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./access.module.css";

export default function DevAccess() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [status, setStatus] = useState("Comprobando configuración…");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      const client = getSupabaseBrowserClient();
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        if (active) setSessionEmail(session?.user.email ?? null);
      });
      void client.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        setSessionEmail(data.session?.user.email ?? null);
        setReady(!error);
        setStatus(error ? error.message : "Configuración disponible. Usa tu propia cuenta de prueba.");
      }).catch(() => { if (active) setStatus("No se pudo recuperar la sesión. Revisa la conexión."); });
      return () => { active = false; subscription.unsubscribe(); };
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Configuración no disponible.");
    }
    return () => { active = false; };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
      setPassword("");
      setStatus(error ? `No se pudo ingresar: ${error.message}` : "Sesión iniciada. Ya puedes probar tu módulo en este navegador.");
    } catch {
      setStatus("No se pudo conectar con Supabase. Revisa la configuración y la red.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut();
      setStatus(error ? error.message : "Sesión cerrada.");
    } catch { setStatus("No se pudo cerrar la sesión. Revisa la conexión."); }
    finally { setBusy(false); }
  }

  async function checkDirectory() {
    setBusy(true);
    try {
      const { data, error } = await getSupabaseBrowserClient().from("dentists").select("id");
      setStatus(error ? error.message : `Conexión real verificada: ${data.length} perfiles de demostración accesibles.`);
    } catch { setStatus("No se pudo consultar el directorio. Revisa la configuración y la red."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <h1>Acceso local del equipo</h1>
    <p>Herramienta de desarrollo disponible solo con npm run dev. No es el login final del producto.</p>
    <p>Las cuentas deben haber sido creadas previamente por el propietario siguiendo docs/DESARROLLO.md.</p>
    <p className={styles.status} role="status">{status}</p>
    {sessionEmail ? <><p>Sesión: {sessionEmail}</p><button disabled={busy} onClick={signOut}>Cerrar sesión</button></> :
      <form onSubmit={signIn} className={styles.form}>
        <label>Correo de prueba<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Contraseña<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button disabled={!ready || busy} type="submit">{busy ? "Procesando…" : "Iniciar sesión de prueba"}</button>
      </form>}
    <p><button disabled={!ready || busy} onClick={checkDirectory}>Comprobar conexión a la BD</button></p>
    <nav aria-label="Módulos" className={styles.links}>
      <Link href="/cuenta">Jhan · Cuenta</Link><Link href="/directorio">Angie · Directorio</Link>
      <Link href="/solicitudes">Anelis · Solicitudes</Link><Link href="/fotografias">Stephan · Fotografías</Link>
      <Link href="/">Volver al MVP</Link>
    </nav>
  </main>;
}
