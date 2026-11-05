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

export default function PortalShell({ area, descripcion, enlaces, children }: {
  area: string;
  descripcion: string;
  enlaces: readonly EnlacePortal[];
  children: ReactNode;
}) {
  const ruta = usePathname();
  const router = useRouter();
  const { usuario } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [movil, setMovil] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState("");
  const boton = useRef<HTMLButtonElement>(null);
  const pagina = enlaces.find(({ href, exacto }) => exacto ? ruta === href : ruta === href || ruta.startsWith(`${href}/`));
  const nombre = usuario?.user_metadata?.full_name;
  const nombreUsuario = typeof nombre === "string" && nombre.trim() ? nombre.trim() : usuario?.email?.split("@")[0] ?? "Cuenta";
  const roles = rolesDelUsuario(usuario);

  useEffect(() => setAbierto(false), [ruta]);
  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 760px)");
    const actualizar = () => { setMovil(consulta.matches); setAbierto(false); };
    actualizar();
    consulta.addEventListener("change", actualizar);
    return () => consulta.removeEventListener("change", actualizar);
  }, []);
  useEffect(() => {
    if (!abierto) return;
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setAbierto(false); boton.current?.focus(); }
    };
    document.addEventListener("keydown", cerrarConEscape);
    return () => document.removeEventListener("keydown", cerrarConEscape);
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
  return <div className={styles.shell}>
    <aside id="navegacion-portal" className={styles.lateral} data-abierto={abierto} aria-hidden={movil && !abierto} inert={movil && !abierto ? true : undefined} aria-label={`Navegación del portal ${area}`}>
      <div className={styles.cabeceraLateral}><Link href="/" className={styles.marca} aria-label="DentaIA, página de inicio"><Marca /></Link><button type="button" className={styles.cerrarMenu} aria-label="Cerrar navegación" onClick={() => { setAbierto(false); boton.current?.focus(); }}><Icono nombre="cerrar" size={18} /></button></div>
      <div className={styles.portalMarca}><span className={styles.portalIcono}><Icono nombre={area === "Odontología" ? "diente" : area === "Administración" ? "escudo" : "persona"} size={19} /></span><div><strong>{area}</strong><span>Espacio de trabajo</span></div></div>
      <p className={styles.tituloNavegacion}>Menú principal</p>
      <nav aria-label={`Secciones de ${area}`}>
        {enlaces.map(({ href, etiqueta, exacto, icono, grupo }) => {
          const activo = exacto ? ruta === href : ruta === href || ruta.startsWith(`${href}/`);
          const encabezadoGrupo = grupo && grupo !== grupoAnterior;
          if (grupo) grupoAnterior = grupo;
          return <span className={styles.itemNavegacion} key={href}>
            {encabezadoGrupo && <span className={styles.grupo}>{grupo}</span>}
            <Link href={href} aria-current={activo ? "page" : undefined} className={styles.enlace}>
              <Icono nombre={icono ?? "flecha"} size={18} /><span>{etiqueta}</span>{activo && <span className={styles.marcaActiva} aria-hidden="true" />}
            </Link>
          </span>;
        })}
      </nav>
      <div className={styles.pieLateral}><span className={styles.estadoPrivado}><span aria-hidden="true" /> Sesión protegida</span><Link href="/" className={styles.volver}>Ir a DentaIA pública <Icono nombre="enlace" size={15} /></Link></div>
    </aside>
    {abierto && <button type="button" className={styles.fondoMovil} aria-label="Cerrar menú" onClick={() => { setAbierto(false); boton.current?.focus(); }} />}
    <div className={styles.areaPrincipal}>
      <header className={styles.encabezado}>
        <button ref={boton} type="button" className={styles.botonMenu} aria-expanded={abierto} aria-controls="navegacion-portal" aria-label={abierto ? "Cerrar navegación" : "Abrir navegación"} onClick={() => setAbierto(valor => !valor)}>
          <Icono nombre={abierto ? "cerrar" : "menu"} size={20} />
        </button>
        <div className={styles.tituloPagina}><span>{descripcion}</span><strong>{pagina?.etiqueta ?? area}</strong></div>
        <div className={styles.usuario}><span className={styles.avatar} aria-hidden="true">{nombreUsuario.slice(0, 1).toLocaleUpperCase("es")}</span><span className={styles.usuarioDatos}><strong>{nombreUsuario}</strong><span>{etiquetaRol(roles)}</span></span></div>
        <Link href="/cuenta" className={styles.cuenta}><Icono nombre="persona" size={17} /><span>Mi cuenta</span></Link>
        <button type="button" className={styles.salir} onClick={() => { void cerrarSesion(); }} disabled={saliendo}>
          <Icono nombre="salir" size={17} /><span>{saliendo ? "Cerrando…" : "Salir"}</span>
        </button>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <main id="contenido" tabIndex={-1} className={styles.contenido}>{children}</main>
    </div>
  </div>;
}
