"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AVISO_DEMO, CASOS } from "@/features/analisis/casos";
import { CLAVE_SESION_DEMO, ETAPAS, leerSesionDemo } from "@/features/analisis/flujo";
import { resolverReporte } from "./logica";
import EstadoPanel from "./EstadoPanel";
import styles from "./panel.module.css";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "sin-reporte" }
  | { tipo: "con-reporte"; titulo: string; fecha: string; recomendaciones: readonly string[] };

function leerAlmacenamiento(): string | null {
  for (const nombre of ["sessionStorage", "localStorage"] as const) {
    try {
      const texto = window[nombre].getItem(CLAVE_SESION_DEMO);
      if (texto) return texto;
    } catch {
      /* El almacenamiento puede estar bloqueado: se trata como ausencia de reporte. */
    }
  }
  return null;
}

export default function ReporteDemo() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    const sesion = leerSesionDemo(leerAlmacenamiento(), CASOS.map((c) => c.id));
    const reporte = resolverReporte(sesion, CASOS, ETAPAS, "recomendaciones");
    if (reporte.tipo === "sin-reporte") {
      setEstado({ tipo: "sin-reporte" });
      return;
    }
    setEstado({
      tipo: "con-reporte",
      titulo: reporte.titulo,
      fecha: new Date(reporte.fechaISO).toLocaleDateString("es-PE"),
      recomendaciones: reporte.recomendaciones,
    });
  }, []);

  if (estado.tipo === "cargando") return null;

  if (estado.tipo === "sin-reporte") {
    return (
      <EstadoPanel
        tipo="vacio"
        titulo="Todavía no hay un reporte de demostración."
        accion={<Link href="/analisis/demo" className={styles.enlace}>Explorar el análisis de ejemplo →</Link>}
      >
        Completa el recorrido de ejemplo hasta las recomendaciones para verlas aquí.
      </EstadoPanel>
    );
  }

  return (
    <section aria-labelledby="reporte-titulo" className={styles.resumen}>
      <h2 id="reporte-titulo">Recomendaciones de la demostración</h2>
      <p>
        <strong>{AVISO_DEMO}.</strong> Caso: {estado.titulo} · {estado.fecha}
      </p>
      <ul className={styles.recomendaciones}>
        {estado.recomendaciones.map((r) => <li key={r}>{r}</li>)}
      </ul>
      <p>
        Es una muestra educativa guardada solo en este navegador. No es un resultado de tu cuenta ni un diagnóstico.
      </p>
      <Link href="/analisis/demo" className={styles.enlace}>Ver el recorrido de ejemplo →</Link>
    </section>
  );
}