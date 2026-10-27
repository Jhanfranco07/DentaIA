"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CASOS, AVISO_DEMO, reconocerMuestra, type CasoDemo } from "./casos";
import { descargarReporte } from "./pdf";
import { Icono } from "@/components/Identidad";
import styles from "./demo.module.css";

function ImagenCaso({ caso, resaltado = false }: { caso: CasoDemo; resaltado?: boolean }) {
  return <div className={styles.imagenCaso}><img src={caso.imagen} width={1400} height={840} alt={`Ilustración dental de ejemplo: ${caso.titulo}`} />
    {resaltado && <svg viewBox="0 0 1400 840" aria-hidden="true">{caso.regiones.map(r => <ellipse key={r.etiqueta} cx={r.x*1400} cy={r.y*840} rx={r.rx*1400} ry={r.ry*840} />)}</svg>}
  </div>;
}

export default function Demostracion() {
  const [caso, setCaso] = useState<CasoDemo | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [resultado, setResultado] = useState(false);
  const [reporte, setReporte] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const operacion = useRef(0);
  useEffect(() => () => { operacion.current++; }, []);
  useEffect(() => () => { if (vista?.startsWith("blob:")) URL.revokeObjectURL(vista); }, [vista]);

  function iniciarSeleccion() {
    setCaso(null);setResultado(false);setReporte(false);setError("");setAviso("");setVista(null);setOcupado(true);
    return ++operacion.current;
  }
  async function elegir(muestra: CasoDemo) {
    const turno = iniciarSeleccion();
    try {
      const res = await fetch(muestra.imagen);if(!res.ok)throw new Error();
      const reconocida = await reconocerMuestra(new Uint8Array(await res.arrayBuffer()));
      if (!reconocida || reconocida.id !== muestra.id) throw new Error();
      if(turno !== operacion.current)return;
      setCaso(reconocida);setVista(reconocida.imagen);setAviso("Imagen de ejemplo lista. Puedes iniciar la demostración.");
    } catch { if(turno===operacion.current)setError("No pudimos abrir esta muestra. Inténtalo nuevamente."); }
    finally { if(turno===operacion.current)setOcupado(false); }
  }
  async function abrirArchivo(file: File | undefined) {
    if(!file)return;
    const turno = iniciarSeleccion();let url: string | null = null;
    try {
      if(!["image/png","image/jpeg","image/webp"].includes(file.type) || !file.size || file.size>8_388_608){setError("Elige una imagen PNG, JPG o WebP de hasta 8 MB.");return;}
      const reconocida=await reconocerMuestra(new Uint8Array(await file.arrayBuffer()));
      if(turno!==operacion.current)return;
      if(reconocida){setCaso(reconocida);setVista(reconocida.imagen);setAviso("Reconocimos el contenido de una muestra de DentaIA. Ya puedes explorar su resultado de ejemplo.");}
      else {
        url=URL.createObjectURL(file);const imagen=new Image();imagen.src=url;await imagen.decode();
        if(turno!==operacion.current){URL.revokeObjectURL(url);return;}
        setVista(url);url=null;
        setAviso("El análisis automático de otras imágenes aún no está disponible. No asignaremos resultados a esta fotografía. Elige una de las tres muestras para continuar la demostración.");
      }
    } catch {if(turno===operacion.current)setError("No pudimos abrir esa imagen. Prueba con un archivo válido.");}
    finally {if(url)URL.revokeObjectURL(url);if(turno===operacion.current)setOcupado(false);}
  }
  async function descargar() {
    if(!caso || !resultado || generando)return;
    setGenerando(true);setError("");
    try{await descargarReporte(caso);setAviso("Tu reporte de demostración está listo para descargar.");}
    catch{setError("No pudimos preparar el PDF. Inténtalo nuevamente.");}
    finally{setGenerando(false);}
  }
  return <section>
    <header className="page-intro"><span className="eyebrow">TU GUÍA DENTAL DE EJEMPLO</span><h1>Conoce tu próximo paso.</h1><p>Explora cómo una imagen de ejemplo puede acompañarse de orientación educativa. No necesitas una fotografía personal para comenzar.</p></header>
    <div className="notice"><strong>Demostración con imágenes de ejemplo.</strong><p>Los resultados son ilustrativos y no representan un diagnóstico médico. Esta demostración no analiza fotografías mediante inteligencia artificial.</p></div>
    <ol className={styles.pasos} aria-label="Pasos de la demostración">{["Elige una imagen","Explora el resultado","Lleva tu reporte"].map((paso,i)=><li key={paso} aria-current={(reporte?2:resultado?1:0)===i?"step":undefined}><span>{i+1}</span>{paso}</li>)}</ol>
    <div className={styles.casos}>{CASOS.map((muestra,i)=><article className={`surface ${styles.caso}`} key={muestra.id}>
      <button type="button" aria-label={`Elegir ejemplo: ${muestra.titulo}`} aria-pressed={caso?.id===muestra.id} onClick={()=>void elegir(muestra)} disabled={generando} className={styles.elegir}>
        <img src={muestra.imagen} width={1400} height={840} alt={`Muestra ${i+1}, ilustración dental ficticia`} /><div><span className="eyebrow">EJEMPLO 0{i+1}</span><h2>{muestra.titulo}</h2><p>{muestra.resumen}</p><span className="text-link">{caso?.id===muestra.id?"Ejemplo seleccionado":"Elegir este ejemplo"} <span aria-hidden="true">→</span></span></div>
      </button><a href={muestra.imagen} download={`${muestra.id}.png`} className={styles.descargaMuestra}>Descargar imagen de ejemplo <span className="sr-only">{muestra.titulo}</span></a>
    </article>)}</div>
    <div className={`surface ${styles.archivo}`}><div><h2>¿Descargaste una muestra?</h2><p>Puedes volver a abrirla aquí, incluso si cambiaste su nombre. Para otras imágenes el análisis automático todavía no está disponible.</p></div><label className={styles.campoArchivo}>Abrir una imagen<input type="file" accept="image/png,image/jpeg,image/webp" disabled={generando} onChange={e=>{void abrirArchivo(e.target.files?.[0]);e.target.value="";}} /></label></div>
    {error&&<p className="notice notice-error" role="alert">{error}</p>}{aviso&&<p className="notice" role="status">{aviso}</p>}{ocupado&&<p role="status">Preparando tu imagen de ejemplo…</p>}
    {vista&&!resultado&&<section className={`surface ${styles.seleccion}`} aria-label="Imagen seleccionada"><div>{caso?<ImagenCaso caso={caso}/>:<img src={vista} alt="Imagen elegida en este navegador, sin análisis automático" />}</div><div><span className="eyebrow">TU SELECCIÓN</span><h2>{caso?.titulo??"Tu imagen"}</h2><p>{caso?"El resultado de este ejemplo está preparado de antemano. No se analiza la imagen ni se calcula un diagnóstico.":"Esta imagen no tiene un resultado de demostración asociado. Puedes elegir una muestra de la colección."}</p><button className="action" disabled={!caso||ocupado} onClick={()=>{setResultado(true);requestAnimationFrame(()=>document.getElementById("resultado-demo")?.focus());}}>Iniciar demostración <Icono nombre="flecha" size={18}/></button><p className={styles.privacidad}>Esta selección no se guarda en tu cuenta.</p></div></section>}
    {caso&&resultado&&<section className={styles.resultado}>
      <header><span className="pill">{AVISO_DEMO}</span><h2 id="resultado-demo" tabIndex={-1}>Tu resultado de ejemplo</h2><p>{caso.titulo} · Observaciones preparadas para esta ilustración.</p></header>
      <div className={styles.resultadoGrid}><div className={`surface ${styles.ilustracion}`}><ImagenCaso caso={caso} resaltado/><p>{caso.regiones.length?caso.regiones.map(r=>r.etiqueta).join(" · "):"Ejemplo sin regiones resaltadas"}. No representa un diagnóstico.</p></div><div className={`surface ${styles.notas}`}><h3>Qué muestra este ejemplo</h3>{caso.observaciones.map(p=><p key={p}>{p}</p>)}<h3>Ideas para tu cuidado</h3><ul>{caso.recomendaciones.map(p=><li key={p}>{p}</li>)}</ul></div></div>
      <div className="actions"><button className="action" onClick={()=>{setReporte(true);requestAnimationFrame(()=>document.getElementById("reporte-demo")?.focus());}}><Icono nombre="reporte" size={19}/> Ver mi reporte</button><Link href="/directorio" className="action action-secondary">Encontrar odontólogo</Link><button className={styles.volver} onClick={()=>{setResultado(false);setReporte(false);}}>Volver a elegir</button></div>
    </section>}
    {caso&&resultado&&reporte&&<section className={`surface ${styles.reporte}`} aria-labelledby="reporte-demo"><div><span className="eyebrow">TU REPORTE PREVENTIVO DE DEMOSTRACIÓN</span><h2 id="reporte-demo" tabIndex={-1}>Una guía para llevar contigo.</h2><p>Incluye la imagen de ejemplo, las regiones ilustrativas, observaciones y recomendaciones. No contiene tu nombre ni tu correo.</p><p className="pill">{AVISO_DEMO}</p></div><div className="actions"><button className="action" disabled={generando} aria-busy={generando} onClick={()=>void descargar()}>{generando?"Preparando PDF…":"Descargar reporte PDF"}</button><Link className="text-link" href="/directorio">Consultar profesionales</Link></div></section>}
    <aside className={styles.pie}><strong>¿Quieres probar el guardado de fotografías?</strong><p>Descarga una de las muestras y abre <Link href="/fotografias">Mis fotografías</Link>. El guardado real requiere iniciar sesión y aceptar su consentimiento por separado. Guardar una imagen no autoriza su procesamiento mediante IA.</p><Link href="/privacidad">Leer sobre privacidad y consentimiento</Link></aside>
  </section>;
}
