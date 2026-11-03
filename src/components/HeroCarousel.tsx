"use client";

import { useEffect, useState } from "react";

// Imágenes: public/hero/hero-1.jpg ... hero-5.jpg
const SLIDES = [
  "/hero/hero-1.jpg",
  "/hero/hero-2.jpg",
  "/hero/hero-3.jpg",
  "/hero/hero-4.jpg",
  "/hero/hero-5.jpg",
];

// Tiempo entre imágenes, en milisegundos.
const INTERVAL_MS = 6000;

export default function HeroCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) return;

    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, INTERVAL_MS);

    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hero-carousel" aria-hidden="true">
      {SLIDES.map((src, i) => (
        <div
          key={src}
          className={i === active ? "hero-slide is-active" : "hero-slide"}
          style={{ backgroundImage: `url(${src})` }}
        />
      ))}
      <div className="hero-carousel-grade" />
      <div className="hero-carousel-scrim" />
    </div>
  );
}