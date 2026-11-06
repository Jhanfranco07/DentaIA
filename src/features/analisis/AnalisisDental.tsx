"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Icono } from "@/components/Identidad";
import { useFotografiaPreparacion } from "./FotografiaPreparacionContexto";
import { mensajeErrorCamara, mensajeValidacionFotografia, restriccionesCamara, validarFotografia } from "./fotografia";
import styles from "./analisis-dental.module.css";

type Fase = "seleccion" | "revision" | "preparacion";

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
  const [avisoMotor, setAvisoMotor] = useState(false);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [camaraCargando, setCamaraCargando] = useState(false);
  const [flujoOrigen, setFlujoOrigen] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const botonCamara = useRef<HTMLButtonElement>(null);
  const botonSubir = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const solicitudCamara = useRef(0);

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
    setAvisoMotor(false);
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
    setAvisoMotor(false);
  }

  return <section className={styles.pagina}>
    <header className={styles.hero}>
      <div className={styles.heroCopia}>
        <span className={styles.eyebrow}><Icono nombre="destello" size={15} /> ANÁLISIS DENTAL</span>
        <h1>Análisis dental <span>con IA</span></h1>
        <p>Prepara una fotografía desde tu dispositivo y revisa cómo será el recorrido. En esta versión la imagen permanece en tu navegador: todavía no hay un motor de análisis conectado.</p>
        <span className={styles.estadoMotor}><span aria-hidden="true" /> Motor de IA pendiente de integración</span>
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
      <aside className={styles.privacidad}><Icono nombre="privacidad" size={19} /><div><strong>Tu imagen se mantiene en este dispositivo</strong><p>El flujo no la almacena ni la envía. El consentimiento para guardar fotos en “Mis fotografías” es independiente, igual que el futuro consentimiento para procesarlas con IA.</p></div></aside>
      <div className={styles.enlacesSecundarios}><Link href="/fotografias">Abrir Mis fotografías guardadas <Icono nombre="flecha" size={16} /></Link><Link href="/directorio">Encontrar odontólogos <Icono nombre="flecha" size={16} /></Link></div>
    </div>}

    {fase === "revision" && archivo && <div className={styles.contenido}>
      <div className={styles.seccionIntro}><span className={styles.numeroPaso}>02 / REVISIÓN</span><h2>Revisa la fotografía</h2><p>Comprueba que la imagen se vea clara. Aún no se ha guardado ni procesado.</p></div>
      <div className={styles.revision}>
        <figure className={styles.vistaImagen}><img src={vista} alt="Vista previa local de la fotografía seleccionada" /><figcaption>Vista previa temporal · solo en este dispositivo</figcaption></figure>
        <div className={styles.detalleImagen}><span className={styles.tagImagen}><Icono nombre="imagen" size={15} /> {flujoOrigen ? "FOTO PRIVADA GUARDADA" : "FOTO LOCAL"}</span><h3>{archivo.name}</h3><dl><div><dt>Formato</dt><dd>{archivo.type.replace("image/", "").toUpperCase()}</dd></div><div><dt>Tamaño</dt><dd>{(archivo.size / 1024 / 1024).toFixed(2)} MB</dd></div></dl><h4>Consejos para revisar</h4><ul><li>Busca una imagen enfocada y con iluminación suficiente.</li><li>Evita sombras que cubran la zona que quieres mostrar.</li><li>No uses fotografías de otras personas sin autorización.</li></ul>
          <div className={styles.acciones}><button type="button" className={styles.botonSecundario} onClick={cambiarFotografia}>Cambiar fotografía</button><button type="button" className={styles.botonPrimario} onClick={() => { setFase("preparacion"); setAvisoMotor(false); }}><Icono nombre="check" size={17} /> Confirmar fotografía</button></div>
        </div>
      </div>
      <aside className={styles.privacidad}><Icono nombre="privacidad" size={19} /><div><strong>Sin consentimiento de procesamiento</strong><p>Confirmar aquí solo conserva temporalmente la selección en la página. No autoriza almacenamiento ni análisis automatizado.</p></div></aside>
    </div>}

    {fase === "preparacion" && archivo && <div className={styles.contenido}>
      <div className={styles.seccionIntro}><span className={styles.numeroPaso}>03 / PREPARACIÓN</span><h2>Tu fotografía está lista</h2><p>Este panel prepara la integración futura. El motor todavía no puede analizar imágenes.</p></div>
      <div className={styles.preparacion}>
        <figure className={styles.vistaPreparacion}><img src={vista} alt="Fotografía preparada localmente, no analizada" /><figcaption>{archivo.name}</figcaption></figure>
        <div className={styles.pasosFuturos}><span className={styles.tagPendiente}>Motor no disponible</span><h3>Etapas previstas</h3><ol><li><span>01</span> Validar autorización y consentimiento de procesamiento <b>Pendiente</b></li><li><span>02</span> Enviar imagen al servicio de análisis <b>Pendiente</b></li><li><span>03</span> Mostrar resultado con límites y recomendaciones <b>Pendiente</b></li></ol><p>Estas etapas describen el diseño futuro; ninguna inferencia ni envío está ocurriendo.</p></div>
      </div>
      {avisoMotor && <div className={styles.avisoMotor} role="status"><Icono nombre="alerta" size={19} /><p>El módulo de análisis está preparado, pero el motor de inteligencia artificial todavía no está disponible en esta versión.</p></div>}
      <div className={styles.accionesFinales}><button type="button" className={styles.botonSecundario} onClick={() => setFase("revision")}>Volver a la fotografía</button><button type="button" className={styles.botonSecundario} onClick={cambiarFotografia}>Elegir otra</button><button type="button" className={styles.botonPrimario} onClick={() => setAvisoMotor(true)}><Icono nombre="destello" size={17} /> Analizar con IA</button></div>
      <div className={styles.enlacesSecundarios}><Link href="/resultados">Ir a Mis resultados <Icono nombre="flecha" size={16} /></Link><Link href="/directorio">Encontrar odontólogos <Icono nombre="flecha" size={16} /></Link></div>
    </div>}
  </section>;
}
