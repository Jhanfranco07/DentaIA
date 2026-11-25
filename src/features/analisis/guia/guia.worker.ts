import { estabilizarEncuadre, evaluarEncuadre, type Senal } from "./geometria.js";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

export type FotogramaGuia = { imagen: ImageBitmap; tiempo: number; revision: number };
export type RespuestaGuia =
  | { tipo: "lista" | "error" }
  | { tipo: "senal"; senal: Senal; revision: number };

const urlLocal = (nombre: string) => new URL(nombre, self.location.href).href;
const rutaSdk = urlLocal("./vision_bundle.mjs");
const rutaCargadorWasm = urlLocal("./vision_wasm_module_internal.js");
const rutaWasm = urlLocal("./vision_wasm_module_internal.wasm");
const rutaModelo = urlLocal("../face_landmarker.task");
const lecturasPermitidas = new Set([rutaCargadorWasm, rutaWasm, rutaModelo]);
const fetchOriginal = self.fetch.bind(self);

// El SDK puede intentar enviar métricas. Solo se permiten las tres URL exactas.
self.fetch = async (input, init) => {
  const solicitud = new Request(input, init);
  if (solicitud.method !== "GET" || !lecturasPermitidas.has(solicitud.url)) {
    throw new TypeError("Solicitud no permitida en la guía local");
  }
  return fetchOriginal(solicitud.url, {
    mode: "same-origin",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal: solicitud.signal,
  });
};

let detector: FaceLandmarker | undefined;
let revision = -1;
let estabilizar = estabilizarEncuadre();
const responder = (dato: RespuestaGuia) => self.postMessage(dato);

self.onmessage = (evento: MessageEvent<FotogramaGuia>) => {
  const { imagen, tiempo, revision: actual } = evento.data;
  try {
    if (!detector) return;
    if (actual !== revision) {
      revision = actual;
      estabilizar = estabilizarEncuadre();
    }
    const resultado = detector.detectForVideo(imagen, tiempo);
    const senal = estabilizar(evaluarEncuadre(resultado.faceLandmarks[0], imagen.width, imagen.height));
    responder({ tipo: "senal", senal, revision });
  } catch {
    responder({ tipo: "error" });
  } finally {
    imagen.close();
  }
};

async function iniciar() {
  try {
    const { FaceLandmarker }: typeof import("@mediapipe/tasks-vision") = await import(rutaSdk);
    detector = await FaceLandmarker.createFromOptions({
      wasmLoaderPath: rutaCargadorWasm,
      wasmBinaryPath: rutaWasm,
    }, {
      baseOptions: { modelAssetPath: rutaModelo, delegate: "CPU" },
      canvas: new OffscreenCanvas(1, 1),
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
    responder({ tipo: "lista" });
  } catch {
    responder({ tipo: "error" });
  }
}

void iniciar();
