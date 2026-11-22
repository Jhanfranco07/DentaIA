"use client";

import { useEffect } from "react";

export default function LandingMotion() {
  useEffect(() => {
    const section = document.getElementById("contenido");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!section || !("IntersectionObserver" in window)) return;
    const animaciones = new Map<HTMLElement, Animation>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const elemento = entry.target as HTMLElement;
        observer.unobserve(elemento);
        if (motion.matches || elemento.contains(document.activeElement)) continue;
        const animacion = elemento.animate(
          [{ opacity: .82, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 320, easing: "cubic-bezier(.22, 1, .36, 1)" },
        );
        animaciones.set(elemento, animacion);
        animacion.onfinish = () => animaciones.delete(elemento);
      }
    }, { threshold: .08 });
    const cancelar = () => {
      animaciones.forEach(animacion => animacion.cancel());
      animaciones.clear();
    };
    section.querySelectorAll("[data-reveal]").forEach(elemento => observer.observe(elemento));
    motion.addEventListener("change", cancelar);
    return () => {
      observer.disconnect();
      cancelar();
      motion.removeEventListener("change", cancelar);
    };
  }, []);
  return null;
}
