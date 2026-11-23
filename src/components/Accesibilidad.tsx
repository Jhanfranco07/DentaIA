"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  CLAVE_ACCESIBILIDAD, PREFERENCIAS_INICIALES, alternarPerfil, leerPreferencias,
  normalizarPreferencias, perfilActivo, type Ajuste, type PreferenciasAccesibilidad,
} from "@/lib/accesibilidad/preferencias";
import styles from "./accesibilidad.module.css";

const Contexto = createContext({ preferencias: PREFERENCIAS_INICIALES });
export function useAccesibilidad() { return useContext(Contexto); }

const AJUSTES: { clave: Ajuste; titulo: string; detalle: string }[] = [
  { clave: "espaciado", titulo: "Espaciado de lectura", detalle: "Más espacio entre líneas, letras y palabras." },
  { clave: "contraste", titulo: "Alto contraste", detalle: "Texto claro sobre superficies oscuras." },
  { clave: "fuente", titulo: "Fuente sencilla", detalle: "Usar una tipografía de lectura familiar." },
  { clave: "enlaces", titulo: "Resaltar enlaces", detalle: "Subrayar y delimitar los enlaces." },
  { clave: "movimiento", titulo: "Detener animaciones", detalle: "Pausar carrusel, entrada y efectos decorativos." },
  { clave: "saturacion", titulo: "Reducir color", detalle: "Suavizar los colores de imágenes e ilustraciones." },
  { clave: "guia", titulo: "Guía de lectura", detalle: "Una línea que acompaña el puntero." },
  { clave: "mascara", titulo: "Máscara de lectura", detalle: "Oscurecer lo que queda fuera de una franja." },
  { clave: "imagenes", titulo: "Ocultar decoración", detalle: "Ocultar imágenes sin información y efectos de fondo." },
  { clave: "cursor", titulo: "Cursor grande", detalle: "Un puntero más visible dentro de la página." },
];

function AccesoIcono() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="4" r="2" /><path d="M4 8c5 2 11 2 16 0M12 10v5m0 0-4 6m4-6 4 6" /></svg>;
}
function Interruptor({ titulo, detalle, activo, cambiar }: { titulo: string; detalle: string; activo: boolean; cambiar: () => void }) {
  return <button type="button" className={styles.ajuste} role="switch" aria-checked={activo} aria-label={titulo} onClick={cambiar}>
    <span><strong>{titulo}</strong><small>{detalle}</small></span><span className={styles.interruptor} aria-hidden="true"><i /></span>
  </button>;
}

export default function Accesibilidad({ children }: { children: ReactNode }) {
  const [preferencias, setPreferencias] = useState<PreferenciasAccesibilidad>({ ...PREFERENCIAS_INICIALES });
  const [listo, setListo] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const panel = useRef<HTMLDialogElement>(null);
  const lanzador = useRef<HTMLButtonElement>(null);
  const ayuda = useRef<HTMLDivElement>(null);
  const altura = useRef(0);
  const ruta = usePathname();

  useEffect(() => {
    try { setPreferencias(leerPreferencias(localStorage)); } catch { /* Preferencias opcionales. */ }
    setListo(true);
    const sincronizar = (e: StorageEvent) => {
      if (e.key === CLAVE_ACCESIBILIDAD || e.key === null) {
        try { setPreferencias(leerPreferencias(localStorage)); } catch { /* Mantener la selección actual. */ }
      }
    };
    window.addEventListener("storage", sincronizar);
    return () => window.removeEventListener("storage", sincronizar);
  }, []);

  useEffect(() => {
    if (!listo) return;
    const p = normalizarPreferencias(preferencias);
    for (const clave of Object.keys(p) as (keyof PreferenciasAccesibilidad)[]) {
      if (clave !== "escala") document.documentElement.setAttribute(`data-a11y-${clave}`, String(p[clave]));
    }
    document.documentElement.style.setProperty("--a11y-escala", String(p.escala / 100));
    try { localStorage.setItem(CLAVE_ACCESIBILIDAD, JSON.stringify(p)); } catch { /* Funciona durante esta sesión. */ }
  }, [preferencias, listo]);

  useEffect(() => {
    if (!preferencias.movimiento) return;
    const detener = () => document.querySelectorAll<HTMLMediaElement>("#dentaia-aplicacion video[autoplay], #dentaia-aplicacion audio[autoplay]").forEach(medio => medio.pause());
    detener();
    const observador = new MutationObserver(detener);
    const contenido = document.getElementById("dentaia-aplicacion");
    if (contenido) observador.observe(contenido, { childList: true, subtree: true });
    return () => observador.disconnect();
  }, [preferencias.movimiento]);

  useEffect(() => {
    if (!preferencias.guia && !preferencias.mascara) return;
    altura.current = window.innerHeight / 2;
    ayuda.current?.style.setProperty("--lectura-y", `${altura.current}px`);
    let cuadro = 0;
    const mover = (evento: PointerEvent) => {
      altura.current = evento.clientY;
      if (!cuadro) cuadro = requestAnimationFrame(() => {
        ayuda.current?.style.setProperty("--lectura-y", `${altura.current}px`);
        cuadro = 0;
      });
    };
    window.addEventListener("pointermove", mover, { passive: true });
    return () => { cancelAnimationFrame(cuadro); window.removeEventListener("pointermove", mover); };
  }, [preferencias.guia, preferencias.mascara]);

  useEffect(() => { setAbierto(false); }, [ruta]);
  useEffect(() => {
    if (abierto && !panel.current?.open) panel.current?.showModal();
    if (!abierto && panel.current?.open) panel.current.close();
  }, [abierto]);
  const cerrar = useCallback(() => { setAbierto(false); lanzador.current?.focus({ preventScroll: true }); }, []);
  const alternar = (clave: Ajuste) => setPreferencias(p => ({ ...p, [clave]: !p[clave] }));
  const moverGuia = (delta: number) => {
    altura.current = Math.max(25, Math.min(window.innerHeight - 25, altura.current + delta));
    ayuda.current?.style.setProperty("--lectura-y", `${altura.current}px`);
  };

  return <Contexto.Provider value={{ preferencias }}>
    <div id="dentaia-aplicacion">{children}</div>
    <button ref={lanzador} type="button" className={styles.lanzador} aria-label="Abrir preferencias de accesibilidad" aria-haspopup="dialog" aria-expanded={abierto} aria-controls="preferencias-accesibilidad" onClick={() => setAbierto(true)}><AccesoIcono /></button>
    <dialog id="preferencias-accesibilidad" ref={panel} className={styles.panel} aria-labelledby="accesibilidad-titulo" onCancel={e => { e.preventDefault(); cerrar(); }} onClose={() => setAbierto(false)} onClick={e => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className={styles.interior}>
        <header className={styles.cabecera}><h2 id="accesibilidad-titulo">Preferencias de accesibilidad</h2><button type="button" aria-label="Cerrar preferencias de accesibilidad" onClick={cerrar}>×</button></header>
        <div className={styles.contenido}>
          <fieldset><legend>Perfiles rápidos</legend>
            <Interruptor titulo="Reducir estímulos" detalle="Detener movimiento y suavizar los colores." activo={perfilActivo(preferencias, "estimulos")} cambiar={() => setPreferencias(p => alternarPerfil(p, "estimulos"))} />
            <Interruptor titulo="Baja visión" detalle="Ampliar la página, contrastar y resaltar enlaces." activo={perfilActivo(preferencias, "vision")} cambiar={() => setPreferencias(p => alternarPerfil(p, "vision"))} />
            <Interruptor titulo="Concentración" detalle="Activar la máscara y reducir las distracciones." activo={perfilActivo(preferencias, "concentracion")} cambiar={() => setPreferencias(p => alternarPerfil(p, "concentracion"))} />
          </fieldset>
          <fieldset><legend>Escala de página</legend><div className={styles.escalas}>{([100, 125, 150] as const).map(escala => <button key={escala} type="button" aria-pressed={preferencias.escala === escala} onClick={() => setPreferencias(p => ({ ...p, escala }))}>{escala} %</button>)}</div><p className={styles.nota}>Amplía el contenido y sus controles.</p></fieldset>
          <fieldset><legend>Ajustes</legend>{AJUSTES.map(ajuste => <Interruptor key={ajuste.clave} {...ajuste} activo={preferencias[ajuste.clave]} cambiar={() => alternar(ajuste.clave)} />)}</fieldset>
          {(preferencias.guia || preferencias.mascara) && <div className={styles.guiaControles}><span>Posición de lectura</span><button type="button" onClick={() => moverGuia(-40)} aria-label="Mover guía de lectura hacia arriba">Subir</button><button type="button" onClick={() => moverGuia(40)} aria-label="Mover guía de lectura hacia abajo">Bajar</button></div>}
          <div className={styles.acciones}><button type="button" onClick={() => setPreferencias({ ...PREFERENCIAS_INICIALES })}>Restablecer ajustes</button><button type="button" onClick={cerrar}>Cerrar panel</button></div>
          <p className={styles.nota}>Tus preferencias se guardan en este navegador.</p>
        </div>
      </div>
    </dialog>
    {(preferencias.guia || preferencias.mascara) && <div ref={ayuda} className={styles.ayuda} aria-hidden="true">{preferencias.mascara && <div className={styles.mascara} />}{preferencias.guia && <div className={styles.linea} />}</div>}
  </Contexto.Provider>;
}
