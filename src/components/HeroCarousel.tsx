"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./hero-carousel.module.css";

const SLIDES = [
  "/hero/hero-1.jpg",
  "/hero/hero-2.jpg",
  "/hero/hero-3.jpg",
  "/hero/hero-4.jpg",
  "/hero/hero-5.jpg",
];
const INTERVAL_MS = 6000;

export default function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(1);
  const [firstLoaded, setFirstLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hidden, setHidden] = useState(false);
  const ready = useRef(new Set<number>());

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    const syncVisibility = () => setHidden(document.hidden);
    syncMotion();
    syncVisibility();
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      media.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  // Only the LCP image is requested initially. Warm the next slide afterwards.
  useEffect(() => {
    if (!firstLoaded || paused || reducedMotion || hidden) return;
    const warmup = window.setTimeout(() => setMounted((count) => Math.max(count, 2)), 1500);
    return () => window.clearTimeout(warmup);
  }, [firstLoaded, paused, reducedMotion, hidden]);

  useEffect(() => {
    if (!firstLoaded || paused || reducedMotion || hidden) return;
    const timer = window.setInterval(() => {
      const next = (active + 1) % SLIDES.length;
      // Keep the previous photograph visible on a slow or failed request.
      if (!ready.current.has(next)) return;
      setActive(next);
      setMounted((count) => Math.max(count, Math.min(next + 2, SLIDES.length)));
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [active, firstLoaded, paused, reducedMotion, hidden]);

  const stopped = paused || reducedMotion || hidden;
  return <>
    <div className={`${styles.carousel} ${stopped ? styles.stopped : ""}`} aria-hidden="true" data-active-slide={active}>
      {SLIDES.slice(0, mounted).map((src, index) => (
        <div key={src} className={`${styles.slide} ${index === active ? styles.active : ""}`}>
          <Image src={src} alt="" fill sizes="100vw" priority={index === 0} loading={index === 0 ? undefined : "eager"} fetchPriority={index === 0 ? "high" : "low"} quality={75} onLoad={() => {
            ready.current.add(index);
            if (index === 0) setFirstLoaded(true);
          }} />
        </div>
      ))}
      <div className={styles.grade} />
      <div className={styles.scrim} />
    </div>
    <button type="button" className={styles.control} onClick={() => setPaused((value) => !value)} disabled={reducedMotion} aria-label={reducedMotion ? "Carrusel detenido por preferencia de movimiento reducido" : paused ? "Reanudar carrusel" : "Pausar carrusel"}>
      <span aria-hidden="true">{paused || reducedMotion ? "▶" : "Ⅱ"}</span>
      {reducedMotion ? "Imagen fija" : paused ? "Reanudar fotos" : "Pausar fotos"}
    </button>
  </>;
}
