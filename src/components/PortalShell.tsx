"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { rolesDelUsuario } from "@/features/autorizacion/roles";
import { useSesion } from "@/features/cuenta/useSesion";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Icono, Marca, type NombreIcono } from "./Identidad";
import styles from "./portal-shell.module.css";

export type EnlacePortal = { href: string; etiqueta: string; exacto?: boolean; icono?: NombreIcono; grupo?: string };

function etiquetaRol(roles: string[]) {
  if (roles.includes("superusuario")) return "Superadministrador";
  if (roles.includes("odontologo")) return "Odontólogo";
  if (roles.includes("paciente")) return "Paciente";
  return "Cuenta DentaIA";
}

export default function PortalShell({ area, descripcion, enlaces, children, mostrarCuentaHeader = true }: {
  area: string;
  descripcion: string;
  enlaces: readonly EnlacePortal[];
  children: ReactNode;
  mostrarCuentaHeader?: boolean;
}) {
  const ruta = usePathname();
  const router = useRouter();
  const { usuario } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [tema, setTema] = useState<"claro" | "oscuro">("claro");
  const [movil, setMovil] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState("");
  const boton = useRef<HTMLButtonElement>(null);
  const lateral = useRef<HTMLElement>(null);
  const seccionPendiente = useRef<string | null>(null);
  const [fragmento, setFragmento] = useState("");
  const hrefActual = enlaces.find(e => e.href === ruta + fragmento)?.href;
  const pagina = enlaces.find(e => e.href === hrefActual) ?? enlaces.find(({ href, exacto }) => exacto ? ruta === href : ruta === href || ruta.startsWith(`${href}/`));
  const nombre = usuario?.user_metadata?.full_name;
  const nombreUsuario = typeof nombre === "string" && nombre.trim() ? nombre.trim() : usuario?.email?.split("@")[0] ?? "Cuenta";
  const roles = rolesDelUsuario(usuario);

  useEffect(() => {
    if (area !== "Paciente") return;
    try {
      const guardado = window.localStorage.getItem("dentaia-tema-paciente");
      if (guardado === "claro" || guardado === "oscuro") setTema(guardado);
      else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTema("oscuro");
    } catch { /* Preferencia opcional. */ }
  }, [area]);
  function alternarTema() {
    setTema(actual => {
      const siguiente = actual === "claro" ? "oscuro" : "claro";
      try { window.localStorage.setItem("dentaia-tema-paciente", siguiente); } catch { /* Opcional. */ }
      return siguiente;
    });
  }
  useEffect(() => {
    const actualizar = () => { setFragmento(window.location.hash); setAbierto(false); };
    actualizar(); window.addEventListener("hashchange", actualizar);
    return () => window.removeEventListener("hashchange", actualizar);
  }, [ruta]);
  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 760px)");
    const actualizar = () => { setMovil(consulta.matches); setAbierto(false); };
    actualizar();
    consulta.addEventListener("change", actualizar);
    return () => consulta.removeEventListener("change", actualizar);
  }, []);
  useEffect(() => {
    if (!abierto || !movil) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lateral.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const teclado = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setAbierto(false); boton.current?.focus(); }
      if (event.key === "Tab") {
        const controles = lateral.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
        if (!controles?.length) return;
        const primero = controles[0], ultimo = controles[controles.length - 1];
        if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo.focus(); }
        else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero.focus(); }
      }
    };
    document.addEventListener("keydown", teclado);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", teclado); boton.current?.focus(); };
  }, [abierto, movil]);

  useEffect(() => {
    if (abierto || !seccionPendiente.current) return;
    const destino = document.getElementById(seccionPendiente.current);
    seccionPendiente.current = null;
    destino?.focus({ preventScroll: true });
  }, [abierto]);

  async function cerrarSesion() {
    if (saliendo) return;
    setSaliendo(true); setError("");
    try {
      const { error: errorAuth } = await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
      if (errorAuth) throw errorAuth;
      router.replace("/cuenta");
      router.refresh();
    } catch {
      setError("No se pudo cerrar la sesión en este navegador. Vuelve a intentarlo.");
      setSaliendo(false);
    }
  }

  let grupoAnterior = "";
  return <div className={styles.shell} data-area={area} data-tema={area === "Paciente" ? tema : undefined}>
    <aside ref={lateral} id="navegacion-portal" className={styles.lateral} data-abierto={abierto} aria-hidden={movil && !abierto} inert={movil && !abierto ? true : undefined} aria-label={`Navegación del portal ${area}`}>
      <div className={styles.cabeceraLateral}><Link href="/" className={styles.marca} aria-label="DentaIA, página de inicio"><Marca /></Link><button type="button" className={styles.cerrarMenu} aria-label="Cerrar navegación" onClick={() => { setAbierto(false); boton.current?.focus(); }}><Icono nombre="cerrar" size={18} /></button></div>
      <div className={styles.portalMarca}><span className={styles.portalIcono}><Icono nombre={area === "Odontología" ? "diente" : area === "Administración" ? "escudo" : "persona"} size={19} /></span><div><strong>{area}</strong><span>Espacio de trabajo</span></div></div>
      <p className={styles.tituloNavegacion}>Menú principal</p>
      <nav aria-label={`Secciones de ${area}`}>
        {enlaces.map(({ href, etiqueta, exacto, icono, grupo }) => {
          const activo = hrefActual ? href === hrefActual : exacto ? ruta === href : ruta === href || ruta.startsWith(`${href}/`);
          const encabezadoGrupo = grupo && grupo !== grupoAnterior;
          if (grupo) grupoAnterior = grupo;
          return <span className={styles.itemNavegacion} key={href}>
            {encabezadoGrupo && <span className={styles.grupo}>{grupo}</span>}
            <Link href={href} onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              const [paginaDestino, ancla] = href.split("#");
              if (paginaDestino === ruta) {
                setFragmento(ancla ? `#${ancla}` : "");
                if (area === "Odontología" && abierto) {
                  seccionPendiente.current = ancla || "contenido";
                }
              }
              setAbierto(false);
            }} aria-current={activo ? "page" : undefined} className={styles.enlace}>
              <Icono nombre={icono ?? "flecha"} size={18} /><span>{etiqueta}</span>{activo && <span className={styles.marcaActiva} aria-hidden="true" />}
            </Link>
          </span>;
        })}
      </nav>
      <div className={styles.pieLateral}><span className={styles.estadoPrivado}><span aria-hidden="true" /> Acceso sujeto a permisos</span><Link href="/" className={styles.volver}>Ir a DentaIA pública <Icono nombre="enlace" size={15} /></Link></div>
    </aside>
    {abierto && <button type="button" className={styles.fondoMovil} aria-label="Cerrar menú" onClick={() => { setAbierto(false); boton.current?.focus(); }} />}
    <div className={styles.areaPrincipal} inert={movil && abierto ? true : undefined}>
      <header className={styles.encabezado}>
        <button ref={boton} type="button" className={styles.botonMenu} aria-expanded={abierto} aria-controls="navegacion-portal" aria-label={abierto ? "Cerrar navegación" : "Abrir navegación"} onClick={() => setAbierto(valor => !valor)}>
          <Icono nombre={abierto ? "cerrar" : "menu"} size={20} />
        </button>
        <div className={styles.tituloPagina}><span>{descripcion}</span><strong>{pagina?.etiqueta ?? area}</strong></div>
        <div className={styles.usuario}><span className={styles.avatar} aria-hidden="true">{nombreUsuario.slice(0, 1).toLocaleUpperCase("es")}</span><span className={styles.usuarioDatos}><strong>{nombreUsuario}</strong><span>{etiquetaRol(roles)}</span></span></div>
        {area === "Paciente" && <button type="button" className={styles.temaBoton} onClick={alternarTema} aria-pressed={tema === "oscuro"} aria-label={tema === "oscuro" ? "Activar modo claro celeste" : "Activar modo oscuro morado"} title={tema === "oscuro" ? "Modo claro" : "Modo oscuro"}><span aria-hidden="true">{tema === "oscuro" ? "☀" : "☾"}</span><span>{tema === "oscuro" ? "Claro" : "Oscuro"}</span></button>}
        {mostrarCuentaHeader && !enlaces.some(e => e.href === "/cuenta") && <Link href="/cuenta" className={styles.cuenta}><Icono nombre="persona" size={17} /><span>Mi cuenta</span></Link>}
        <button type="button" className={styles.salir} aria-label={saliendo ? "Cerrando sesión" : "Cerrar sesión"} onClick={() => { void cerrarSesion(); }} disabled={saliendo}>
          <Icono nombre="salir" size={17} /><span>{saliendo ? "Cerrando…" : "Salir"}</span>
        </button>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <main id="contenido" tabIndex={-1} className={styles.contenido}>{children}</main>
    </div>
  </div>;
}
