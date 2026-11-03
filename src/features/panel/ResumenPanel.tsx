"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSesion } from "@/features/cuenta/useSesion";
import { leerPerfil } from "@/features/cuenta/perfiles";
import { obtenerMisSolicitudes } from "@/features/solicitudes/solicitudes";
import EstadoPanel from "./EstadoPanel";
import styles from "./panel.module.css";

type Datos = { nombre: string | null; fotos: number; solicitudes: number; pendientes: number };
type Estado =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "listo"; datos: Datos };

export default function ResumenPanel() {
  const { usuario, cargando: cargandoSesion, errorSesion, verificar } = useSesion();
  const usuarioId = usuario?.id ?? null;
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!usuarioId) return;
    let cancelado = false;
    setEstado({ tipo: "cargando" });

    async function cargar(id: string) {
      try {
        const client = getSupabaseBrowserClient();
        const [perfil, solicitudes, fotos] = await Promise.all([
          leerPerfil(client, id),
          obtenerMisSolicitudes(client, id),
          client.from("dental_photos").select("id", { count: "exact", head: true }).eq("user_id", id),
        ]);
        if (fotos.error) throw fotos.error;
        if (cancelado) return;
        setEstado({
          tipo: "listo",
          datos: {
            nombre: perfil?.full_name ?? null,
            fotos: fotos.count ?? 0,
            solicitudes: solicitudes.length,
            pendientes: solicitudes.filter((s) => s.status === "requested").length,
          },
        });
      } catch {
        if (!cancelado) setEstado({ tipo: "error" });
      }
    }

    void cargar(usuarioId);
    return () => { cancelado = true; };
  }, [usuarioId, intento]);

  if (cargandoSesion) {
    return <EstadoPanel tipo="cargando" titulo="Comprobando tu sesión…" />;
  }

  if (errorSesion) {
    return (
      <EstadoPanel
        tipo="error"
        titulo="No pudimos comprobar tu sesión."
        accion={<button type="button" className={styles.boton} onClick={() => void verificar()}>Reintentar</button>}
      >
        Revisa tu conexión y vuelve a intentarlo.
      </EstadoPanel>
    );
  }

  if (!usuario) {
    return (
      <EstadoPanel
        tipo="vacio"
        titulo="Inicia sesión para ver tu resumen."
        accion={<Link href="/cuenta" className={styles.enlace}>Ir a mi cuenta →</Link>}
      >
        Tu resumen solo muestra información de tu propia cuenta.
      </EstadoPanel>
    );
  }

  if (estado.tipo === "cargando") {
    return <EstadoPanel tipo="cargando" titulo="Cargando tu resumen…" />;
  }

  if (estado.tipo === "error") {
    return (
      <EstadoPanel
        tipo="error"
        titulo="No pudimos cargar tu resumen."
        accion={<button type="button" className={styles.boton} onClick={() => setIntento((n) => n + 1)}>Reintentar</button>}
      >
        Revisa tu conexión y vuelve a intentarlo.
      </EstadoPanel>
    );
  }

  const { nombre, fotos, solicitudes, pendientes } = estado.datos;
  return (
    <section aria-labelledby="resumen-titulo" className={styles.resumen}>
      <h2 id="resumen-titulo">Tu resumen</h2>
      <p>{nombre ? `Hola, ${nombre}.` : "Todavía no registraste tu nombre en tu perfil."}</p>
      <dl className={styles.datos}>
        <div><dt>Fotografías guardadas</dt><dd>{fotos}</dd></div>
        <div><dt>Solicitudes de demostración</dt><dd>{solicitudes}</dd></div>
        <div><dt>Solicitudes pendientes</dt><dd>{pendientes}</dd></div>
      </dl>
    </section>
  );
}