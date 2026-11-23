"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { useAccesibilidad } from "./Accesibilidad";

/** Mide contenedores inmóviles para que la transformación no realimente el scroll. */
export default function AperturaPlanes({ children, className }: {
  children: ReactNode;
  className: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { preferencias } = useAccesibilidad();

  useEffect(() => {
    const grid = ref.current;
    if (!grid || preferencias.movimiento) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tarjetas = Array.from(grid.children) as HTMLElement[];
    let frame = 0;
    const limpiar = () => {
      delete grid.dataset.apertura;
      tarjetas.forEach(tarjeta => {
        tarjeta.style.removeProperty("--plan-giro");
      });
    };
    const actualizar = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      if (media.matches) { limpiar(); return; }
      const alto = window.innerHeight;
      tarjetas.forEach((tarjeta, indice) => {
        const inicio = alto * (.96 - indice * .12);
        const recorrido = Math.max(1, alto * .6);
        const rect = tarjeta.getBoundingClientRect();
        const enfocado = tarjeta.contains(document.activeElement);
        const progreso = Math.min(1, Math.max(0,
          (inicio - rect.top) / recorrido,
        ));
        // Conserva un tramo de lectura de frente antes de cerrar por el otro lado.
        // Medir el borde inferior permite leer también tarjetas altas en móviles.
        const inicioSalida = Math.min(
          alto * (.58 - indice * .1),
          inicio - recorrido + rect.height - alto * .12,
        );
        const salida = Math.min(1, Math.max(0,
          (inicioSalida - rect.bottom) / Math.max(1, alto * .5),
        ));
        const giro = enfocado ? 0 : (1 - progreso) * 78 - salida * 78;
        tarjeta.style.setProperty("--plan-giro", `${giro}deg`);
      });
      grid.dataset.apertura = "activa";
    };
    const solicitar = () => {
      if (!frame) frame = window.requestAnimationFrame(actualizar);
    };
    actualizar();
    window.addEventListener("scroll", solicitar, { passive: true });
    window.addEventListener("resize", solicitar);
    grid.addEventListener("focusin", actualizar);
    grid.addEventListener("focusout", solicitar);
    media.addEventListener("change", actualizar);
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(solicitar);
    resize?.observe(grid);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", solicitar);
      window.removeEventListener("resize", solicitar);
      grid.removeEventListener("focusin", actualizar);
      grid.removeEventListener("focusout", solicitar);
      media.removeEventListener("change", actualizar);
      resize?.disconnect();
      limpiar();
    };
  }, [preferencias.movimiento, preferencias.escala]);

  return <div className={className} ref={ref}>{children}</div>;
}
