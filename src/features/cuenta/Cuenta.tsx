"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { mensajeError, validarFormularioCuenta, type CampoCuenta } from "./validaciones";
import styles from "./cuenta.module.css";
import PerfilPaciente from "./PerfilPaciente";
import { useSesion } from "./useSesion";
import { useNombrePerfil } from "./useNombrePerfil";
import Link from "next/link";
import Encabezado from "@/components/Encabezado";
import Pie from "@/components/Pie";
import PortalShell from "@/components/PortalShell";
import { NAVEGACION_PACIENTE, NAVEGACION_ODONTOLOGO, NAVEGACION_ADMIN } from "@/components/navegacion-portal";
import { Icono } from "@/components/Identidad";
import { retornoSolicitud } from "@/lib/navegacion";
import { destinoEntradaPaciente } from "./destino-cuenta";
import { rolesDelUsuario, rutaPrincipalPorRoles } from "@/features/autorizacion/roles";
import { useRouter } from "next/navigation";

export default function Cuenta({ modoInicial = false, perfilSolicitado = false }: { modoInicial?: boolean; perfilSolicitado?: boolean }) {
  const { usuario, cargando, errorSesion, verificar } = useSesion();
  const router = useRouter();
  const roles = rolesDelUsuario(usuario);
  const operacion = useRef(false);
  const activo = useRef(true);
  const [registro, setRegistro] = useState(modoInicial);
  const [continuar, setContinuar] = useState<string | null>(null);
  const [continuarListo, setContinuarListo] = useState(false);
  useEffect(() => {
    setContinuar(retornoSolicitud(new URLSearchParams(window.location.search).get("continuar")));
    setContinuarListo(true);
  }, []);

  // El acceso público con una sesión de paciente ya activa abre el panel;
  // el perfil solicitado desde el menú sigue siendo editable.
  const destinoEntrada = continuarListo && !cargando && !errorSesion && usuario
    ? destinoEntradaPaciente(roles, perfilSolicitado, continuar) : null;
  useEffect(() => {
    if (destinoEntrada) router.replace(destinoEntrada);
  }, [destinoEntrada, router]);
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
        const verificado = await verificar();
        if (!activo.current) return;
        if (!verificado) {
          setError("No pudimos volver a confirmar tu sesión. Comprueba la conexión y vuelve a iniciar sesión.");
          return;
        }
        const rolesVerificados = rolesDelUsuario(verificado);
        const destino = rutaPrincipalPorRoles(rolesVerificados);
        if (!destino) {
          setError("La cuenta inició sesión, pero no tiene un rol DentaIA activo. Contacta con la administración.");
          return;
        }
        // El retorno de una solicitud solo aplica al paciente sin otros roles.
        const soloPaciente = rolesVerificados.length === 1 && rolesVerificados[0] === "paciente";
        router.replace(soloPaciente ? continuar ?? destino : destino);
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

  const etiquetaUsuario = useNombrePerfil(usuario);
  const otrosEspacios = [
    ...(roles.includes("superusuario") && roles.includes("odontologo") ? [{ href: "/profesional", titulo: "Espacio profesional" }] : []),
    ...(roles.includes("paciente") && (roles.includes("odontologo") || roles.includes("superusuario")) ? [{ href: "/panel", titulo: "Espacio del paciente" }] : []),
  ];
  const contenido = <section className={`${styles.pagina} ${usuario ? styles.paginaAutenticada : ""}`} aria-labelledby="cuenta-titulo">
    {usuario ? <header className={styles.cabeceraPerfil}>
      <span className={styles.avatarCuenta} aria-hidden="true">{etiquetaUsuario.slice(0, 1).toLocaleUpperCase("es")}</span>
      <div><span className={styles.etiqueta}>PERFIL DE CUENTA</span><h1 id="cuenta-titulo">Mi cuenta</h1><p>{etiquetaUsuario}<span aria-hidden="true"> · </span>{usuario.email ?? "Correo no disponible"}</p></div>
      <span className={styles.rolCuenta}>{roles.includes("superusuario") ? "Superadministrador" : roles.includes("odontologo") ? "Odontólogo" : roles.includes("paciente") ? "Paciente" : "Sin rol activo"}</span>
    </header> : <header className={styles.cabecera}><h1 id="cuenta-titulo">Accede a DentaIA</h1><p>Inicia sesión o crea tu cuenta para continuar.</p></header>}
    <div className={`${styles.panel} ${usuario ? styles.panelAutenticado : styles.panelPublico}`}>
      {!usuario && <aside className={styles.presentacion}><span className={styles.simbolo}><Icono size={32} /></span><h2>Tu cuidado bucal, en un solo lugar.</h2><p>Consulta tu perfil y las herramientas disponibles para tu cuenta.</p><span className={styles.nota}>El análisis automático está pendiente y no sustituye una evaluación odontológica.</span></aside>}
      <div className={styles.contenido}>
        {cargando ? <p role="status">Comprobando tu sesión…</p> : <>
          {error && <p id="cuenta-error" className={styles.error} role="alert">{error}</p>}
          {aviso && <p className={styles.aviso} role="status">{aviso}</p>}
          {errorSesion ? <><p className={styles.error} role="alert">{errorSesion}</p><button type="button" className={styles.boton} onClick={() => { void verificar(); }}>Volver a comprobar la sesión</button></> : usuario ? <>
            {continuar && roles.includes("paciente") && !roles.includes("odontologo") && !roles.includes("superusuario") && <div className="notice"><strong>Tu profesional sigue seleccionado.</strong><p>Ya puedes continuar con tu solicitud de demostración.</p><Link href={continuar} className="action">Continuar mi solicitud</Link></div>}
            {roles.includes("paciente") && <PerfilPaciente key={usuario.id} usuario={usuario} bloqueado={ocupado} />}
            {roles.length === 0 && <p role="alert" className={styles.error}>Esta cuenta no tiene un rol DentaIA activo.</p>}
            {otrosEspacios.length > 0 && <section className={styles.otrosEspacios} aria-label="Otros espacios de tu cuenta"><h2>Otros espacios autorizados</h2><p>Tu cuenta tiene más de un rol. Puedes cambiar de espacio sin cerrar sesión.</p>{otrosEspacios.map(({href,titulo}) => <Link key={href} href={href} className="text-link">{titulo} →</Link>)}</section>}
            {roles.length > 0 ? <p className={styles.nota}>Para cambiar de sección o cerrar sesión, utiliza la navegación de tu espacio. Los permisos de la cuenta se verifican en el servidor.</p>
              : <button className={styles.secundario} type="button" disabled={ocupado} onClick={() => { void cerrarSesion(); }}>{ocupado ? "Cerrando sesión…" : "Cerrar sesión"}</button>}
          </> : <>
            <div className={styles.opciones} aria-label="Opciones de acceso">
              <button type="button" aria-pressed={!registro} disabled={ocupado} onClick={() => cambiarModo(false)}>Iniciar sesión</button>
              <button type="button" aria-pressed={registro} disabled={ocupado} onClick={() => cambiarModo(true)}>Crear cuenta</button>
            </div>
            <h2>{registro ? "Crea tu cuenta" : "Inicia sesión"}</h2>
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
  if (destinoEntrada) return <main id="contenido" tabIndex={-1} className={styles.pagina}><p role="status">Abriendo tu panel…</p></main>;
  if (usuario && roles.length > 0) {
    const superusuario = roles.includes("superusuario");
    const odontologo = !superusuario && roles.includes("odontologo");
    return <PortalShell area={superusuario ? "Administración" : odontologo ? "Odontología" : "Paciente"} descripcion="Perfil y preferencias" enlaces={superusuario ? NAVEGACION_ADMIN : odontologo ? NAVEGACION_ODONTOLOGO : NAVEGACION_PACIENTE}>{contenido}</PortalShell>;
  }
  return <><Encabezado /><main id="contenido" tabIndex={-1}>{contenido}</main><Pie /></>;
}
