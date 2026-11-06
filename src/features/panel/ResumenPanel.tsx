"use client";
import { contarSolicitudes } from "./logica";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSesion } from "@/features/cuenta/useSesion";
import { obtenerMisSolicitudes } from "@/features/solicitudes/solicitudes";
import TarjetaMetrica from "@/components/TarjetaMetrica";
import EstadoPanel from "./EstadoPanel";
import styles from "./panel.module.css";

type Datos = { fotos: number; solicitudes: number; pendientes: number };
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
        const [solicitudes, fotos] = await Promise.all([
          obtenerMisSolicitudes(client, id),
          client.from("dental_photos").select("id", { count: "exact", head: true }).eq("user_id", id),
        ]);
        if (fotos.error) throw fotos.error;
        if (cancelado) return;
        setEstado({
          tipo: "listo",
          datos: {
            fotos: fotos.count ?? 0,
            ...contarSolicitudes(solicitudes),
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
    return <div className={styles.estadoResumen}><EstadoPanel tipo="cargando" titulo="Comprobando tu sesión…" /></div>;
  }

  if (errorSesion) {
    return (
      <div className={styles.estadoResumen}>
      <EstadoPanel
        tipo="error"
        titulo="No pudimos comprobar tu sesión."
        accion={<button type="button" className={styles.boton} onClick={() => void verificar()}>Reintentar</button>}
      >
        Revisa tu conexión y vuelve a intentarlo.
      </EstadoPanel></div>
    );
  }

  if (!usuario) {
    return (
      <div className={styles.estadoResumen}>
      <EstadoPanel
        tipo="vacio"
        titulo="Inicia sesión para ver tu resumen."
        accion={<Link href="/cuenta" className={styles.enlace}>Ir a mi cuenta →</Link>}
      >
        Tu resumen solo muestra información de tu propia cuenta.
      </EstadoPanel></div>
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

  const { fotos, solicitudes, pendientes } = estado.datos;
  return (
    <section aria-label="Indicadores de tu actividad" className={styles.resumen}>
      <div className={styles.metricas} aria-label="Resumen de tu cuenta">
        <TarjetaMetrica titulo="Fotografías guardadas" valor={fotos} contexto="En tu espacio personal" icono="camara" />
        <TarjetaMetrica titulo="Solicitudes registradas" valor={solicitudes} contexto="Historial de solicitudes" icono="calendario" />
        <TarjetaMetrica titulo="Solicitudes pendientes" valor={pendientes} contexto="Por atender" icono="reloj" />
      </div>
    </section>
  );
}
