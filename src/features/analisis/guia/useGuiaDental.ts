import { useEffect, useState, type RefObject } from "react";
import { BUSCAR, type Senal } from "./geometria";
import type { FotogramaGuia, RespuestaGuia } from "./guia.worker";

type Estado =
  | { tipo: "cargando" | "error" }
  | { tipo: "activa"; senal: Senal };

const WORKER = "/mediapipe/1.2.3/runtime/guia.worker.js";
const INTERVALO_MS = 150;

export function useGuiaDental(video: RefObject<HTMLVideoElement | null>, intento: number) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    const fuente = video.current;
    if (!intento || !fuente) return;

    let worker: Worker;
    let activo = true;
    let intervalo: number | undefined;
    let limite: number | undefined;
    let ocupado = false;
    let revision = 0;
    let videoAnterior = -1;
    let ultimoFotograma = 0;
    let seguimientoVigente = false;

    function detener() {
      activo = false;
      window.clearInterval(intervalo);
      window.clearTimeout(limite);
      worker?.terminate();
    }

    function error() {
      if (!activo) return;
      detener();
      setEstado({ tipo: "error" });
    }

    function reiniciarSeguimiento() {
      revision++;
      videoAnterior = -1;
      seguimientoVigente = false;
      if (activo && intervalo !== undefined) setEstado({ tipo: "activa", senal: BUSCAR });
    }

    async function muestrear(origen: HTMLVideoElement) {
      if (!activo || document.hidden || ocupado) return;
      const ahora = performance.now();
      if (origen.readyState < 2 || origen.currentTime === videoAnterior) {
        if (seguimientoVigente && ahora - ultimoFotograma > 750) {
          reiniciarSeguimiento();
          videoAnterior = origen.currentTime;
        }
        return;
      }
      const { videoWidth, videoHeight } = origen;
      if (!videoWidth || !videoHeight) return;
      videoAnterior = origen.currentTime;
      ultimoFotograma = ahora;
      ocupado = true;
      const actual = revision;
      const escala = Math.min(1, 512 / Math.max(videoWidth, videoHeight));
      limite = window.setTimeout(error, 6000);

      let imagen: ImageBitmap | undefined;
      try {
        imagen = await createImageBitmap(origen, {
          resizeWidth: Math.max(1, Math.round(videoWidth * escala)),
          resizeHeight: Math.max(1, Math.round(videoHeight * escala)),
        });
        if (!activo) return;
        if (actual !== revision || videoWidth !== origen.videoWidth || videoHeight !== origen.videoHeight) {
          ocupado = false;
          window.clearTimeout(limite);
          return;
        }
        const mensaje: FotogramaGuia = { imagen, tiempo: ahora, revision: actual };
        worker.postMessage(mensaje, [imagen]);
        imagen = undefined;
      } catch {
        error();
      } finally {
        imagen?.close();
      }
    }

    setEstado({ tipo: "cargando" });
    try {
      if (!window.Worker || !window.OffscreenCanvas || !window.createImageBitmap || !window.WebAssembly) {
        throw new Error("Funciones de guía no disponibles");
      }
      worker = new Worker(WORKER, { type: "module", name: "dentaia-guia-dental" });
      worker.onerror = error;
      worker.onmessageerror = error;
      limite = window.setTimeout(error, 30000);
      worker.onmessage = ({ data }: MessageEvent<RespuestaGuia>) => {
        if (!activo) return;
        window.clearTimeout(limite);
        if (data.tipo === "error") {
          error();
        } else if (data.tipo === "lista") {
          setEstado({ tipo: "activa", senal: BUSCAR });
          intervalo = window.setInterval(() => void muestrear(fuente), INTERVALO_MS);
        } else if (data.tipo === "senal") {
          ocupado = false;
          if (data.revision !== revision) return;
          seguimientoVigente = true;
          setEstado({ tipo: "activa", senal: data.senal });
        }
      };
    } catch {
      error();
    }

    fuente.addEventListener("resize", reiniciarSeguimiento);
    document.addEventListener("visibilitychange", reiniciarSeguimiento);
    return () => {
      detener();
      fuente.removeEventListener("resize", reiniciarSeguimiento);
      document.removeEventListener("visibilitychange", reiniciarSeguimiento);
    };
  }, [intento, video]);

  return estado;
}
