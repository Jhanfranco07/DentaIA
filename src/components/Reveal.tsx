"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Progressive enhancement: content stays visible without JS or motion support. */
export default function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top > window.innerHeight) element.dataset.reveal = "waiting";
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { element.dataset.reveal = "visible"; observer.disconnect(); }
    }, { threshold: 0.08 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`}>{children}</div>;
}
