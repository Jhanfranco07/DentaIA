"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { guardarPerfil, leerPerfil, type Perfil } from "./perfiles";
import { mensajeError, validarNombre } from "./validaciones";
import styles from "./cuenta.module.css";

export default function PerfilPaciente({ usuario, bloqueado }: { usuario: User; bloqueado: boolean }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [intento, setIntento] = useState(0);
  const [disponible, setDisponible] = useState(false);
  const operacion = useRef(false);
  const vigente = useRef(0);

  useEffect(() => {
    const version = ++vigente.current;
    setCargando(true); setDisponible(false); setError(""); setPerfil(null); setNombre("");
    async function cargar() {
      try {
        const client = getSupabaseBrowserClient();
        let actual = await leerPerfil(client, usuario.id);
        if (version !== vigente.current) return;
        // Los metadatos solo sirven para el nombre inicial, nunca para autorizar.
        const inicial = usuario.user_metadata?.full_name;
        if (!actual && typeof inicial === "string" && !validarNombre(inicial)) {
          actual = await guardarPerfil(client, usuario.id, inicial, true);
        }
        if (version !== vigente.current) return;
        setPerfil(actual); setNombre(actual?.full_name ?? ""); setDisponible(true);
      } catch (error) { if (version === vigente.current) setError(mensajeError(error)); }
      finally { if (version === vigente.current) setCargando(false); }
    }
    void cargar();
    return () => { vigente.current++; };
  }, [usuario.id, usuario.user_metadata?.full_name, intento]);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operacion.current || !disponible || bloqueado) return;
    setError(""); setAviso("");
    const invalido = validarNombre(nombre);
    if (invalido) { setError(invalido); return; }
    const version = vigente.current;
    operacion.current = true; setGuardando(true);
    try {
      const actualizado = await guardarPerfil(getSupabaseBrowserClient(), usuario.id, nombre, !perfil);
      if (version !== vigente.current) return;
      setPerfil(actualizado); setNombre(actualizado.full_name);
      setAviso("Tu nombre quedó guardado. Lo encontrarás aquí cuando vuelvas.");
    } catch (error) { if (version === vigente.current) setError(mensajeError(error)); }
    finally { operacion.current = false; if (version === vigente.current) setGuardando(false); }
  }

  return <section aria-labelledby="perfil-titulo">
    <span className={styles.estado}>Sesión activa</span>
    <h2 id="perfil-titulo">Mi perfil</h2>
    <dl className={styles.datos}><div><dt>Correo electrónico</dt><dd>{usuario.email ?? "Sin correo disponible"}</dd></div><div><dt>Nombre guardado</dt><dd>{cargando ? "Consultando…" : perfil?.full_name ?? "Todavía no registrado"}</dd></div></dl>
    {cargando ? <p role="status">Consultando tu perfil…</p> : <>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {aviso && <p role="status" className={styles.aviso}>{aviso}</p>}
      {!disponible ? <button type="button" disabled={bloqueado} className={styles.boton} onClick={() => setIntento(i => i + 1)}>Volver a consultar mi perfil</button> : <>
        {!perfil && <p className={styles.nota}>Completa tu nombre para crear tu perfil personal.</p>}
        <form onSubmit={guardar} className={styles.formulario} noValidate aria-busy={guardando}>
          <fieldset disabled={guardando || bloqueado}><label>Nombre completo<input name="full_name" autoComplete="name" required minLength={2} maxLength={120} value={nombre} onChange={e => setNombre(e.target.value)} aria-describedby="nombre-ayuda" /></label><small id="nombre-ayuda">Entre 2 y 120 caracteres. Tu correo no se modifica desde este formulario.</small><button type="submit" className={styles.boton}>{guardando ? "Guardando…" : perfil ? "Guardar cambios" : "Crear mi perfil"}</button></fieldset>
        </form>
      </>}
    </>}
  </section>;
}
