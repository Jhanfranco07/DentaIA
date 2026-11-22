"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Icono } from "./Identidad";
import styles from "./hero-carousel.module.css";

const registro = "/cuenta?modo=registro";
const directorio = "/directorio";
const intervalo = 6000;
const duracionFundido = 840;

const diapositivas = [
  {
    id: "radiante",
    alt: "Mujer de cabello largo y blusa celeste con una sonrisa amplia",
    titulo: ["Tu sonrisa,", "a tu ritmo"],
    descripcion: "Organiza tus fotografías dentales y descubre una forma más sencilla de cuidar tu sonrisa.",
    principal: { texto: "Crear cuenta gratis", href: registro },
    secundaria: { texto: "Explorar odontólogos", href: directorio },
  },
  {
    id: "surfista",
    alt: "Joven de cabello ondulado y camisa azul que sonríe a la cámara",
    titulo: ["Sonríe", "con confianza"],
    descripcion: "Encuentra profesionales odontológicos y explora opciones para tu próxima consulta.",
    principal: { texto: "Buscar odontólogos", href: directorio },
    secundaria: { texto: "Cómo funciona", href: "#como-funciona" },
  },
  {
    id: "afrobrasilena",
    alt: "Mujer de cabello afro que mira a la cámara con una sonrisa segura",
    titulo: ["Tu sonrisa", "habla por ti"],
    descripcion: "Cada sonrisa es única. Descubre un espacio pensado para acompañarte en tu cuidado dental.",
    principal: { texto: "Comenzar ahora", href: registro },
    secundaria: { texto: "Conocer funcionalidades", href: "#funcionalidades" },
  },
  {
    id: "caballero",
    alt: "Caballero sonriente de cabello plateado con traje granate",
    titulo: ["El estilo nunca", "deja de sonreír"],
    descripcion: "Una gran sonrisa siempre tiene personalidad. Organiza tu cuidado dental con DentAI.",
    principal: { texto: "Descubrir DentAI", href: "#como-funciona" },
    secundaria: { texto: "Explorar odontólogos", href: directorio },
  },
  {
    id: "urbana",
    alt: "Joven de cabello corto con chaqueta azul y una sonrisa espontánea",
    titulo: ["Sonríe", "a tu manera"],
    descripcion: "Tu estilo es único y tu sonrisa también. Descubre las herramientas que DentAI tiene para ti.",
    principal: { texto: "Crear cuenta gratis", href: registro },
    secundaria: { texto: "Cómo funciona", href: "#como-funciona" },
  },
];

type ModoCarga = "anticipada" | "automatica" | "manual";
type Estado = {
  actual: number;
  imagenLista: boolean;
  anterior: number | null;
  carga: { indice: number; lista: boolean; modo: ModoCarga } | null;
  fallidas: number[];
  anuncio: string;
};
type Accion =
  | { tipo: "solicitar"; indice: number; modo: ModoCarga }
  | { tipo: "cargada" | "fallida"; indice: number }
  | { tipo: "mostrar"; indice: number; animar: boolean }
  | { tipo: "terminarFundido" | "interrumpirRotacion" };

const estadoInicial: Estado = {
  actual: 0,
  imagenLista: false,
  anterior: null,
  carga: null,
  fallidas: [],
  anuncio: "",
};

function vecino(origen: number, direccion: number, fallidas: number[]) {
  const total = diapositivas.length;
  for (let paso = 1; paso < total; paso++) {
    const indice = (origen + direccion * paso + total) % total;
    if (!fallidas.includes(indice)) return indice;
  }
  return origen;
}

function reducir(estado: Estado, accion: Accion): Estado {
  const { actual, carga, fallidas } = estado;
  switch (accion.tipo) {
    case "solicitar": {
      const { indice, modo } = accion;
      if (fallidas.includes(indice) || (modo === "anticipada" && carga)) return estado;
      if (indice === actual) return carga?.modo === "manual" ? { ...estado, carga: null } : estado;
      const lista = indice === estado.anterior || (carga?.indice === indice && carga.lista);
      return { ...estado, carga: { indice, modo, lista } };
    }
    case "cargada":
      if (accion.indice === actual) return estado.imagenLista ? estado : { ...estado, imagenLista: true };
      if (accion.indice !== carga?.indice || carga.lista) return estado;
      return { ...estado, carga: { ...carga, lista: true } };
    case "fallida": {
      if (accion.indice !== actual && accion.indice !== carga?.indice) return estado;
      const errores = [...new Set([...fallidas, accion.indice])];
      if (accion.indice !== actual) return { ...estado, fallidas: errores, carga: null };
      if (carga && carga.indice !== accion.indice) return { ...estado, fallidas: errores, carga: { ...carga, modo: "manual" } };
      const indice = vecino(actual, 1, errores);
      return { ...estado, fallidas: errores, carga: indice === actual ? null : { indice, lista: false, modo: "manual" } };
    }
    case "mostrar":
      if (!carga?.lista || carga.indice !== accion.indice || carga.modo === "anticipada") return estado;
      return {
        ...estado,
        actual: carga.indice,
        anterior: accion.animar && estado.imagenLista ? actual : null,
        imagenLista: true,
        anuncio: carga.modo === "manual" ? diapositivas[carga.indice].titulo.join(" ") : "",
        carga: null,
      };
    case "terminarFundido":
      return estado.anterior === null ? estado : { ...estado, anterior: null };
    case "interrumpirRotacion":
      return carga?.modo === "automatica" ? { ...estado, carga: { ...carga, modo: "anticipada" } } : estado;
  }
}

function Mensajes({ actual, anterior }: { actual: number; anterior: number | null }) {
  return (
    <div className={`${styles.copyWrap} public-wrap`}>
      <div className={styles.mensajes}>
        {diapositivas.map(({ id, titulo, descripcion, principal, secundaria }, indice) => {
          const vigente = indice === actual;
          const Titulo = vigente ? "h1" : "div";
          return (
            <div
              className={styles.mensaje}
              key={id}
              data-copy-slide={indice}
              data-activo={vigente}
              data-anterior={indice === anterior}
              inert={!vigente}
              aria-hidden={vigente ? undefined : true}
            >
              <Titulo className={styles.titulo} id={vigente ? "inicio-titulo" : undefined}>
                <span>{titulo[0]}</span>{" "}<span>{titulo[1]}</span>
              </Titulo>
              <p>{descripcion}</p>
              <div className={`${styles.acciones} actions`}>
                {vigente ? (
                  <>
                    <Link href={principal.href} className="action">{principal.texto} <Icono nombre="flecha" size={18} /></Link>
                    <Link href={secundaria.href} className="action action-secondary">{secundaria.texto}</Link>
                  </>
                ) : (
                  <>
                    <span className="action">{principal.texto} <Icono nombre="flecha" size={18} /></span>
                    <span className="action action-secondary">{secundaria.texto}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HeroCarousel() {
  const [estado, dispatch] = useReducer(reducir, estadoInicial);
  const [reducido, setReducido] = useState(true);
  const [enPantalla, setEnPantalla] = useState(false);
  const [paginaVisible, setPaginaVisible] = useState(false);
  const [cursorDentro, setCursorDentro] = useState(false);
  const [focoDentro, setFocoDentro] = useState(false);
  const [pausa, setPausa] = useState(false);
  const hero = useRef<HTMLElement>(null);
  const { actual, anterior, carga, fallidas, imagenLista } = estado;
  const siguiente = vecino(actual, 1, fallidas);
  const reproduccion = !reducido && !pausa && !cursorDentro && !focoDentro && enPantalla && paginaVisible;
  const cargarAnticipada = !reducido && !pausa && enPantalla && paginaVisible;
  const solicitudActiva = carga !== null && carga.modo !== "anticipada";
  const montadas = [...new Set([anterior, actual, carga?.indice ?? null])].filter(indice => indice !== null);

  useEffect(() => {
    const movimiento = window.matchMedia("(prefers-reduced-motion: reduce)");
    const actualizarMovimiento = () => setReducido(movimiento.matches);
    const actualizarVisibilidad = () => setPaginaVisible(!document.hidden);
    actualizarMovimiento();
    actualizarVisibilidad();
    movimiento.addEventListener("change", actualizarMovimiento);
    document.addEventListener("visibilitychange", actualizarVisibilidad);
    const observador = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(
      ([entrada]) => setEnPantalla(entrada.isIntersecting),
      { threshold: 0.15 },
    );
    if (observador && hero.current) observador.observe(hero.current);
    else setEnPantalla(true);
    return () => {
      movimiento.removeEventListener("change", actualizarMovimiento);
      document.removeEventListener("visibilitychange", actualizarVisibilidad);
      observador?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!cargarAnticipada || !imagenLista || carga || anterior !== null || siguiente === actual) return;
    const temporizador = window.setTimeout(() => {
      dispatch({ tipo: "solicitar", indice: siguiente, modo: "anticipada" });
    }, 1100);
    return () => window.clearTimeout(temporizador);
  }, [actual, anterior, carga, cargarAnticipada, imagenLista, siguiente]);

  useEffect(() => {
    if (!reproduccion) {
      dispatch({ tipo: "interrumpirRotacion" });
      return;
    }
    if (!imagenLista || solicitudActiva || siguiente === actual) return;
    const temporizador = window.setTimeout(() => {
      dispatch({ tipo: "solicitar", indice: siguiente, modo: "automatica" });
    }, intervalo);
    return () => window.clearTimeout(temporizador);
  }, [actual, imagenLista, reproduccion, siguiente, solicitudActiva]);

  useEffect(() => {
    if (!carga?.lista || carga.modo === "anticipada" || (carga.modo === "automatica" && !reproduccion)) return;
    dispatch({ tipo: "mostrar", indice: carga.indice, animar: !reducido });
  }, [carga, reducido, reproduccion]);

  useEffect(() => {
    if (anterior === null) return;
    if (reducido) {
      dispatch({ tipo: "terminarFundido" });
      return;
    }
    const temporizador = window.setTimeout(() => dispatch({ tipo: "terminarFundido" }), duracionFundido);
    return () => window.clearTimeout(temporizador);
  }, [actual, anterior, reducido]);

  function seleccionar(indice: number) {
    dispatch({ tipo: "solicitar", indice, modo: "manual" });
  }

  function navegar(direccion: number) {
    const origen = carga?.modo === "manual" ? carga.indice : actual;
    seleccionar(vecino(origen, direccion, fallidas));
  }

  function teclasControles(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return;
    evento.preventDefault();
    navegar(evento.key === "ArrowLeft" ? -1 : 1);
  }

  return (
    <section
      ref={hero}
      className={`${styles.hero} public-inverse`}
      style={{ "--hero-fundido": `${duracionFundido}ms` } as CSSProperties}
      aria-roledescription="carrusel"
      aria-labelledby="inicio-titulo"
      onPointerEnter={evento => { if (evento.pointerType !== "touch") setCursorDentro(true); }}
      onPointerLeave={() => setCursorDentro(false)}
      onFocus={evento => { if (evento.target.matches(":focus-visible")) setFocoDentro(true); }}
      onBlur={evento => { if (!evento.currentTarget.contains(evento.relatedTarget)) setFocoDentro(false); }}
      onKeyDown={() => setFocoDentro(true)}
    >
      <Mensajes actual={actual} anterior={anterior} />
      <div className={styles.fotografias} data-active-slide={actual}>
        {montadas.map(indice => {
          const { id, alt } = diapositivas[indice];
          const vigente = indice === actual;
          const prioritaria = indice === 0 && actual === 0;
          return (
            <div key={id} className={styles.foto} data-foto={id} data-activo={vigente} data-anterior={indice === anterior} aria-hidden={vigente ? undefined : true}>
              <Image
                src={`/landing/campana/${id}.webp`}
                alt={alt}
                fill
                sizes="(max-width: 760px) 156vw, (max-width: 900px) 148vw, 100vw"
                priority={prioritaria}
                loading={prioritaria ? undefined : "eager"}
                fetchPriority={prioritaria ? "high" : carga?.modo === "anticipada" ? "low" : undefined}
                onLoad={() => dispatch({ tipo: "cargada", indice })}
                onError={() => dispatch({ tipo: "fallida", indice })}
              />
            </div>
          );
        })}
        <span className="public-viewfinder" aria-hidden="true" />
      </div>
      <div className={`${styles.barra} public-wrap`}>
        <a href="#como-funciona" className={styles.siguienteSeccion}><Icono nombre="flecha" size={18} /> Cómo funciona</a>
        <div className={styles.controles} role="group" aria-label="Controles del carrusel" onKeyDown={teclasControles}>
          <button
            type="button"
            className={`${styles.redondo} ${styles.rotacion}`}
            aria-label={pausa ? "Reproducir carrusel" : "Pausar carrusel"}
            onClick={() => {
              if (pausa) setFocoDentro(false);
              setPausa(!pausa);
            }}
            disabled={reducido || siguiente === actual}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={pausa ? "m9 5 11 7-11 7V5Z" : "M9 5v14m6-14v14"} />
            </svg>
          </button>
          <div className={styles.indicadores} role="group" aria-label="Elegir fotografía">
            {diapositivas.map(({ id, titulo }, indice) => (
              <button
                key={id}
                type="button"
                className={styles.indicador}
                aria-label={titulo.join(" ")}
                aria-current={indice === actual ? "true" : undefined}
                disabled={fallidas.includes(indice)}
                onClick={() => seleccionar(indice)}
              />
            ))}
          </div>
          <div className={styles.flechas}>
            <button type="button" className={styles.redondo} aria-label="Imagen anterior" disabled={siguiente === actual} onClick={() => navegar(-1)}>
              <Icono nombre="flecha" size={18} />
            </button>
            <button type="button" className={styles.redondo} aria-label="Imagen siguiente" disabled={siguiente === actual} onClick={() => navegar(1)}>
              <Icono nombre="flecha" size={18} />
            </button>
          </div>
        </div>
        <span className="sr-only" role="status" aria-atomic="true">{estado.anuncio}</span>
      </div>
    </section>
  );
}
