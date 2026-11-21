"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icono } from "./Identidad";
import styles from "./entrada-dentaia.module.css";

const CLAVE_ENTRADA = "dentaia-entrada-v1";

/** Entrada de marca: el anillo es decorativo, no representa progreso de red. */
export default function EntradaDentaIA() {
  const dialogo = useRef<HTMLDialogElement>(null);
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);
  const overflowAnterior = useRef<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  const cerrar = useCallback(() => {
    temporizadores.current.forEach(clearTimeout);
    temporizadores.current = [];
    try { sessionStorage.setItem(CLAVE_ENTRADA, "vista"); } catch { /* Almacenamiento opcional. */ }
    dialogo.current?.close();
    if (overflowAnterior.current !== null) {
      document.body.style.overflow = overflowAnterior.current;
      overflowAnterior.current = null;
    }
    document.getElementById("inicio-titulo")?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    // Respetar movimiento reducido y permitir el acceso sin JavaScript.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try { if (sessionStorage.getItem(CLAVE_ENTRADA) === "vista") return; } catch { /* Continuar sin persistencia. */ }
    const elemento = dialogo.current;
    if (!elemento?.showModal) return;
    setSaliendo(false);
    elemento.showModal();
    overflowAnterior.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    temporizadores.current = [
      setTimeout(() => setSaliendo(true), 1350),
      setTimeout(cerrar, 1750),
    ];
    return () => {
      temporizadores.current.forEach(clearTimeout);
      temporizadores.current = [];
      elemento.close();
      if (overflowAnterior.current !== null) {
        document.body.style.overflow = overflowAnterior.current;
        overflowAnterior.current = null;
      }
    };
  }, [cerrar]);

  return <dialog ref={dialogo} className={styles.entrada} data-saliendo={saliendo}
    aria-labelledby="entrada-marca" aria-describedby="entrada-mensaje"
    onCancel={evento => { evento.preventDefault(); cerrar(); }}>
    <div className={styles.escena}>
      <div className={styles.halo} aria-hidden="true" />
      <div className={styles.identidad}>
        <div className={styles.emblema} aria-hidden="true">
          <svg className={styles.anillo} viewBox="0 0 200 200" fill="none">
            <circle className={styles.pista} cx="100" cy="100" r="87" />
            <circle className={styles.trazo} cx="100" cy="100" r="87" pathLength="1" />
          </svg>
          <div className={styles.diente}><Icono nombre="diente" size={78} /></div>
        </div>
        <h2 id="entrada-marca" className={styles.marca}>Denta<span>IA</span></h2>
        <p id="entrada-mensaje" className={styles.mensaje}>El primer paso también es cuidarte.</p>
      </div>
      <button type="button" className={styles.omitir} onClick={cerrar}>Entrar ahora</button>
    </div>
  </dialog>;
}
