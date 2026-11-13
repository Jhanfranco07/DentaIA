"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Icono } from "@/components/Identidad";
import { useFotografiaPreparacion } from "./FotografiaPreparacionContexto";
import { mensajeErrorCamara, mensajeValidacionFotografia, restriccionesCamara, validarFotografia } from "./fotografia";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./analisis-dental.module.css";

type Fase = "seleccion" | "revision" | "preparacion";
type Detection = { class_id: number; class_name: "d" | "D"; class_description: string; confidence: number; box: { x_min: number; y_min: number; x_max: number; y_max: number } };
type Prediction = { model: string; width: number; height: number; inference_ms: number; detections: Detection[] };
type Explanation = { source: "ai" | "default"; explanation: string };
const PUBLIC_SAMPLE_HASHES = new Set(["5dc8ba6309984f4c44050dc672051ccb2e60e66992a373910f9c225a9c483be4", "2f50d26eb8c907bc391432e1022c2240ec61010bba7fc65d1104cbbdc4905569"]);
const CLASS_DISPLAY = { d: { class_id: 0, description: "Posible caries en diente temporal" }, D: { class_id: 1, description: "Posible caries en diente permanente" } } as const;

async function sha256(archivo: File) {
  const digest = await crypto.subtle.digest("SHA-256", await archivo.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function authenticatedHeaders(headers: HeadersInit = {}) {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Inicia sesión con una cuenta autorizada para usar esta demostración.");
  const result = new Headers(headers);
  result.set("Authorization", `Bearer ${token}`);
  return result;
}

function isPrediction(value: unknown): value is Prediction {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Prediction>;
  return typeof candidate.model === "string" && Number.isFinite(candidate.width) && Number.isFinite(candidate.height)
    && Number.isFinite(candidate.inference_ms) && Array.isArray(candidate.detections)
    && candidate.detections.every(item => {
      if (!item || (item.class_name !== "d" && item.class_name !== "D")) return false;
      const expected = CLASS_DISPLAY[item.class_name]; const box = item.box;
      return item.class_id === expected.class_id && item.class_description === expected.description
        && Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1
        && !!box && [box.x_min, box.y_min, box.x_max, box.y_max].every(n => Number.isFinite(n) && n >= 0 && n <= 1)
        && box.x_min <= box.x_max && box.y_min <= box.y_max;
    });
}

function isExplanation(value: unknown): value is Explanation {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<Explanation>;
  return (result.source === "ai" || result.source === "default") && typeof result.explanation === "string" && result.explanation.length > 0 && result.explanation.length <= 350;
}

function validarDecodificacion(archivo: File) {
  return new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => { URL.revokeObjectURL(url); resolve(); };
    imagen.onerror = () => { URL.revokeObjectURL(url); reject(new Error("El archivo no se pudo abrir como imagen.")); };
    imagen.src = url;
  });
}

export default function AnalisisDental() {
  const { fotografia, establecerFotografia, limpiarFotografia } = useFotografiaPreparacion();
  const [archivo, setArchivo] = useState<File | null>(fotografia);
  const [vista, setVista] = useState("");
  const [fase, setFase] = useState<Fase>(fotografia ? "revision" : "seleccion");
  const [error, setError] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [explicando, setExplicando] = useState(false);
  const [prediccion, setPrediccion] = useState<Prediction | null>(null);
  const [explicacion, setExplicacion] = useState<Explanation | null>(null);
  const [muestraPublica, setMuestraPublica] = useState(false);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [camaraCargando, setCamaraCargando] = useState(false);
  const [flujoOrigen, setFlujoOrigen] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const botonCamara = useRef<HTMLButtonElement>(null);
  const botonSubir = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const solicitudCamara = useRef(0);

  useEffect(() => {
    let vigente = true;
    if (!archivo) { setMuestraPublica(false); return; }
    void sha256(archivo).then(hash => { if (vigente) setMuestraPublica(PUBLIC_SAMPLE_HASHES.has(hash)); }).catch(() => { if (vigente) setMuestraPublica(false); });
    return () => { vigente = false; };
  }, [archivo]);

  const detenerCamara = useCallback(() => {
    solicitudCamara.current += 1;
    stream.current?.getTracks().forEach(pista => pista.stop());
    stream.current = null;
    setCamaraAbierta(false);
    setCamaraCargando(false);
  }, []);

  useEffect(() => {
    if (!fotografia) return;
    setArchivo(fotografia);
    setFase("revision");
    setFlujoOrigen(true);
  }, [fotografia]);

  useEffect(() => {
    if (!archivo) { setVista(""); return; }
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  useEffect(() => {
    if (!stream.current || !video.current) return;
    video.current.srcObject = stream.current;
    void video.current.play().catch(() => setError("No se pudo mostrar la vista previa de la cámara."));
  }, [camaraAbierta]);

  useEffect(() => () => {
    detenerCamara();
    limpiarFotografia();
  }, [detenerCamara, limpiarFotografia]);

  useEffect(() => {
    const modo = new URLSearchParams(window.location.search).get("modo");
    if (modo === "camara") botonCamara.current?.focus();
    if (modo === "subir") botonSubir.current?.focus();
  }, []);

  const elegirArchivo = useCallback(async (seleccion: File | undefined) => {
    if (!seleccion) return;
    setError("");
    const validacion = validarFotografia(seleccion);
    if (!validacion.valido) {
      setError(mensajeValidacionFotografia(validacion.motivo));
      return;
    }
    try {
      await validarDecodificacion(seleccion);
      establecerFotografia(seleccion);
      setArchivo(seleccion);
      setFase("revision");
      setFlujoOrigen(false);
      detenerCamara();
    } catch {
      setError("El archivo no se pudo abrir como una imagen válida.");
    }
  }, [detenerCamara, establecerFotografia]);

  function manejarArchivo(evento: ChangeEvent<HTMLInputElement>) {
    void elegirArchivo(evento.target.files?.[0]);
    evento.target.value = "";
  }

  async function abrirCamara() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no permite acceder a la cámara. Puedes subir una fotografía.");
      return;
    }
    detenerCamara();
    const id = solicitudCamara.current;
    setCamaraCargando(true);
    try {
      const nueva = await navigator.mediaDevices.getUserMedia(restriccionesCamara());
      if (id !== solicitudCamara.current) {
        nueva.getTracks().forEach(pista => pista.stop());
        return;
      }
      stream.current = nueva;
      setCamaraAbierta(true);
      setCamaraCargando(false);
    } catch (fallo) {
      if (id === solicitudCamara.current) {
        setCamaraCargando(false);
        setError(mensajeErrorCamara(fallo instanceof DOMException ? fallo.name : ""));
      }
    }
  }

  async function capturarFotografia() {
    const elemento = video.current;
    if (!elemento || !elemento.videoWidth || !elemento.videoHeight) {
      setError("La cámara todavía está preparando la imagen. Espera un momento y vuelve a intentarlo.");
      return;
    }
    const lienzo = document.createElement("canvas");
    lienzo.width = elemento.videoWidth;
    lienzo.height = elemento.videoHeight;
    const contexto = lienzo.getContext("2d");
    if (!contexto) { setError("No se pudo preparar la fotografía en este navegador."); return; }
    contexto.drawImage(elemento, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>(resolver => lienzo.toBlob(resolver, "image/jpeg", .9));
    if (!blob) { setError("No se pudo capturar la imagen. Inténtalo nuevamente."); return; }
    const captura = new File([blob], `dentaia-fotografia-${Date.now()}.jpg`, { type: "image/jpeg" });
    await elegirArchivo(captura);
  }

  function cambiarFotografia() {
    detenerCamara();
    limpiarFotografia();
    setArchivo(null);
    setFase("seleccion");
    setError("");
    setConsentimiento(false);
    setPrediccion(null);
    setExplicacion(null);
  }

  async function analizar() {
    if (!archivo || !consentimiento || !muestraPublica || analizando) return;
    setError(""); setPrediccion(null); setExplicacion(null); setAnalizando(true);
    try {
      const hash = await sha256(archivo);
      if (!PUBLIC_SAMPLE_HASHES.has(hash)) throw new Error("Esta imagen no coincide con las dos muestras públicas autorizadas; no se envió al servicio.");
      const response = await fetch("/api/desarrollo/vision-poc", { method: "POST", headers: await authenticatedHeaders({ "Content-Type": archivo.type }), body: archivo, cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body && typeof body === "object" && "detail" in body ? String(body.detail) : "No se pudo analizar la imagen.");
      if (!isPrediction(body)) throw new Error("El servicio devolvió un resultado inesperado.");
      setPrediccion(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo analizar la imagen."); }
    finally { setAnalizando(false); }
  }

  async function explicar() {
    if (!prediccion || explicando) return;
    setError(""); setExplicando(true);
    try {
      const response = await fetch("/api/desarrollo/vision-poc/explain", { method: "POST", headers: await authenticatedHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ detections: prediccion.detections.map(({ class_name, confidence }) => ({ class_name, confidence })) }), cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body && typeof body === "object" && "detail" in body ? String(body.detail) : "No se pudo obtener la explicación.");
      if (!isExplanation(body)) throw new Error("El servicio devolvió una explicación inesperada.");
      setExplicacion(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo obtener la explicación."); }
    finally { setExplicando(false); }
  }

  return <section className={styles.pagina}>
    <header className={styles.hero}>
      <div className={styles.heroCopia}>
        <span className={styles.eyebrow}><Icono nombre="destello" size={15} /> ANÁLISIS DENTAL</span>
        <h1>Análisis dental <span>con IA</span></h1>
        <p>Prepara una fotograf&iacute;a y revisa el resultado educativo del modelo ONNX. El procesamiento est&aacute; limitado a dos muestras p&uacute;blicas verificadas.</p>
        <span className={styles.estadoMotor}><span aria-hidden="true" /> Motor ONNX conectado &middot; solo muestras p&uacute;blicas</span>
      </div>
      <div className={styles.heroDibujo} aria-hidden="true"><Icono nombre="diente" size={76} /><span><Icono nombre="destello" size={23} /></span></div>
    </header>

    <ol className={styles.pasos} aria-label="Etapas del recorrido">
      {(["Fotografía", "Revisión", "Preparación"] as const).map((paso, indice) => {
        const actual = fase === "seleccion" ? 0 : fase === "revision" ? 1 : 2;
        return <li key={paso} aria-current={actual === indice ? "step" : undefined} data-activo={actual === indice} data-completo={actual > indice}><span>{actual > indice ? <Icono nombre="check" size={15} /> : indice + 1}</span>{paso}</li>;
      })}
    </ol>

    {error && <div className={styles.error} role="alert"><Icono nombre="alerta" size={19} /><p>{error}</p></div>}

    {fase === "seleccion" && <div className={styles.contenido}>
      <div className={styles.seccionIntro}><span className={styles.numeroPaso}>01 / TU FOTOGRAFÍA</span><h2>Elige cómo empezar</h2><p>Usa una fotografía de demostración tomada por ti. La cámara no se activa hasta que pulses el botón.</p></div>
      <div className={styles.opciones}>
        <article className={styles.opcion}>
          <span className={styles.iconoOpcion}><Icono nombre="camara" size={24} /></span><h3>Tomar fotografía</h3><p>Solicitaremos acceso a la cámara después de tu acción. En móviles se prioriza la cámara posterior.</p>
          <button ref={botonCamara} type="button" className={styles.botonPrimario} onClick={() => void abrirCamara()} disabled={camaraCargando}><Icono nombre="camara" size={17} />{camaraCargando ? "Abriendo cámara…" : "Abrir cámara"}</button>
        </article>
        <article className={styles.opcion}>
          <span className={`${styles.iconoOpcion} ${styles.azul}`}><Icono nombre="subir" size={24} /></span><h3>Subir fotografía</h3><p>Selecciona un archivo local JPG, PNG o WebP de hasta 8 MB. No se carga a Supabase.</p>
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" onChange={manejarArchivo} className={styles.entradaOculta} aria-label="Seleccionar una fotografía" tabIndex={-1} />
          <button ref={botonSubir} type="button" className={styles.botonSecundario} onClick={() => entrada.current?.click()}><Icono nombre="imagen" size={17} /> Elegir del dispositivo</button>
        </article>
      </div>
      {camaraAbierta && <section className={styles.camara} aria-labelledby="titulo-camara">
        <div className={styles.camaraTitulo}><div><span className={styles.numeroPaso}>CÁMARA ACTIVA</span><h2 id="titulo-camara">Encuadra tu fotografía</h2></div><button type="button" className={styles.botonCerrar} onClick={detenerCamara} aria-label="Cerrar cámara"><Icono nombre="cerrar" size={18} /></button></div>
        <div className={styles.marcoCamara}><video ref={video} playsInline muted aria-label="Vista previa de la cámara" /><span className={styles.guiaCamara} aria-hidden="true" /></div>
        <p className={styles.ayudaCamara}>Mantén el teléfono estable y busca buena iluminación. La guía de encuadre es orientativa y no evalúa tu salud dental.</p>
        <button type="button" className={styles.botonPrimario} onClick={() => void capturarFotografia()}><Icono nombre="camara" size={17} /> Capturar fotografía</button>
      </section>}
      <aside className={styles.privacidad}><Icono nombre="privacidad" size={19} /><div><strong>Tu imagen se mantiene en este dispositivo</strong><p>El flujo no la almacena ni la envía. El consentimiento para guardar fotos en “Mis fotografías” es independiente, igual que el consentimiento para procesarlas se solicitar&aacute; antes del an&aacute;lisis.</p></div></aside>
      <div className={styles.enlacesSecundarios}><Link href="/fotografias">Abrir Mis fotografías guardadas <Icono nombre="flecha" size={16} /></Link><Link href="/directorio">Encontrar odontólogos <Icono nombre="flecha" size={16} /></Link></div>
    </div>}

    {fase === "revision" && archivo && <div className={styles.contenido}>
      <div className={styles.seccionIntro}><span className={styles.numeroPaso}>02 / REVISIÓN</span><h2>Revisa la fotografía</h2><p>Comprueba que la imagen se vea clara. Aún no se ha guardado ni procesado.</p></div>
      <div className={styles.revision}>
        <figure className={styles.vistaImagen}><img src={vista} alt="Vista previa local de la fotografía seleccionada" /><figcaption>Vista previa temporal · solo en este dispositivo</figcaption></figure>
        <div className={styles.detalleImagen}><span className={styles.tagImagen}><Icono nombre="imagen" size={15} /> {flujoOrigen ? "FOTO PRIVADA GUARDADA" : "FOTO LOCAL"}</span><h3>{archivo.name}</h3><dl><div><dt>Formato</dt><dd>{archivo.type.replace("image/", "").toUpperCase()}</dd></div><div><dt>Tamaño</dt><dd>{(archivo.size / 1024 / 1024).toFixed(2)} MB</dd></div></dl><h4>Consejos para revisar</h4><ul><li>Busca una imagen enfocada y con iluminación suficiente.</li><li>Evita sombras que cubran la zona que quieres mostrar.</li><li>No uses fotografías de otras personas sin autorización.</li></ul>
          <div className={styles.acciones}><button type="button" className={styles.botonSecundario} onClick={cambiarFotografia}>Cambiar fotografía</button><button type="button" className={styles.botonPrimario} onClick={() => { setConsentimiento(false); setFase("preparacion"); }}><Icono nombre="check" size={17} /> Confirmar fotografía</button></div>
        </div>
      </div>
      <aside className={styles.privacidad}><Icono nombre="privacidad" size={19} /><div><strong>Sin consentimiento de procesamiento</strong><p>Confirmar aquí solo conserva temporalmente la selección en la página. No autoriza almacenamiento ni análisis automatizado.</p></div></aside>
    </div>}

    {fase === "preparacion" && archivo && <div className={styles.contenido}>
      <div className={styles.seccionIntro}><span className={styles.numeroPaso}>03 / AN&Aacute;LISIS EDUCATIVO</span><h2>Revisa y procesa tu fotograf&iacute;a</h2><p>El servicio est&aacute; limitado a dos muestras p&uacute;blicas verificadas. Las fotos privadas, las capturas de c&aacute;mara y cualquier otra imagen no se enviar&aacute;n al servicio.</p></div>
      <div className={styles.preparacion}><figure className={styles.vistaPreparacion}><img src={vista} alt="Fotograf&iacute;a preparada para revisi&oacute;n educativa" /><figcaption>{archivo.name}</figcaption></figure><div className={styles.pasosFuturos}><span className={styles.tagPendiente}>{muestraPublica ? "Muestra p\u00fablica verificada" : "Solo muestras p&uacute;blicas"}</span><h3>Consentimiento de procesamiento</h3><p>Al continuar, autorizas el env&iacute;o temporal de esta muestra p&uacute;blica verificada al servicio ONNX. No se guardar&aacute; la imagen.</p><label className={styles.consentimiento}><input type="checkbox" checked={consentimiento} onChange={e => setConsentimiento(e.target.checked)} /> Entiendo y doy mi consentimiento para procesar esta imagen.</label><p>Solo se admiten <code>anonymous_003-007-1004-00_1731042060585_Mandibular_View.jpg</code> y <code>anonymous_003-007-1004-00_1731042060585_Maxillary_Occlusal_View.jpg</code>, verificadas por SHA-256.</p></div></div>
      <div className={styles.accionesFinales}><button type="button" className={styles.botonSecundario} onClick={() => setFase("revision")}>Volver a la fotograf&iacute;a</button><button type="button" className={styles.botonSecundario} onClick={cambiarFotografia}>Elegir otra</button><button type="button" className={styles.botonPrimario} disabled={!muestraPublica || !consentimiento || analizando} onClick={() => void analizar()}><Icono nombre="destello" size={17} />{analizando ? "Analizando..." : "Analizar muestra p&uacute;blica"}</button></div>
      {prediccion && <section className={styles.resultado} aria-live="polite"><h3>Resultado educativo</h3><p>Modelo {prediccion.model} | inferencia {prediccion.inference_ms.toFixed(3)} ms</p><div className={styles.marcoResultado}><img src={vista} alt="Fotograf&iacute;a del resultado educativo" /><svg viewBox={"0 0 " + prediccion.width + " " + prediccion.height} role="img" aria-label="Detecciones ONNX sobre la fotografia">{prediccion.detections.map((d,i)=><g key={i}><rect x={d.box.x_min*prediccion.width} y={d.box.y_min*prediccion.height} width={(d.box.x_max-d.box.x_min)*prediccion.width} height={(d.box.y_max-d.box.y_min)*prediccion.height}/><text x={d.box.x_min*prediccion.width+4} y={Math.max(17,d.box.y_min*prediccion.height-4)}>{d.class_name} | {Math.round(d.confidence*100)}%</text></g>)}</svg></div>{prediccion.detections.length ? <ul>{prediccion.detections.map((d,i)=><li key={i}><b>{d.class_name}</b> - {d.class_description} | confianza {Math.round(d.confidence*100)}%</li>)}</ul> : <p>No hay detecciones en esta imagen. Esto no significa que los dientes est&eacute;n sanos.</p>}<button type="button" className={styles.botonSecundario} disabled={explicando||!!explicacion} onClick={() => void explicar()}>{explicando?"Preparando explicaci&oacute;n...":"Solicitar explicaci&oacute;n educativa"}</button>{explicacion&&<aside className={styles.explicacion}><strong>{explicacion.source==="ai"?"Explicaci\u00f3n generada por OpenAI":"Texto predeterminado - no generado por IA"}</strong><p>{explicacion.explanation}</p></aside>}</section>}
      <aside className={styles.privacidad}><Icono nombre="privacidad" size={19}/><div><strong>Herramienta educativa, no diagn&oacute;stica</strong><p>Las detecciones no confirman una caries. La confianza no expresa gravedad ni certeza cl&iacute;nica. No reemplaza la evaluaci&oacute;n de un odont&oacute;logo.</p></div></aside>
      <div className={styles.enlacesSecundarios}><Link href="/resultados">Ir a Mis resultados <Icono nombre="flecha" size={16}/></Link><Link href="/directorio">Encontrar odontologos <Icono nombre="flecha" size={16}/></Link></div>
    </div>}
  </section>;
}
