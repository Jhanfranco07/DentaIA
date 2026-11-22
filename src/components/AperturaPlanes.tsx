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
        tarjeta.style.removeProperty("--plan-opacidad");
        tarjeta.style.removeProperty("--plan-corte");
        tarjeta.style.removeProperty("--plan-desplazamiento");
      });
    };
    const actualizar = () => {
      frame = 0;
      if (media.matches) { limpiar(); return; }
      const alto = window.innerHeight;
      tarjetas.forEach((tarjeta, indice) => {
        const inicio = alto * (.94 - indice * .1);
        const recorrido = Math.max(1, alto * .42);
        const enfocado = tarjeta.contains(document.activeElement);
        const progreso = enfocado ? 1 : Math.min(1, Math.max(0,
          (inicio - tarjeta.getBoundingClientRect().top) / recorrido,
        ));
        tarjeta.style.setProperty("--plan-opacidad", String(.3 + progreso * .7));
        tarjeta.style.setProperty("--plan-corte", `${(1 - progreso) * 55}%`);
        tarjeta.style.setProperty("--plan-desplazamiento", `${(1 - progreso) * 56}px`);
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
