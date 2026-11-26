"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Icono } from "@/components/Identidad";
import { useFotografiaPreparacion } from "./FotografiaPreparacionContexto";
import { cambioCamaraConfirmado, mensajeErrorCamara, mensajeValidacionFotografia, restriccionesCamara, validarFotografia, type OrientacionCamara } from "./fotografia";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { countReviewRegions, isSmileAnalysisResponse, isSmileExplanation, type SmileExplanation, type SmileResult, type OralBasicAnalysis } from "./smile-contract";
import { isPremiumVisionResult, type PremiumVisionResult } from "@/features/premium-vision/contract";
import styles from "./analisis-dental.module.css";
import ResultadosVisuales from "./ResultadosVisuales";
import CamaraDental from "./guia/CamaraDental";

type Fase = "preparacion" | "carga" | "analizando" | "resultado" | "detalle";
type SesionCamara = { id: number; flujo: MediaStream; orientacion: OrientacionCamara; alternable: boolean };
const PASOS = ["Preparación", "Carga", "Análisis", "Resultado"] as const;

function validarDecodificacion(archivo: File) {
  return new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => { URL.revokeObjectURL(url); resolve(); };
    imagen.onerror = () => { URL.revokeObjectURL(url); reject(new Error("El archivo no se pudo abrir como imagen.")); };
    imagen.src = url;
  });
}

function pasoActual(fase: Fase) {
  if (fase === "preparacion") return 0;
  if (fase === "carga") return 1;
  if (fase === "analizando") return 2;
  return 3;
}

function fallbackExplanation(result: SmileResult): SmileExplanation {
  const review = countReviewRegions(result);
  const variations = result.regions.filter(region => region.evaluable && (region.partial || region.level !== "Sin amarillo destacado")).length;
  const lighting = result.regions.filter(region => region.evaluable && region.illumination_warning).length;
  return {
    summary: result.status === "not_evaluable"
      ? "No pude evaluar bien la tonalidad de tu sonrisa con esta foto. Prueba otra vez con luz natural, de frente y sin filtros."
      : variations
        ? `En esta foto, ${variations} ${variations === 1 ? "región dental muestra" : "regiones dentales muestran"} una tonalidad diferente al resto.`
        : `Pude revisar ${result.evaluable_regions} regiones dentales y ninguna mostró una diferencia de tonalidad por encima del umbral orientativo.`,
    observations: [
      ...(variations ? ["La imagen sugiere una diferencia de color visible; por sí sola no permite saber la causa ni confirmar un problema dental."] : []),
      ...(lighting ? [`La iluminación, las sombras o los reflejos podrían estar influyendo en ${lighting} ${lighting === 1 ? "región" : "regiones"}.`] : []),
      ...(!review ? ["Aun así, una fotografía no permite confirmar que todos los dientes estén sanos."] : []),
    ],
    recommendation: "Si esa diferencia también se nota en persona, ha cambiado recientemente o te preocupa, conviene que la revise un odontólogo.",
    disclaimer: "Orientación basada en una fotografía: no es un diagnóstico y las regiones detectadas no equivalen necesariamente a dientes afectados.",
    source: "template",
  };
}

function Stepper({ fase }: { fase: Fase }) {
  const actual = pasoActual(fase);
  return <ol className={styles.stepper} aria-label="Progreso del análisis">
    {PASOS.map((paso, index) => <li key={paso} data-activo={index === actual} data-completo={index < actual} aria-current={index === actual ? "step" : undefined}>
      <span>{index < actual ? <Icono nombre="check" size={18} /> : index + 1}</span><strong>{paso}</strong>
    </li>)}
  </ol>;
}

function Mascota({ compacta = false }: { compacta?: boolean }) {
  return <div className={compacta ? styles.mascotaCompacta : styles.mascota} aria-hidden="true">
    <span><Icono nombre="diente" size={compacta ? 38 : 76} /></span><i>✦</i><b>✦</b>
  </div>;
}

export default function AnalisisDental() {
  const { fotografia, establecerFotografia, limpiarFotografia } = useFotografiaPreparacion();
  const [fase, setFase] = useState<Fase>(fotografia ? "carga" : "preparacion");
  const [archivo, setArchivo] = useState<File | null>(fotografia);
  const [vista, setVista] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [premiumDisponible, setPremiumDisponible] = useState(false);
  const [premiumSolicitado, setPremiumSolicitado] = useState(false);
  const [premium, setPremium] = useState<PremiumVisionResult | null>(null);
  const [premiumError, setPremiumError] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<SmileResult | null>(null);
  const [overlay, setOverlay] = useState("");
  const [oral, setOral] = useState<OralBasicAnalysis | null>(null);
  const [explicacion, setExplicacion] = useState<SmileExplanation | null>(null);
  const [explicando, setExplicando] = useState(false);
  const [camara, setCamara] = useState<SesionCamara | null>(null);
  const [camaraCargando, setCamaraCargando] = useState(false);
  const [guiaActiva, setGuiaActiva] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const solicitudCamara = useRef(0);
  const camaraOcupada = useRef(false);
  const flujoCamara = camara?.flujo;
  const explicacionSolicitada = useRef<string | null>(null);
  const explicacionAbortada = useRef<AbortController | null>(null);

  const detenerCamara = useCallback(() => {
    solicitudCamara.current += 1;
    camaraOcupada.current = false;
    if (video.current) video.current.srcObject = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    setCamara(null);
    setCamaraCargando(false);
    setGuiaActiva(false);
    setCapturando(false);
  }, []);

  useEffect(() => {
    if (!archivo) { setVista(""); return; }
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  useEffect(() => {
    const actual = flujoCamara;
    const vistaCamara = video.current;
    if (!actual || !vistaCamara) return;
    function recuperar() {
      if (actual !== stream.current) return;
      detenerCamara();
      setError("La cámara dejó de mostrar imagen. Puedes abrirla de nuevo o subir una fotografía.");
    }
    const pistas = actual.getVideoTracks();
    pistas.forEach(pista => pista.addEventListener("ended", recuperar));
    vistaCamara.srcObject = actual;
    void vistaCamara.play().catch(recuperar);
    return () => pistas.forEach(pista => pista.removeEventListener("ended", recuperar));
  }, [flujoCamara, detenerCamara]);

  useEffect(() => () => detenerCamara(), [detenerCamara]);
  useEffect(() => () => explicacionAbortada.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    void getSupabaseBrowserClient().auth.getSession().then(async ({ data, error }) => {
      if (error || !data.session || controller.signal.aborted) return;
      const response = await fetch("/api/premium/status", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store", signal: controller.signal,
      });
      if (!response.ok || controller.signal.aborted) return;
      const status: unknown = await response.json();
      if (!controller.signal.aborted && status && typeof status === "object" &&
        "premium_vision_available" in status && status.premium_vision_available === true) setPremiumDisponible(true);
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  const elegirArchivo = useCallback(async (seleccion?: File, origenCamara?: number) => {
    if (!seleccion) return;
    setError("");
    const validacion = validarFotografia(seleccion);
    if (!validacion.valido) { setError(mensajeValidacionFotografia(validacion.motivo)); return; }
    try {
      await validarDecodificacion(seleccion);
      if (origenCamara !== undefined && origenCamara !== solicitudCamara.current) return;
      explicacionAbortada.current?.abort(); explicacionSolicitada.current = null;
      detenerCamara();
      establecerFotografia(seleccion);
      setArchivo(seleccion);
      setConsentimiento(false);
      setResultado(null); setOverlay(""); setOral(null); setExplicacion(null); setPremium(null); setPremiumError(false);
    } catch {
      if (origenCamara === undefined || origenCamara === solicitudCamara.current) {
        setError("El archivo no se pudo abrir como una imagen válida.");
      }
    }
  }, [detenerCamara, establecerFotografia]);

  function manejarArchivo(event: ChangeEvent<HTMLInputElement>) {
    void elegirArchivo(event.target.files?.[0]);
    event.target.value = "";
  }

  function soltar(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void elegirArchivo(event.dataTransfer.files?.[0]);
  }

  async function abrirCamara(anterior?: SesionCamara) {
    if (camaraOcupada.current || (anterior && anterior.flujo !== stream.current)) return;
    const dispositivos = navigator.mediaDevices;
    if (!dispositivos?.getUserMedia) {
      setError("Este navegador no permite usar la cámara. Puedes subir una fotografía.");
      return;
    }
    const dispositivoAnterior = anterior?.flujo.getVideoTracks()[0]?.getSettings().deviceId;
    const admiteFacingMode = dispositivos.getSupportedConstraints?.().facingMode;
    setError("");
    detenerCamara();
    camaraOcupada.current = true;
    setCamaraCargando(true);
    const requestId = solicitudCamara.current;
    let orientacion: OrientacionCamara = anterior?.orientacion === "environment" ? "user" : "environment";
    let aviso = "";
    try {
      let next: MediaStream;
      try {
        next = await dispositivos.getUserMedia(restriccionesCamara(orientacion, Boolean(anterior)));
        const actual = next.getVideoTracks()[0]?.getSettings();
        if (anterior && !cambioCamaraConfirmado(dispositivoAnterior, actual, orientacion, admiteFacingMode === true)) {
          next.getTracks().forEach(pista => pista.stop());
          throw new DOMException("No se pudo confirmar el cambio de cámara", "NotFoundError");
        }
      } catch (cause) {
        const nombre = cause instanceof DOMException ? cause.name : "";
        if (!anterior || requestId !== solicitudCamara.current
          || ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(nombre)) throw cause;
        orientacion = anterior.orientacion;
        next = await dispositivos.getUserMedia(restriccionesCamara(orientacion));
        aviso = "No se pudo cambiar de cámara. Puedes capturar con la cámara disponible.";
      }
      if (requestId !== solicitudCamara.current) {
        next.getTracks().forEach(pista => pista.stop());
        return;
      }
      const frente = next.getVideoTracks()[0]?.getSettings().facingMode;
      stream.current = next;
      setCamara({
        id: requestId,
        flujo: next,
        orientacion: frente === "user" || frente === "environment" ? frente : orientacion,
        alternable: admiteFacingMode !== false,
      });
      setGuiaActiva(Boolean(anterior) && guiaActiva);
      setError(aviso);
      void dispositivos.enumerateDevices?.().then(lista => {
        if (lista.filter(dispositivo => dispositivo.kind === "videoinput").length !== 1) return;
        setCamara(actual => actual?.id === requestId ? { ...actual, alternable: false } : actual);
      }).catch(() => {});
    } catch (cause) {
      if (requestId !== solicitudCamara.current) return;
      setError(mensajeErrorCamara(cause instanceof DOMException ? cause.name : ""));
    } finally {
      if (requestId === solicitudCamara.current) {
        camaraOcupada.current = false;
        setCamaraCargando(false);
      }
    }
  }

  async function capturar() {
    const source = video.current;
    if (camaraOcupada.current) return;
    if (!source?.videoWidth || !source.videoHeight || source.readyState < 2) { setError("Espera a que la cámara termine de preparar la imagen."); return; }
    const actual = solicitudCamara.current;
    camaraOcupada.current = true;
    setCapturando(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = source.videoWidth;
      canvas.height = source.videoHeight;
      const contexto = canvas.getContext("2d");
      if (!contexto) throw new Error("Lienzo no disponible");
      contexto.drawImage(source, 0, 0);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", .9));
      if (actual !== solicitudCamara.current) return;
      if (!blob) throw new Error("Fotografía no disponible");
      await elegirArchivo(new File([blob], `dentaia-sonrisa-${Date.now()}.jpg`, { type: "image/jpeg" }), actual);
    } catch {
      if (actual === solicitudCamara.current) setError("No se pudo capturar la fotografía. Puedes intentarlo de nuevo o subir un archivo.");
    } finally {
      if (actual === solicitudCamara.current) {
        camaraOcupada.current = false;
        setCapturando(false);
      }
    }
  }

  function nuevaFoto() {
    detenerCamara(); limpiarFotografia(); setArchivo(null); setConsentimiento(false); setError("");
    explicacionAbortada.current?.abort(); explicacionSolicitada.current = null; setResultado(null); setOverlay(""); setOral(null); setExplicacion(null); setPremium(null); setPremiumError(false); setPremiumSolicitado(false); setFase("carga");
  }

  async function analizar() {
    if (!archivo || !consentimiento) return;
    detenerCamara();
    setError(""); setFase("analizando");
    try {
      const body = new FormData();
      body.set("file", archivo);
      const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      if (sessionError || !data.session?.access_token) throw new Error("Inicia sesión con una cuenta autorizada para usar esta demostración.");
      const requestedPremium = premiumDisponible && premiumSolicitado;
      const headers = {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(requestedPremium ? { "X-Dentaia-Premium-Processing-Consent": "premium-vision-processing-v1" } : {}),
      };
      let response = await fetch("/api/desarrollo/dentaia-smile", { method: "POST", headers, body, cache: "no-store" });
      let payload: unknown = await response.json().catch(() => null);
      // Premium preflight rejects before quota consumption and before image parsing.
      // Retry Smile alone if the plan or the optional capability changed after page load.
      if (requestedPremium && !response.ok && payload && typeof payload === "object" && "code" in payload
        && ["PREMIUM_REQUIRED", "FEATURE_NOT_ENABLED", "PROCESSING_CONSENT_REQUIRED", "AUTH_UNAVAILABLE", "CONSENT_UNAVAILABLE"].includes(String(payload.code))) {
        response = await fetch("/api/desarrollo/dentaia-smile", { method: "POST",
          headers: { Authorization: `Bearer ${data.session.access_token}` }, body, cache: "no-store" });
        payload = await response.json().catch(() => null);
      }
      if (!response.ok) throw new Error(payload && typeof payload === "object" && "detail" in payload ? String(payload.detail) : "El servicio de análisis no está disponible.");
      if (!isSmileAnalysisResponse(payload)) throw new Error("El servicio devolvió un resultado Smile inesperado.");
      const premiumValue = payload && typeof payload === "object" && "premium_vision" in payload ? payload.premium_vision : null;
      setPremium(isPremiumVisionResult(premiumValue) ? premiumValue : null);
      setPremiumError(Boolean(requestedPremium && !isPremiumVisionResult(premiumValue)));
      setResultado(payload.result); setOverlay(payload.overlay_url ?? ""); setOral(payload.oral_analysis ?? null); setFase("resultado"); void explicar(payload.result, payload.oral_analysis);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo analizar la fotografía."); }
  }

  async function explicar(result = resultado, oralResult: OralBasicAnalysis | null = oral) {
    if (!result || explicando) return;
    const key = JSON.stringify({ result, oralResult });
    if (explicacionSolicitada.current === key) return;
    explicacionSolicitada.current = key;
    explicacionAbortada.current?.abort();
    const controller = new AbortController();
    explicacionAbortada.current = controller;
    setExplicando(true); setError("");
    try {
      const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      if (sessionError || !data.session?.access_token) throw new Error("Inicia sesión con una cuenta autorizada para usar esta demostración.");
      const response = await fetch("/api/desarrollo/dentaia-smile/explain", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ ...result, ...(oralResult ? { oral_analysis: { status: oralResult.status, model: oralResult.model, detections: oralResult.detections.map(d => ({ class: d.class, confidence: d.confidence })) } } : {}) }), cache: "no-store", signal: controller.signal });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isSmileExplanation(payload)) throw new Error("No se pudo generar la explicación opcional.");
      setExplicacion(payload);
    } catch { if (!controller.signal.aborted) setExplicacion(fallbackExplanation(result)); }
    finally { if (!controller.signal.aborted) setExplicando(false); }
  }


  return <section className={styles.modulo}>
    {fase !== "preparacion" && <Stepper fase={fase} />}
    {error && <div className={styles.error} role="alert"><Icono nombre="alerta" size={20} /><p>{error}</p>{fase === "analizando" && <button type="button" onClick={() => void analizar()}>Reintentar</button>}</div>}

    {fase === "preparacion" && <div className={styles.preparacionInicio}>
      <section className={styles.banner}>
        <div className={styles.heroContenido}>
          <span className={styles.heroEtiqueta}><Icono nombre="diente" size={19} /> EXPERIENCIA DENTAIA · ANÁLISIS DE SONRISA</span>
          <h1>Tu mejor sonrisa comienza con una buena fotografía.</h1>
          <p>Prepara una imagen clara y natural para obtener una observación orientativa más consistente.</p>
          <div className={styles.heroIndicadores} aria-label="Recomendaciones esenciales">
            <span><Icono nombre="check" size={16} /> Luz uniforme</span>
            <span><Icono nombre="check" size={16} /> De frente</span>
            <span><Icono nombre="check" size={16} /> Sin filtros</span>
          </div>
        </div>
        <Mascota />
      </section>
      <div className={styles.preparacionGrid}>
        <article className={styles.tarjeta}>
          <div className={styles.tarjetaEncabezado}>
            <span className={styles.numeroTarjeta}>01</span>
            <div><span className={styles.tarjetaSupertitulo}>ANTES DE EMPEZAR</span><h2>Prepara tu sonrisa</h2></div>
          </div>
          <p className={styles.tarjetaIntro}>Cuatro recomendaciones sencillas para mejorar la calidad de la imagen.</p>
          <ul className={styles.consejos}>
            {[
              "Busca luz natural o blanca, uniforme y sin reflejos.",
              "Coloca la cámara de frente y a la altura de tu sonrisa.",
              "Sonríe de forma natural, mostrando los dientes con claridad.",
              "Evita filtros, retoques, sombras fuertes y fotografías borrosas.",
            ].map((consejo, index) => <li key={consejo}>
              <span className={styles.consejoIcono}><Icono nombre="check" size={19} /></span>
              <div><small>PASO {String(index + 1).padStart(2, "0")}</small><p>{consejo}</p></div>
            </li>)}
          </ul>
        </article>
        <article className={styles.tarjeta}>
          <div className={styles.tarjetaEncabezado}>
            <span className={styles.numeroTarjeta}>02</span>
            <div><span className={styles.tarjetaSupertitulo}>GUÍA VISUAL</span><h2>Así debe verse tu foto</h2></div>
          </div>
          <p className={styles.tarjetaIntro}>Compara el encuadre antes de continuar.</p>
          <div className={styles.ejemplos}>
            <div className={styles.ejemploCorrecto}>
              <span className={styles.ejemploBueno}><span className={styles.ejemploFigura}><Icono nombre="diente" size={48} /></span><span className={styles.ejemploLuz} aria-hidden="true">✦</span></span>
              <strong><Icono nombre="check" size={16} /> Correcto</strong>
              <small>Buena iluminación y cámara frontal</small>
            </div>
            <div className={styles.ejemploIncorrecto}>
              <span className={styles.ejemploMalo}><span className={styles.ejemploFigura}><Icono nombre="diente" size={48} /></span><span className={styles.ejemploSombra} aria-hidden="true" /></span>
              <strong>✕ Evitar</strong>
              <small>Sombras intensas o ángulo lateral</small>
            </div>
          </div>
          <p className={styles.ayudaEjemplos}>Los ejemplos son ilustraciones de encuadre, no resultados clínicos.</p>
        </article>
      </div>
      <section className={styles.queRevisamos} aria-labelledby="analisis-explicacion-titulo">
        <div className={styles.queRevisamosIntro}>
          <span className={styles.tarjetaSupertitulo}>¿QUÉ OBTENDRÁS?</span>
          <h2 id="analisis-explicacion-titulo">Una primera orientación sobre tu sonrisa</h2>
          <p>El sistema examina características visibles de la imagen y te indica cuándo conviene repetirla o solicitar una evaluación profesional.</p>
        </div>
        <div className={styles.aspectos}>
          <span><Icono nombre="diente" size={20} /> Tonalidades visibles</span>
          <span><Icono nombre="imagen" size={20} /> Calidad de la fotografía</span>
          <span><Icono nombre="escudo" size={20} /> Orientación responsable</span>
        </div>
      </section>
      <div className={styles.inicioAcciones}>
        <button type="button" className={styles.primarioGrande} onClick={() => setFase("carga")}>
          Comenzar análisis <Icono nombre="flecha" size={21} />
        </button>
        <p><Icono nombre="privacidad" size={17} /> Solo se enviará tu fotografía al servicio de análisis después de que la selecciones y autorices su procesamiento. El resultado no es un diagnóstico.</p>
      </div>
    </div>}

    {fase === "carga" && <div className={styles.vistaFlujo}>
      <div className={styles.encabezadoVista}><div><h1>Sube la fotografía de tu sonrisa</h1><p>Carga una imagen clara y sin filtros. No se analizará hasta que pulses el botón.</p></div><Mascota compacta /></div>
      {camara && <CamaraDental key={camara.id} video={video} espejo={camara.orientacion === "user"} capturando={capturando}
        guiaActiva={guiaActiva} activarGuia={setGuiaActiva} camaraCargando={camaraCargando}
        alternar={camara.alternable ? () => void abrirCamara(camara) : undefined}
        capturar={() => void capturar()} cerrar={detenerCamara} />}
      <div className={styles.cargaGrid}>
        <div className={styles.dropzone} onDragOver={event => event.preventDefault()} onDrop={soltar}>
          <Icono nombre="subir" size={56} /><h2>Arrastra y suelta tu fotografía aquí</h2><p>o selecciona un archivo desde tu equipo</p>
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" onChange={manejarArchivo} className={styles.oculto} />
          <button type="button" className={styles.secundario} onClick={() => entrada.current?.click()}>Seleccionar archivo</button><small>JPG, PNG o WebP · máximo 8 MB</small>
        </div>
        <div className={styles.cargaLateral}>
          {!camara && <button type="button" className={styles.camaraBoton} onClick={() => void abrirCamara()} disabled={camaraCargando}><Icono nombre="camara" size={30} />{camaraCargando ? "Abriendo cámara…" : vista ? "Tomar otra fotografía" : "Tomar fotografía con tu cámara"}</button>}
          <article className={styles.preview}><h2><Icono nombre="imagen" size={20} /> Vista previa</h2>{vista ? <><img src={vista} alt="Vista previa local de la sonrisa" /><button type="button" onClick={() => { setArchivo(null); limpiarFotografia(); setConsentimiento(false); }} aria-label="Eliminar fotografía"><Icono nombre="cerrar" size={19} /></button></> : <p>Aún no has seleccionado una fotografía.</p>}</article>
        </div>
      </div>
      <label className={styles.consentimiento}><input type="checkbox" checked={consentimiento} onChange={event => setConsentimiento(event.target.checked)} /><span><strong>Consentimiento de procesamiento</strong> Autorizo el envío temporal de esta fotografía al servicio de análisis. El resultado es temporal y todavía no se guarda en Mis resultados.</span></label>
      {premiumDisponible && <label className={styles.consentimiento}><input type="checkbox" checked={premiumSolicitado} onChange={event => setPremiumSolicitado(event.target.checked)} /><span><strong>Evaluación fotográfica Premium</strong> Solicito además el procesamiento temporal con RF-DETR Small. Los hallazgos son preliminares, no son diagnósticos y no se guardan automáticamente.</span></label>}
      <div className={styles.acciones}><button type="button" className={styles.secundario} onClick={() => { detenerCamara(); setFase("preparacion"); }}>← Volver</button><button type="button" className={styles.primario} disabled={!archivo || !consentimiento} onClick={() => void analizar()}>Analizar fotografía <Icono nombre="flecha" size={20} /></button></div>
    </div>}

    {fase === "analizando" && <div className={styles.vistaFlujo} aria-busy={!error}>
      <div className={styles.encabezadoVista}><div><h1>Analizando tu sonrisa…</h1><p>La segmentación y las mediciones se realizan en una única solicitud. Esto puede tardar unos segundos.</p></div><Mascota compacta /></div>
      <div className={styles.procesoGrid}><figure className={styles.fotoProceso}>{vista && <img src={vista} alt="Fotografía enviada para análisis" />}<figcaption>Segmentación y medición en curso</figcaption></figure><div className={styles.estadosProceso}>
        <div data-estado={error ? "error" : "activo"}><span>{error ? "!" : <i />}</span><div><strong>Identificando tus dientes</strong><small>Estamos revisando los dientes visibles en tu fotografía.</small></div></div>
        <div data-estado="pendiente"><span>2</span><div><strong>Revisando el color de tus dientes</strong><small>Observamos las diferencias de tonalidad presentes en la imagen.</small></div></div>
        <div data-estado="pendiente"><span>3</span><div><strong>Preparando tus resultados</strong><small>Estamos organizando lo observado para explicártelo de forma sencilla.</small></div></div>
      </div></div>
      {!error && <div className={styles.progresoIndeterminado} role="progressbar" aria-label="Análisis en curso"><span /></div>}
      <aside className={styles.nota}><Icono nombre="privacidad" size={22} /><p>El resultado es orientativo. No constituye diagnóstico ni confirma el estado de salud dental.</p></aside>
    </div>}

    {fase === "resultado" && resultado && <div className={styles.vistaFlujo} aria-live="polite">
      <ResultadosVisuales result={resultado} oral={oral} premium={premium} premiumError={premiumError} image={vista} smileOverlay={overlay} explanation={explicacion} explaining={explicando} onNewPhoto={nuevaFoto} />
      <p className={styles.soloLectores}>Esta fotografía ofrece una observación educativa que no constituye diagnóstico y no confirma una condición dental.</p>
    </div>}

    {fase === "detalle" && resultado && <div className={styles.vistaFlujo}>
      <div className={styles.tituloResultado}><h1>Detalle por región dental</h1><p>Consulta las mediciones experimentales y su calidad de imagen.</p></div>
      <div className={styles.detalleGrid}><div className={styles.tablaWrap}><table><caption className={styles.soloLectores}>Mediciones por región dental</caption><thead><tr><th>Región</th><th>b* mediana</th><th>Δb* mitades</th><th>Estado V17</th><th>Zona parcial</th><th>Iluminación</th></tr></thead><tbody>{resultado.regions.map(region => <tr key={region.region_id} data-alerta={!region.evaluable || region.partial || region.illumination_warning}><th>Región {region.region_id}</th><td>{region.b_median?.toFixed(1) ?? "—"}</td><td>{region.delta_b_halves?.toFixed(1) ?? "—"}</td><td><span>{region.level}</span></td><td>{region.partial ? `${(region.zone_fraction * 100).toFixed(1)}%` : "No"}</td><td>{region.evaluable ? (region.illumination_warning ? "Revisar" : "Sin advertencia") : "—"}</td></tr>)}</tbody></table></div>
        <aside className={styles.explicacion}><div><Mascota compacta /><h2>Explicación opcional</h2></div>{explicacion ? <><p>{explicacion.summary}</p><ul>{explicacion.observations.map(item => <li key={item}>{item}</li>)}</ul><p>{explicacion.recommendation}</p><small>{explicacion.disclaimer}</small></> : <><p>OpenAI recibirá únicamente este JSON técnico, nunca la fotografía ni datos personales.</p><button type="button" className={styles.secundario} onClick={() => void explicar()} disabled={explicando}>{explicando ? "Generando…" : "Generar explicación"}</button></>}</aside></div>
      <aside className={styles.nota}><Icono nombre="privacidad" size={22} /><p>Este análisis es orientativo y no sustituye la evaluación de un odontólogo.</p></aside>
      <div className={styles.acciones}><button type="button" className={styles.secundario} onClick={() => setFase("resultado")}>← Volver al resumen</button><Link className={styles.primario} href="/panel/odontologos"><Icono nombre="calendario" size={20} /> Buscar odontólogo</Link></div>
    </div>}
  </section>;
}
