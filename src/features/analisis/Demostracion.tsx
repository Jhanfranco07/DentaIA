"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CASOS, AVISO_DEMO, reconocerMuestra, type CasoDemo } from "./casos";
import { descargarReporte, prepararReporte } from "./pdf";
import { CLAVE_SESION_DEMO, enlaceDirectorioDemo, leerSesionDemo, pasoVisible, type EtapaDemo } from "./flujo";
import { Icono } from "@/components/Identidad";
import styles from "./demo.module.css";

function ImagenCaso({ caso, resaltado = false }: { caso: CasoDemo; resaltado?: boolean }) {
  return <div className={styles.imagenCaso}>
    <img src={caso.imagen} alt={`Imagen educativa de referencia: ${caso.titulo}`} />
    {resaltado && <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">{caso.regiones.map((r, i) => <ellipse key={r.etiqueta} cx={r.x * 1000} cy={r.y * 1000} rx={r.rx * 1000} ry={r.ry * 1000} vectorEffect="non-scaling-stroke" style={{ animationDelay: `${i * 180}ms` }} />)}</svg>}
  </div>;
}

const TITULOS: Record<EtapaDemo, string> = {
  seleccion: "Tu cuidado empieza con una mirada.", revision: "Una imagen, un punto de partida.", preparacion: "Preparando tu guía educativa.", resultado: "Mira el ejemplo con otros ojos.", recomendaciones: "Pequeños hábitos. Un cuidado constante.", reporte: "Tu guía, lista para acompañarte.", orientacion: "Tú eliges el siguiente paso.", final: "Un buen comienzo para tu cuidado.",
};
const PASOS = ["Tu imagen", "Revisar", "Resultado", "Tu cuidado", "Mi reporte", "Próximo paso"];

export default function Demostracion() {
  const [caso, setCaso] = useState<CasoDemo | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<EtapaDemo>("seleccion");
  const [ocupado, setOcupado] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [restaurando, setRestaurando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [pdf, setPdf] = useState<Uint8Array | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [preparandoReporte, setPreparandoReporte] = useState(false);
  const [fecha, setFecha] = useState(() => new Date().toISOString());
  const operacion = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const encabezado = useRef<HTMLHeadingElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const focoInicial = useRef(true);

  useEffect(() => {
    let activo = true;
    async function restaurar() {
      try {
        const guardada = leerSesionDemo(sessionStorage.getItem(CLAVE_SESION_DEMO), CASOS.map(c => c.id));
        if (!guardada) return;
        const muestra = CASOS.find(c => c.id === guardada.casoId)!;
        const res = await fetch(muestra.imagen);
        if (!res.ok) return;
        const reconocida = await reconocerMuestra(new Uint8Array(await res.arrayBuffer()));
        if (!activo || reconocida?.id !== muestra.id) return;
        setCaso(reconocida); setVista(reconocida.imagen); setFecha(guardada.fechaISO);
        setEtapa(new URLSearchParams(window.location.search).get("reporte") === "1" ? "reporte" : guardada.etapa);
      } catch { /* Sin almacenamiento disponible, el recorrido sigue funcionando en memoria. */ }
      finally { if (activo) setRestaurando(false); }
    }
    void restaurar();
    return () => { activo = false; operacion.current++; if (temporizador.current) clearTimeout(temporizador.current); };
  }, []);
  useEffect(() => {
    if (restaurando || !caso) return;
    try { sessionStorage.setItem(CLAVE_SESION_DEMO, JSON.stringify({ casoId: caso.id, etapa, fechaISO: fecha })); } catch { /* No se exige persistencia para continuar. */ }
  }, [caso, etapa, fecha, restaurando]);
  useEffect(() => () => { if (vista?.startsWith("blob:")) URL.revokeObjectURL(vista); }, [vista]);
  useEffect(() => {
    if (focoInicial.current) { focoInicial.current = false; return; }
    encabezado.current?.focus({ preventScroll: true });
    encabezado.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [etapa]);

  useEffect(() => {
    if (etapa !== "reporte" || !caso) return;
    let activo = true; let url: string | null = null;
    setPdf(null); setPdfUrl(null); setPreparandoReporte(true);
    void prepararReporte(caso, new Date(fecha)).then(contenido => {
      if (!activo) return;
      url = URL.createObjectURL(new Blob([Uint8Array.from(contenido).buffer], { type: "application/pdf" }));
      setPdf(contenido); setPdfUrl(url);
    }).catch(() => { if (activo) setError("No pudimos preparar la vista previa. Puedes volver a intentarlo descargando el PDF."); })
      .finally(() => { if (activo) setPreparandoReporte(false); });
    return () => { activo = false; if (url) URL.revokeObjectURL(url); };
  }, [etapa, caso, fecha]);

  function ir(siguiente: EtapaDemo) { setError(""); setAviso(""); setEtapa(siguiente); }
  function iniciarSeleccion() {
    if (temporizador.current) clearTimeout(temporizador.current);
    setCaso(null); setError(""); setAviso(""); setVista(null); setOcupado(true);
    try { sessionStorage.removeItem(CLAVE_SESION_DEMO); } catch { /* Almacenamiento opcional. */ }
    return ++operacion.current;
  }
  async function elegir(muestra: CasoDemo) {
    const turno = iniciarSeleccion();
    try {
      const res = await fetch(muestra.imagen); if (!res.ok) throw new Error();
      const reconocida = await reconocerMuestra(new Uint8Array(await res.arrayBuffer()));
      if (!reconocida || reconocida.id !== muestra.id) throw new Error();
      if (turno !== operacion.current) return;
      setCaso(reconocida); setVista(reconocida.imagen); setFecha(new Date().toISOString()); ir("revision");
    } catch { if (turno === operacion.current) setError("No pudimos abrir esta muestra. Inténtalo nuevamente."); }
    finally { if (turno === operacion.current) setOcupado(false); }
  }
  async function abrirArchivo(file: File | undefined) {
    if (!file) return;
    const turno = iniciarSeleccion(); let url: string | null = null;
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size || file.size > 8_388_608) { setError("Elige una imagen PNG, JPG o WebP de hasta 8 MB."); return; }
      const reconocida = await reconocerMuestra(new Uint8Array(await file.arrayBuffer()));
      if (turno !== operacion.current) return;
      if (reconocida) { setCaso(reconocida); setVista(reconocida.imagen); setFecha(new Date().toISOString()); ir("revision"); setAviso("Reconocimos el contenido de una muestra, aunque hayas cambiado su nombre."); }
      else {
        url = URL.createObjectURL(file); const imagen = new Image(); imagen.src = url; await imagen.decode();
        if (turno !== operacion.current) return;
        setVista(url); url = null; ir("revision");
        setAviso("Esta imagen no tiene un resultado educativo asociado. El análisis automático de otras imágenes aún no está disponible. No asignaremos observaciones a tu fotografía.");
      }
    } catch { if (turno === operacion.current) setError("No pudimos abrir esa imagen. Prueba con un archivo válido."); }
    finally { if (url) URL.revokeObjectURL(url); if (turno === operacion.current) setOcupado(false); }
  }
  function preparar() {
    if (!caso) return;
    ir("preparacion");
    const turno = ++operacion.current;
    temporizador.current = setTimeout(() => { if (turno === operacion.current) ir("resultado"); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 180 : 1400);
  }
  function mostrarResultado() { if (temporizador.current) clearTimeout(temporizador.current); operacion.current++; ir("resultado"); }
  function reiniciar() { iniciarSeleccion(); setOcupado(false); ir("seleccion"); }
  async function descargar() {
    if (!caso || generando) return;
    setGenerando(true); setError("");
    try { await descargarReporte(caso, pdf ?? undefined); setAviso("Tu reporte de demostración está listo para descargar."); }
    catch { setError("No pudimos preparar el PDF. Inténtalo nuevamente."); }
    finally { setGenerando(false); }
  }
  function ampliar() { dialogo.current?.showModal(); }
  const paso = pasoVisible(etapa);

  return <section className={styles.experiencia} aria-busy={restaurando || ocupado}>
    <div className={styles.encabezado}><div><span className="eyebrow">DENTAIA · EXPERIENCIA EDUCATIVA</span><h1 ref={encabezado} tabIndex={-1}>{TITULOS[etapa]}</h1><p>{etapa === "seleccion" ? "Explora un ejemplo educativo y descubre una guía de cuidado, a tu ritmo." : "Una demostración para orientarte. Las decisiones sobre tu salud se toman con un profesional."}</p></div><span className={styles.sello}><Icono nombre="escudo" size={18} /> Sin diagnóstico médico</span></div>
    <ol className={styles.pasos} aria-label="Tu recorrido educativo">{PASOS.map((nombre, i) => <li key={nombre} aria-current={paso === i ? "step" : undefined} data-completo={paso > i}><span>{paso > i ? "✓" : `0${i + 1}`}</span><strong>{nombre}</strong></li>)}</ol>
    <div className={styles.transparencia}><Icono nombre="escudo" size={19}/><p><strong>{AVISO_DEMO}.</strong> Las observaciones están preparadas de antemano para estas muestras. No se realiza un análisis de inteligencia artificial.</p></div>
    {error && <p className="notice notice-error" role="alert">{error}</p>}{aviso && <p className="notice" role="status">{aviso}</p>}
    {(restaurando || ocupado) && <div className={styles.cargando} role="status"><span className={styles.spinner} />{restaurando ? "Preparando tu recorrido…" : "Abriendo la imagen de ejemplo…"}</div>}

    {!restaurando && etapa === "seleccion" && <div className={styles.etapa}>
      <div className={styles.tituloSeccion}><div><span className="eyebrow">01 / ELIGE TU PUNTO DE PARTIDA</span><h2>Tres ejemplos. Una mirada preventiva.</h2></div><p>No necesitas subir una fotografía personal.</p></div><p className={styles.avisoFotografias}><strong>Fotografías clínicas pendientes.</strong> Las referencias editoriales actuales no son fotografías clínicas. La colección se incorporará cuando podamos verificar su autorización de reutilización.</p>
      <div className={styles.casos}>{CASOS.map((muestra, i) => <article className={styles.caso} key={muestra.id}>
        <button type="button" aria-label={`Elegir ejemplo: ${muestra.titulo}`} aria-pressed={caso?.id === muestra.id} onClick={() => void elegir(muestra)} disabled={ocupado} className={styles.elegir}>
          <div className={styles.fotoTarjeta}><img src={muestra.imagen} alt={`Referencia educativa ${i + 1}: ${muestra.titulo}`} /><span>CASO 0{i + 1}</span></div>
          <div className={styles.contenidoTarjeta}><h3>{muestra.titulo}</h3><p>{muestra.resumen}</p><span className={styles.enlaceTarjeta}>Elegir este ejemplo <Icono nombre="flecha" size={18}/></span></div>
        </button><a href={muestra.imagen} download className={styles.descargaMuestra}><Icono nombre="reporte" size={16}/> Descargar muestra <span className="sr-only">{muestra.titulo}</span></a>
      </article>)}</div>
      <div className={styles.archivo}><div><h3>¿Ya tienes una de nuestras muestras?</h3><p>Ábrela aquí. Reconocemos el contenido de las muestras, incluso con otro nombre. Una imagen diferente no recibe resultados predefinidos.</p></div><label className={styles.campoArchivo}>Abrir una imagen<input type="file" accept="image/png,image/jpeg,image/webp" disabled={ocupado} onChange={e => { void abrirArchivo(e.target.files?.[0]); e.target.value = ""; }} /></label></div>
      <p className={styles.notaPrivacidad}><Icono nombre="escudo" size={16}/>Tu selección permanece en este navegador y no se guarda en tu cuenta.</p>
    </div>}

    {etapa === "revision" && vista && <div className={`${styles.etapa} ${styles.revision}`}>
      <div className={styles.panelFoto}>{caso ? <ImagenCaso caso={caso}/> : <img src={vista} alt="Imagen elegida en este navegador, sin análisis automático"/>}<button type="button" onClick={ampliar} className={styles.ampliar}>Ampliar imagen <span aria-hidden="true">↗</span></button></div>
      <div className={styles.panelTexto}><span className="eyebrow">02 / REVISA TU SELECCIÓN</span><h2>{caso?.titulo ?? "Tu imagen"}</h2><p>{caso?.resumen ?? "Puedes consultar tu fotografía, pero no generar observaciones educativas para una imagen desconocida."}</p><div className={styles.detalle}><Icono nombre="reporte" size={22}/><p>Al continuar verás observaciones educativas preparadas para este ejemplo. No evalúan tu estado de salud.</p></div><button className="action" disabled={!caso || ocupado} onClick={preparar}>Ver mi análisis de ejemplo <Icono nombre="flecha" size={18}/></button><button className={styles.volver} onClick={reiniciar}>← Cambiar de muestra</button><p className={styles.notaPrivacidad}>Esta selección no se guarda como fotografía privada.</p></div>
    </div>}

    {etapa === "preparacion" && caso && <div className={`${styles.etapa} ${styles.preparacion}`} role="status">
      <div className={styles.fotoPreparacion}><ImagenCaso caso={caso}/><span className={styles.insigniaPreparacion}><span className={styles.spinner}/>Preparando resultados educativos</span></div><div className={styles.textoPreparacion}><span className="eyebrow">UN MOMENTO PARA TU GUÍA</span><h2>Organizando el ejemplo y sus recomendaciones.</h2><p>Son contenidos educativos predefinidos. No estamos analizando tu salud ni realizando una inferencia de inteligencia artificial.</p><div className={styles.progresoPreparacion} aria-hidden="true"/><button className={styles.volver} onClick={mostrarResultado}>Mostrar resultado ahora</button><button className={styles.volver} onClick={() => { if (temporizador.current) clearTimeout(temporizador.current); operacion.current++; ir("revision"); }}>Volver a la imagen</button></div>
    </div>}

    {etapa === "resultado" && caso && <div className={styles.etapa}>
      <div className={styles.tituloSeccion}><div><span className="eyebrow">03 / TU RESULTADO DE EJEMPLO</span><h2>{caso.titulo}</h2></div><span className={styles.etiqueta}>Observaciones educativas</span></div>
      <div className={styles.resultadoGrid}><div className={styles.panelFoto}><ImagenCaso caso={caso} resaltado/><div className={styles.leyenda}><span className={styles.punto}/>{caso.regiones.length ? caso.regiones.map(r => r.etiqueta).join(" · ") : "Ejemplo sin regiones resaltadas"}<button className={styles.ampliarTexto} onClick={ampliar}>Ampliar</button></div><p className={styles.aclaracion}>Las marcas son referencias visuales preparadas para una imagen autorizada, cuando estén disponibles. No indican una enfermedad detectada.</p></div><div className={styles.observaciones}><span className="eyebrow">UNA MIRADA PARA APRENDER</span><h3>Qué muestra este ejemplo</h3>{caso.observaciones.map((p, i) => <div className={styles.observacion} key={p}><span>0{i + 1}</span><p>{p}</p></div>)}<div className={styles.limite}><Icono nombre="escudo" size={22}/><p>Una fotografía de ejemplo no permite confirmar un diagnóstico ni recomendar un tratamiento.</p></div></div></div>
      <div className={styles.acciones}><button className={styles.volver} onClick={() => ir("revision")}>← Volver a la imagen</button><button className="action" onClick={() => ir("recomendaciones")}>Ver recomendaciones <Icono nombre="flecha" size={18}/></button></div>
    </div>}

    {etapa === "recomendaciones" && caso && <div className={styles.etapa}>
      <div className={styles.tituloSeccion}><div><span className="eyebrow">04 / IDEAS PARA TU CUIDADO</span><h2>Una rutina que empieza contigo.</h2></div><p>Orientación general para conversar con tu odontólogo.</p></div>
      <div className={styles.recomendaciones}>{caso.recomendaciones.map((p, i) => <article className={styles.recomendacion} key={p} style={{ animationDelay: `${i * 110}ms` }}><span className={styles.numeroConsejo}>0{i + 1}</span><Icono nombre={i === 1 ? "escudo" : "diente"} size={32}/><h3>{["Cuida tu día a día", "Presta atención con calma", "Conversa con un profesional"][i] ?? "Para recordar"}</h3><p>{p}</p></article>)}</div>
      <div className={styles.cuidadoNota}><Icono nombre="persona" size={26}/><p>Estas recomendaciones son educativas y no constituyen un tratamiento personalizado. Si tienes dolor, sangrado persistente o una urgencia, busca atención profesional.</p></div>
      <div className={styles.acciones}><button className={styles.volver} onClick={() => ir("resultado")}>← Volver al resultado</button><button className="action" onClick={() => ir("reporte")}><Icono nombre="reporte" size={19}/> Ver mi reporte</button></div>
    </div>}

    {etapa === "reporte" && caso && <div className={`${styles.etapa} ${styles.reporteGrid}`}>
      <div className={styles.reporteTexto}><span className="eyebrow">05 / MI REPORTE PREVENTIVO</span><h2>Una guía para llevar contigo.</h2><p>Tu ejemplo, las observaciones y las ideas de cuidado, reunidos en un documento educativo.</p><ul className={styles.listaReporte}><li>Imagen y contexto del ejemplo</li><li>Observaciones y recomendaciones</li><li>Próximos pasos a tu elección</li></ul><p className={styles.notaPrivacidad}>No incluye tu nombre, correo ni historial de salud.</p>{preparandoReporte && <p role="status">Preparando la vista previa del PDF…</p>}{pdfUrl && <a className={styles.enlacePDF} href={pdfUrl} target="_blank" rel="noopener noreferrer">Abrir vista previa PDF <span aria-hidden="true">↗</span></a>}<button className="action" disabled={generando} aria-busy={generando} onClick={() => void descargar()}><Icono nombre="reporte" size={18}/>{generando ? "Preparando PDF…" : "Descargar reporte PDF"}</button><button className={`action action-secondary ${styles.continuarReporte}`} onClick={() => ir("orientacion")}>Continuar <Icono nombre="flecha" size={18}/></button><button className={styles.volver} onClick={() => ir("resultado")}>← Volver al resultado</button></div>
      <article className={styles.documento} aria-label="Vista previa del reporte preventivo"><header><span className={styles.marcaReporte}>Denta<span>IA</span></span><span>REPORTE EDUCATIVO</span></header><div className={styles.documentoTitulo}><span className="eyebrow">REPORTE PREVENTIVO</span><h3>{caso.titulo}</h3><p>{new Date(fecha).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Lima" })} · DEMO-{caso.id}</p></div><ImagenCaso caso={caso} resaltado/><div className={styles.documentoCuerpo}><span className={styles.etiqueta}>{AVISO_DEMO}</span><h4>Observaciones educativas</h4>{caso.observaciones.map(p => <p key={p}>{p}</p>)}<h4>Para tu cuidado cotidiano</h4><ol>{caso.recomendaciones.map(p => <li key={p}>{p}</li>)}</ol><div className={styles.documentoPasos}><strong>Tu siguiente paso</strong><p>Mantén tus hábitos de higiene y considera una evaluación odontológica cuando lo necesites.</p></div><footer>No representa un diagnóstico ni reemplaza una evaluación odontológica.<br/>DentaIA · Guía de demostración · 1 / 1</footer></div></article>
    </div>}

    {etapa === "orientacion" && caso && <div className={`${styles.etapa} ${styles.orientacion}`}>
      <div className={styles.orientacionIcono}><Icono nombre="persona" size={40}/></div><span className="eyebrow">06 / TU SIGUIENTE PASO ES OPCIONAL</span><h2>¿Te gustaría encontrar un odontólogo cerca de ti?</h2><p>Si deseas recibir orientación profesional, puedes explorar odontólogos y solicitar una atención cuando lo necesites.</p><div className={styles.contextoCaso}><strong>{caso.id === "cuidado-habitual" ? "Para un control odontológico general" : caso.id === "cuidado-encias" ? "Para conversar sobre el cuidado de tus encías" : "Para una evaluación preventiva"}</strong><p>Explora los distritos y especialidades disponibles en el directorio.</p></div><div className={styles.orientacionAcciones}><Link className="action" href={enlaceDirectorioDemo(caso.id)}>Buscar odontólogos <Icono nombre="flecha" size={18}/></Link><button className="action action-secondary" onClick={() => ir("final")}>Omitir por ahora</button></div><p className={styles.notaPrivacidad}>Los profesionales del directorio son ficticios. Solo mostramos distritos; no calculamos distancias ni disponibilidad real.</p><button className={styles.volver} onClick={() => ir("reporte")}>← Volver a mi reporte</button>
    </div>}

    {etapa === "final" && caso && <div className={`${styles.etapa} ${styles.final}`}>
      <div className={styles.checkFinal} aria-hidden="true">✓</div><span className="eyebrow">RECORRIDO DE DEMOSTRACIÓN COMPLETADO</span><h2>Tu próximo paso puede esperar.<br/>Tu cuidado, acompañarte.</h2><p>Terminaste esta experiencia educativa. Tu reporte sigue disponible durante esta sesión; puedes volver a él cuando quieras.</p><div className={styles.orientacionAcciones}><button className="action" onClick={() => ir("reporte")}><Icono nombre="reporte" size={18}/> Consultar mi reporte</button><Link className="action action-secondary" href="/">Volver al inicio</Link></div><button className={styles.volver} onClick={reiniciar}>Realizar otra demostración <span aria-hidden="true">↗</span></button><p className={styles.notaPrivacidad}>También puedes encontrar odontólogos más adelante desde el menú. No se ha creado ninguna solicitud de atención.</p>
    </div>}
    <footer className={styles.pie}><div><Icono nombre="escudo" size={20}/><span>Tu información personal queda fuera de esta demostración.</span></div><Link href="/privacidad">Privacidad y consentimiento <span aria-hidden="true">↗</span></Link></footer>
    <dialog ref={dialogo} className={styles.dialogo} onClick={e => { if (e.target === dialogo.current) dialogo.current.close(); }} aria-label="Fotografía ampliada"><div className={styles.dialogoEncabezado}><strong>{caso?.titulo ?? "Tu imagen"}</strong><button className="action action-secondary" onClick={() => dialogo.current?.close()} autoFocus>Cerrar <span aria-hidden="true">×</span></button></div>{caso ? <ImagenCaso caso={caso} resaltado={etapa === "resultado" || etapa === "reporte"}/> : vista && <img src={vista} alt="Imagen elegida, sin análisis automático"/>}<p>Imagen de referencia educativa. No representa un diagnóstico.</p></dialog>
  </section>;
}
