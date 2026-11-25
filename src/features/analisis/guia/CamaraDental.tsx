import { useEffect, useRef, useState, type RefObject } from "react";
import styles from "../analisis-dental.module.css";
import { OBJETIVO, orientarBoca, type Indicacion } from "./geometria";
import { useGuiaDental } from "./useGuiaDental";

const MENSAJES: Record<Indicacion, string> = {
  buscar: "Buscando tu rostro. Si estás tomando un primer plano, puedes capturar la foto manualmente.",
  centrar: "Mueve la boca hacia el centro del marco.",
  enderezar: "Mira de frente y mantén la cabeza recta.",
  acercar: "Acércate un poco a la cámara.",
  alejar: "Aléjate un poco de la cámara.",
  abrir: "Abre un poco la boca.",
  lista: "Mantén esta posición y pulsa Capturar fotografía.",
};

type Props = {
  video: RefObject<HTMLVideoElement | null>;
  espejo: boolean;
  capturando: boolean;
  capturar: () => void;
  cerrar: () => void;
};

export default function CamaraDental({ video, espejo, capturando, capturar, cerrar }: Props) {
  const panel = useRef<HTMLElement>(null);
  const [intento, setIntento] = useState(0);
  const [proporcion, setProporcion] = useState(4 / 3);
  const [videoListo, setVideoListo] = useState(false);
  const estado = useGuiaDental(video, intento);
  const senal = intento && estado.tipo === "activa" ? estado.senal : null;
  const boca = senal?.boca ? orientarBoca(senal.boca, espejo) : null;

  useEffect(() => {
    panel.current?.focus();
    const fuente = video.current;
    if (!fuente) return;
    function actualizar(origen: HTMLVideoElement) {
      if (origen.videoWidth && origen.videoHeight) {
        setProporcion(origen.videoWidth / origen.videoHeight);
      }
      setVideoListo(origen.readyState >= 2);
    }
    const actualizarVideo = () => actualizar(fuente);
    fuente.addEventListener("loadedmetadata", actualizarVideo);
    fuente.addEventListener("loadeddata", actualizarVideo);
    fuente.addEventListener("resize", actualizarVideo);
    actualizarVideo();
    return () => {
      fuente.removeEventListener("loadedmetadata", actualizarVideo);
      fuente.removeEventListener("loadeddata", actualizarVideo);
      fuente.removeEventListener("resize", actualizarVideo);
    };
  }, [video]);

  return <section ref={panel} tabIndex={-1} className={styles.camaraPanel} aria-label="Cámara para fotografía dental">
    <div className={styles.camaraImagen} style={{ aspectRatio: proporcion, maxWidth: 420 * proporcion }}>
      <video ref={video} playsInline muted data-espejo={espejo} aria-label="Vista previa de la cámara" />
      {senal && <div className={styles.camaraMarco} aria-hidden="true"
        style={{ left: `${OBJETIVO.x * 100}%`, top: `${OBJETIVO.y * 100}%` }} />}
      {boca && <div className={styles.camaraBoca} aria-hidden="true" data-alineada={senal?.indicacion === "lista"}
        style={{
          left: `${boca.x * 100}%`,
          top: `${boca.y * 100}%`,
          width: `${boca.ancho * 100}%`,
          height: `${boca.alto * 100}%`,
          transform: `translate(-50%, -50%) rotate(${boca.angulo}rad)`,
        }} />}
    </div>
    <div className={styles.camaraControles}>
      <div className={styles.camaraAyuda}>
        <label><input type="checkbox" checked={intento > 0} onChange={event => setIntento(event.target.checked ? 1 : 0)} /> Usar guía de encuadre</label>
        <p>La guía procesa la vista de la cámara en este dispositivo.</p>
        <p role="status">{intento > 0 && (senal ? MENSAJES[senal.indicacion] : estado.tipo === "error"
          ? "La guía no está disponible. Puedes reintentar o tomar la foto manualmente."
          : "Cargando la guía de encuadre…")}</p>
        {intento > 0 && estado.tipo === "error" && <button type="button" className={styles.secundario}
          onClick={() => setIntento(actual => actual + 1)}>Reintentar guía</button>}
      </div>
      <button type="button" className={styles.primario} onClick={capturar} disabled={!videoListo || capturando}>Capturar fotografía</button>
      <button type="button" className={styles.secundario} onClick={cerrar}>Cerrar cámara</button>
    </div>
  </section>;
}
