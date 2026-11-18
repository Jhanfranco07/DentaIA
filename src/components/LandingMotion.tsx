"use client";

import { useEffect } from "react";

/**
 * Reveal sections on every entry into the viewport, in either scroll direction.
 * Content stays fully visible without JS, IntersectionObserver support or when
 * the visitor asks for reduced motion.
 */
export default function LandingMotion() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | null = null;

    const cleanup = () => {
      observer?.disconnect();
      observer = null;
      targets.forEach((element) => element.removeAttribute("data-motion-state"));
    };

    const setup = () => {
      cleanup();
      if (motion.matches || !("IntersectionObserver" in window)) return;
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          (entry.target as HTMLElement).dataset.motionState = entry.isIntersecting ? "visible" : "hidden";
        }
      }, { threshold: 0.08, rootMargin: "0px 0px -9% 0px" });
      targets.forEach((element) => observer?.observe(element));
    };

    setup();
    motion.addEventListener("change", setup);
    return () => {
      motion.removeEventListener("change", setup);
      cleanup();
    };
  }, []);
  return null;
}
