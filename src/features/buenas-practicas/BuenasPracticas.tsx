"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icono } from "@/components/Identidad";
import { GUIAS_BUCALES, CATEGORIAS_GUIA, type CategoriaGuia } from "./contenido";
import { MascotaDiente, MiniIlustracion } from "./Ilustraciones";
import styles from "./buenas-practicas.module.css";

type Filtro = "Todos" | CategoriaGuia;
export default function BuenasPracticas() {
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState("cepillado");
  const [revisadas, setRevisadas] = useState<string[]>([]);
  const [segundos, setSegundos] = useState(120);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [mostrarTemporizador, setMostrarTemporizador] = useState(false);

  useEffect(() => {
    if (!reproduciendo) return;
    const timer = window.setInterval(() => setSegundos((actual) => Math.max(0, actual - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [reproduciendo]);
  useEffect(() => { if (segundos === 0) setReproduciendo(false); }, [segundos]);

  const visibles = useMemo(() => GUIAS_BUCALES.filter((g) => {
    const texto = (g.titulo + " " + g.descripcion + " " + g.pasos.join(" ")).toLocaleLowerCase("es");
    return (filtro === "Todos" || g.categoria === filtro) && texto.includes(busqueda.trim().toLocaleLowerCase("es"));
  }), [filtro, busqueda]);
  const activa = visibles.find((g) => g.id === seleccion) ?? visibles[0];
  const progreso = Math.round((revisadas.length / GUIAS_BUCALES.length) * 100);
  const tiempo = String(Math.floor(segundos / 60)).padStart(2,"0") + ":" + String(segundos % 60).padStart(2,"0");

  return <main className={styles.pagina}>
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <div className={styles.ruta}><Link href="/panel">Mi panel</Link><span aria-hidden="true">/</span>Buenas prácticas</div>
        <span className={styles.eyebrow}><Icono nombre="destello" size={16}/> TU ESPACIO DE BIENESTAR</span>
        <h1>Aprende a cuidar <span>tu salud bucal.</span></h1>
        <p>Pequeñas acciones, una sonrisa más sana. Descubre consejos educativos respaldados por fuentes odontológicas.</p>
        <div className={styles.heroAcciones}>
          <a href="#explorar" className={styles.botonPrincipal}>Explorar las guías <Icono nombre="flecha" size={18}/></a>
          <button type="button" className={styles.botonClaro} onClick={() => setMostrarTemporizador((v) => !v)}><Icono nombre="reloj" size={17}/> Temporizador de 2 min</button>
        </div>
      </div>
      <div className={styles.heroMascota}><MascotaDiente /></div>
      <div className={styles.tarjetaProgreso}>
        <div className={styles.progresoAnillo} style={{background:"conic-gradient(#685bdd " + progreso + "%,#ffffffc9 0)"}}><span>{progreso}%</span></div>
        <div><strong>Tu exploración</strong><small>{revisadas.length} de {GUIAS_BUCALES.length} guías revisadas</small><span className={styles.progresoNota}>Se reinicia al salir</span></div>
      </div>
    </header>

    {mostrarTemporizador && <section className={styles.temporizador} aria-label="Temporizador de cepillado">
      <div><span className={styles.seccionEtiqueta}>HERRAMIENTA INTERACTIVA</span><h2>Dos minutos para tu sonrisa</h2><p>Temporizador orientativo para acompañar tu cepillado. Puedes pausar o reiniciar cuando quieras.</p></div>
      <div className={styles.relojNumero} role="timer" aria-label={"Tiempo restante " + tiempo}>{tiempo}</div>
      <div className={styles.temporizadorControles}><button type="button" onClick={() => { if (segundos===0) setSegundos(120);setReproduciendo((v)=>!v); }}>{reproduciendo ? "Pausar" : segundos === 0 ? "Repetir" : "Iniciar"}</button><button type="button" onClick={() => {setReproduciendo(false);setSegundos(120)}}>Reiniciar</button></div>
      {segundos === 0 && <strong role="status">¡Tiempo completado! Continúa con una limpieza suave.</strong>}
    </section>}

    <section className={styles.encabezado} id="explorar"><div><span className={styles.seccionEtiqueta}>APRENDE A TU RITMO</span><h2>Explora los temas</h2><p>Elige una tarjeta para descubrir sus pasos, ilustraciones y recomendaciones.</p></div><span className={styles.total}><strong>06</strong> guías educativas</span></section>
    <section className={styles.explorador} aria-label="Biblioteca de buenas prácticas">
      <div className={styles.toolbar}><div className={styles.filtros} role="group" aria-label="Categorías">{CATEGORIAS_GUIA.map((cat) => <button type="button" key={cat} aria-pressed={filtro===cat} className={filtro===cat?styles.filtroActivo:styles.filtro} onClick={()=>setFiltro(cat)}>{cat}</button>)}</div><label className={styles.buscar}><Icono nombre="buscar" size={18}/><span className={styles.srOnly}>Buscar guía</span><input type="search" placeholder="Busca un tema…" value={busqueda} onChange={(e)=>setBusqueda(e.target.value)}/></label></div>
      {visibles.length > 0 ? <>
        <div className={styles.tarjetas}>{visibles.map((g,i)=><button className={activa?.id===g.id?styles.tarjetaElegida:styles.tarjeta} type="button" key={g.id} aria-pressed={activa?.id===g.id} onClick={()=>{setSeleccion(g.id);}} style={{animationDelay:(i*65)+"ms"}}>
          <div className={styles.dibujo}><MiniIlustracion id={g.id}/><span className={styles.badgeNumero}>{String(GUIAS_BUCALES.findIndex(x=>x.id===g.id)+1).padStart(2,"0")}</span></div>
          <span className={styles.tarjetaInfo}><span className={styles.categoria}>{g.categoria}</span><strong>{g.titulo}</strong><small>{g.descripcion}</small><span className={styles.tarjetaPie}>{revisadas.includes(g.id) ? "✓ Revisada" : "Ver guía"} <Icono nombre="flecha" size={15}/></span></span>
        </button>)}</div>
        {activa && <article className={styles.detalle} key={activa.id}><div className={styles.detalleIlustracion}><MiniIlustracion id={activa.id}/></div><div className={styles.detalleContenido}><span className={styles.seccionEtiqueta}>GUÍA PRÁCTICA · {activa.categoria.toUpperCase()}</span><h3>{activa.titulo}</h3><p className={styles.detalleBajada}>{activa.descripcion}</p><span className={styles.duracion}><Icono nombre="reloj" size={16}/>{activa.duracion}</span><h4>Paso a paso</h4><ol className={styles.pasos}>{activa.pasos.map((paso,i)=><li key={paso}><span>{String(i+1).padStart(2,"0")}</span>{paso}</li>)}</ol><div className={styles.consejo}><Icono nombre="destello" size={19}/><p><strong>Un consejo para ti.</strong> {activa.consejo}</p></div><div className={styles.detalleAcciones}><button type="button" onClick={()=>setRevisadas(v=>v.includes(activa.id)?v.filter(id=>id!==activa.id):[...v,activa.id])} className={styles.botonFinal}>{revisadas.includes(activa.id)?"✓ Guía revisada":"Marcar como revisada"}</button><a href={activa.fuente.url} target="_blank" rel="noopener noreferrer">Ver fuente oficial <Icono nombre="enlace" size={15}/></a></div></div></article>}
      </> : <div className={styles.sinResultados}><Icono nombre="buscar" size={28}/><h3>No encontramos esa guía</h3><p>Intenta con otras palabras o cambia la categoría.</p><button type="button" onClick={()=>{setFiltro("Todos");setBusqueda("");}}>Restablecer filtros</button></div>}
    </section>
    <section className={styles.notaFinal}><div><span className={styles.seccionEtiqueta}>PARA TENER EN CUENTA</span><h2>Tu salud merece atención profesional.</h2><p>Estas guías son educativas, no reemplazan una evaluación odontológica. Si presentas dolor, sangrado persistente u otros síntomas, consulta con un profesional.</p></div><Link href="/directorio">Explorar el directorio <Icono nombre="flecha" size={18}/></Link></section>
  </main>;
}
