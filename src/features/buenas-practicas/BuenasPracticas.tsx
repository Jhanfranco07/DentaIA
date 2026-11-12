"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icono } from "@/components/Identidad";
import { GUIAS_BUCALES, type GuiaBucal } from "./contenido";
import { MascotaDiente, MiniIlustracion } from "./Ilustraciones";
import styles from "./buenas-practicas.module.css";

type Tema = "Todos" | "Hábitos" | "Prevención" | "Alimentación" | "Cuidados";
const TEMAS: readonly { titulo: Tema; emoji: string }[] = [
  { titulo: "Todos", emoji: "✦" },
  { titulo: "Hábitos", emoji: "🪥" },
  { titulo: "Prevención", emoji: "🛡️" },
  { titulo: "Alimentación", emoji: "🍏" },
  { titulo: "Cuidados", emoji: "💜" },
];
const TIPS = [
  { titulo: "Dos minutos que cuentan", cuerpo: "Cepilla tus dientes durante dos minutos, dos veces al día, utilizando pasta dental fluorada.", fuente: "American Dental Association", url: "https://www.mouthhealthy.org/all-topics-a-z/brushing-your-teeth/" },
  { titulo: "Cuida cada espacio", cuerpo: "Limpia entre los dientes todos los días con hilo dental u otro limpiador interdental adecuado.", fuente: "American Dental Association", url: "https://www.mouthhealthy.org/all-topics-a-z/flossing/" },
  { titulo: "Tus encías también importan", cuerpo: "Si notas sangrado frecuente, dolor o hinchazón de las encías, consulta con un odontólogo.", fuente: "NHS", url: "https://www.nhs.uk/conditions/gum-disease/" },
] as const;

function coincideConTema(guia: GuiaBucal, tema: Tema) {
  if (tema === "Todos") return true;
  if (tema === "Hábitos") return guia.categoria === "Higiene diaria";
  if (tema === "Prevención") return guia.id === "fluor" || guia.id === "controles";
  if (tema === "Alimentación") return guia.id === "alimentacion";
  return guia.id === "encias";
}

export default function BuenasPracticas() {
  const [tema, setTema] = useState<Tema>("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState("cepillado");
  const [revisadas, setRevisadas] = useState<string[]>([]);
  const [dias, setDias] = useState<number[]>([]);
  const [segundos, setSegundos] = useState(120);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [tip, setTip] = useState(0);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  useEffect(() => {
    if (!reproduciendo) return;
    const temporizador = window.setInterval(() => setSegundos((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(temporizador);
  }, [reproduciendo]);
  useEffect(() => { if (segundos === 0) setReproduciendo(false); }, [segundos]);

  const visibles = useMemo(() => GUIAS_BUCALES.filter((g) =>
    coincideConTema(g, tema) &&
    (g.titulo + " " + g.descripcion + " " + g.pasos.join(" ")).toLocaleLowerCase("es").includes(busqueda.trim().toLocaleLowerCase("es"))
  ), [tema, busqueda]);
  const actual = visibles.find((g) => g.id === seleccion) ?? visibles[0];
  const porcentaje = Math.round(100 * revisadas.length / GUIAS_BUCALES.length);
  const tiempo = String(Math.floor(segundos / 60)).padStart(2, "0") + ":" + String(segundos % 60).padStart(2, "0");

  function abrirGuia(id: string) {
    setSeleccion(id);
    setMostrarDetalle(true);
    window.requestAnimationFrame(() => document.getElementById("guia-detalle")?.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"}));
  }

  return <main className={styles.pagina}>
    <section className={styles.hero} aria-labelledby="educacion-titulo">
      <div className={styles.heroBrillo} aria-hidden="true" />
      <div className={styles.heroCopy}>
        <span className={styles.heroEtiqueta}><Icono nombre="reporte" size={19} /> BUENAS PRÁCTICAS</span>
        <h1 id="educacion-titulo">Aprende a cuidar <span>tu salud bucal</span></h1>
        <p>Conoce hábitos y consejos para mantener una sonrisa saludable. Aprende a tu ritmo, paso a paso.</p>
        <div className={styles.heroAcciones}>
          <button type="button" className={styles.botonPrincipal} onClick={() => abrirGuia("cepillado")}><span aria-hidden="true">▶</span> Ver introducción</button>
          <a className={styles.botonDuracion} href="#temporizador"><Icono nombre="reloj" size={16} /> 2 min</a>
        </div>
      </div>
      <div className={styles.heroMascota}>
        <div className={styles.orbita} aria-hidden="true" />
        <MascotaDiente />
        <span className={styles.destelloUno} aria-hidden="true">✦</span>
        <span className={styles.destelloDos} aria-hidden="true">✧</span>
      </div>
      <div className={styles.tarjetaProgreso}>
        <strong>Tu progreso de aprendizaje</strong>
        <div className={styles.progresoLinea}>
          <div className={styles.progresoAnillo} style={{background: `conic-gradient(#6155e9 ${porcentaje}%,#d9defc 0)`}}><div>{porcentaje}%</div></div>
          <p><b>{revisadas.length} de {GUIAS_BUCALES.length} guías</b><span>revisadas en esta sesión</span></p>
        </div>
      </div>
    </section>

    <section id="explorar" className={styles.explorar} aria-label="Explorar guías de salud bucal">
      <div className={styles.tituloFila}><div><h2>Explora los temas</h2><span className={styles.raya} aria-hidden="true" /></div><div className={styles.filtros} aria-label="Filtrar por tema">{TEMAS.map((f) =>
        <button key={f.titulo} type="button" className={tema === f.titulo ? styles.filtroActivo : styles.filtro} aria-pressed={tema === f.titulo} onClick={() => {setTema(f.titulo);setMostrarDetalle(false);}}>
          <span aria-hidden="true">{f.emoji}</span> {f.titulo}
        </button>
      )}</div></div>
      <label className={styles.busqueda}><Icono nombre="buscar" size={18}/><span className={styles.srOnly}>Buscar guía educativa</span><input type="search" placeholder="Buscar un tema o consejo" value={busqueda} onChange={(e)=>{setBusqueda(e.target.value);setMostrarDetalle(false);}}/></label>
      {visibles.length ? <div className={styles.tarjetas}>{visibles.map((g, indice) => <button type="button" key={g.id} className={styles.tarjeta} style={{animationDelay: `${indice * 60}ms`}} onClick={()=>abrirGuia(g.id)} aria-label={`Abrir guía de ${g.titulo}`}>
        <span className={styles.dibujo} data-tema={g.id}>
          <span className={styles.circuloFondo} aria-hidden="true" />
          <MiniIlustracion id={g.id} />
          <span className={styles.insigniaAccion} aria-hidden="true">{revisadas.includes(g.id) ? "✓" : "▶"}</span>
        </span>
        <span className={styles.tarjetaInfo}>
          <strong>{g.titulo}</strong>
          <span className={styles.tarjetaDescripcion}>{g.descripcion}</span>
          <span className={styles.progresoBarra}><span style={{width: revisadas.includes(g.id) ? "100%" : "0%"}} /></span>
          <span className={styles.tarjetaPie}><span>{revisadas.includes(g.id) ? "100% · Revisado" : "0% · Por explorar"}</span><span>{revisadas.includes(g.id) ? "✓" : "→"}</span></span>
        </span>
      </button>)}</div> : <div className={styles.sinResultados}><strong>No encontramos ese tema</strong><p>Prueba otra búsqueda o vuelve a mostrar todas las guías.</p><button type="button" onClick={()=>{setTema("Todos");setBusqueda("");}}>Ver todos</button></div>}
      {mostrarDetalle && actual && <article id="guia-detalle" className={styles.detalle} aria-label={`Guía de ${actual.titulo}`}>
        <div className={styles.detalleDibujo}><MiniIlustracion id={actual.id}/></div>
        <div className={styles.detalleContenido}>
          <div className={styles.detalleCabecera}><span className={styles.seccionEtiqueta}>GUÍA INTERACTIVA · {actual.categoria.toUpperCase()}</span><button type="button" className={styles.cerrarDetalle} onClick={()=>setMostrarDetalle(false)} aria-label="Cerrar guía">✕</button></div>
          <h3>{actual.titulo}</h3><p>{actual.descripcion}</p><span className={styles.duracion}><Icono nombre="reloj" size={16}/>{actual.duracion}</span>
          <h4>Aprende paso a paso</h4><ol className={styles.pasos}>{actual.pasos.map((paso,i)=><li key={paso}><span>{String(i+1).padStart(2,"0")}</span>{paso}</li>)}</ol>
          <div className={styles.consejo}><span aria-hidden="true">💡</span><p><strong>Consejo:</strong> {actual.consejo}</p></div>
          <div className={styles.detalleAcciones}><button type="button" className={styles.botonFinal} onClick={()=>setRevisadas((v)=>v.includes(actual.id)?v.filter((id)=>id!==actual.id):[...v,actual.id])}>{revisadas.includes(actual.id)?"✓ Marcar como no revisada":"✓ Marcar guía como revisada"}</button><a href={actual.fuente.url} target="_blank" rel="noopener noreferrer">Fuente: {actual.fuente.nombre} <Icono nombre="enlace" size={15}/></a></div>
        </div>
      </article>}
    </section>

    <section className={styles.extras} aria-label="Herramientas de aprendizaje">
      <article className={styles.reto}>
        <div className={styles.extraTitulo}><span aria-hidden="true">🏆</span><div><h2>Reto de la semana</h2><p>Practica un hábito saludable durante siete días.</p></div></div>
        <div className={styles.retoInterior}><span className={styles.retoIcono} aria-hidden="true">🪥</span><div><strong>Cepíllate 2 veces al día durante 7 días</strong><div className={styles.miniBarra}><span style={{width: `${dias.length / 7 * 100}%`}} /></div><span className={styles.retoCantidad}>{dias.length}/7 días · Registro de esta sesión</span></div><span className={styles.medalla} aria-hidden="true">✦</span></div>
        <div className={styles.dias} aria-label="Marcar días del reto">{Array.from({length:7},(_,i)=><button type="button" key={i} aria-label={`Día ${i+1}`} aria-pressed={dias.includes(i+1)} onClick={()=>setDias((d)=>d.includes(i+1)?d.filter((n)=>n!==i+1):[...d,i+1])}>{dias.includes(i+1)?"✓":i+1}</button>)}</div>
      </article>
      <article className={styles.tarjetaTiempo} id="temporizador">
        <div className={styles.extraTitulo}><span aria-hidden="true">⏱️</span><div><h2>Temporizador de cepillado</h2><p>Dos minutos para acompañar tu rutina.</p></div></div>
        <div className={styles.tiempoContenido}><div className={styles.cuentaAtras} role="timer" aria-label={`Tiempo restante ${tiempo}`}>{tiempo}</div><button type="button" className={styles.play} onClick={()=>{if(segundos===0)setSegundos(120);setReproduciendo(v=>!v);}} aria-label={reproduciendo?"Pausar temporizador":"Iniciar temporizador"}>{reproduciendo?"Ⅱ":"▶"}</button><button className={styles.reset} type="button" onClick={()=>{setReproduciendo(false);setSegundos(120);}}>Reiniciar</button><div className={styles.miniDiente}><MascotaDiente /></div></div>
        {segundos===0 && <p className={styles.finalizado} role="status">¡Dos minutos completados!</p>}
      </article>
      <article className={styles.sabias}>
        <div className={styles.extraTitulo}><span aria-hidden="true">💡</span><div><h2>¿Sabías que...?</h2></div></div>
        <p><strong>{TIPS[tip].titulo}.</strong> {TIPS[tip].cuerpo}</p>
        <div className={styles.tipPie}><a href={TIPS[tip].url} target="_blank" rel="noopener noreferrer">Fuente: {TIPS[tip].fuente}</a><button type="button" onClick={()=>setTip(t=>(t+1)%TIPS.length)} aria-label="Ver otro consejo">Otro consejo →</button></div>
        <span className={styles.decoracionTip} aria-hidden="true">✦</span>
      </article>
    </section>
    <footer className={styles.notaFinal}><span aria-hidden="true">✚</span><p>Contenido educativo general; no sustituye una evaluación odontológica. Ante dolor, sangrado persistente u otros síntomas, acude a un profesional.</p><Link href="/directorio">Explorar directorio <Icono nombre="flecha" size={16}/></Link></footer>
  </main>;
}
