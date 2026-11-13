"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import styles from "./vision-poc.module.css";

const PUBLIC_SAMPLE_NAMES = new Set([
  "anonymous_003-007-1004-00_1731042060585_Mandibular_View.jpg",
  "anonymous_003-007-1004-00_1731042060585_Maxillary_Occlusal_View.jpg",
]);

type Detection = {
  class_id: number;
  class_name: "d" | "D";
  class_description: string;
  confidence: number;
  box: { x_min: number; y_min: number; x_max: number; y_max: number };
};

type Prediction = {
  model: string;
  width: number;
  height: number;
  inference_ms: number;
  detections: Detection[];
};

type Explanation = {
  source: "ai" | "default";
  explanation: string;
};

const CLASS_DISPLAY = {
  d: { class_id: 0, description: "Posible caries en diente temporal" },
  D: { class_id: 1, description: "Posible caries en diente permanente" },
} as const;

const CLIENT_DEFAULT_EXPLANATION =
  "En este modelo, «d» indica una posible caries en un diente temporal y «D» en un diente permanente. La confianza no indica gravedad ni certeza diagnóstica, y no es una probabilidad clínica validada.";

async function authenticatedHeaders(headers: HeadersInit = {}): Promise<Headers> {
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
  return Array.isArray(candidate.detections)
    && typeof candidate.width === "number"
    && typeof candidate.height === "number"
    && typeof candidate.inference_ms === "number"
    && candidate.detections.every((detection) => {
      if (!detection || typeof detection !== "object") return false;
      const item = detection as Detection;
      if (item.class_name !== "d" && item.class_name !== "D") return false;
      const display = CLASS_DISPLAY[item.class_name];
      return item.class_id === display.class_id
        && item.class_description === display.description
        && typeof item.confidence === "number";
    });
}

function isExplanation(value: unknown): value is Explanation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Explanation>;
  return (candidate.source === "ai" || candidate.source === "default")
    && typeof candidate.explanation === "string"
    && candidate.explanation.length > 0
    && candidate.explanation.length <= 350;
}

export default function VisionPocPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const explanationCache = useRef(new Map<string, Explanation>());
  const inFlightExplanationKeys = useRef(new Set<string>());

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectedIsAllowed = useMemo(() => file !== null && PUBLIC_SAMPLE_NAMES.has(file.name), [file]);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setPrediction(null);
    setError(null);
    setExplanation(null);
  }

  async function analyze() {
    if (!file || !selectedIsAllowed) return;

    setLoading(true);
    setError(null);
    setPrediction(null);
    setExplanation(null);
    try {
      const response = await fetch("/api/desarrollo/vision-poc", {
        method: "POST",
        headers: await authenticatedHeaders({ "Content-Type": file.type || "application/octet-stream" }),
        body: file,
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = body && typeof body === "object" && "detail" in body ? String(body.detail) : "No se pudo analizar la imagen.";
        throw new Error(detail);
      }
      if (!isPrediction(body)) {
        throw new Error("El servicio local devolvió una respuesta inesperada.");
      }
      setPrediction(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo analizar la imagen.");
    } finally {
      setLoading(false);
    }
  }

  async function explainResult() {
    if (!prediction || explaining) return;
    setError(null);
    const payload = {
      detections: prediction.detections.map(({ class_name, confidence }) => ({ class_name, confidence })),
    };
    const cacheKey = JSON.stringify(payload);
    const cached = explanationCache.current.get(cacheKey);
    if (cached) {
      setExplanation(cached);
      return;
    }
    if (inFlightExplanationKeys.current.has(cacheKey)) return;

    inFlightExplanationKeys.current.add(cacheKey);
    setExplaining(true);
    try {
      const response = await fetch("/api/desarrollo/vision-poc/explain", {
        method: "POST",
        headers: await authenticatedHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok && (response.status === 401 || response.status === 403 || response.status === 503)) {
        const detail = body && typeof body === "object" && "detail" in body
          ? String(body.detail) : "No se pudo verificar el acceso a la demostración.";
        setError(detail);
        return;
      }
      if (!response.ok || !isExplanation(body)) {
        throw new Error("No se pudo obtener la explicación.");
      }
      explanationCache.current.set(cacheKey, body);
      setExplanation(body);
    } catch {
      const fallback: Explanation = { source: "default", explanation: CLIENT_DEFAULT_EXPLANATION };
      explanationCache.current.set(cacheKey, fallback);
      setExplanation(fallback);
    } finally {
      inFlightExplanationKeys.current.delete(cacheKey);
      setExplaining(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <p className={styles.eyebrow}>PRUEBA LOCAL · SOLO MUESTRAS PÚBLICAS</p>
        <h1>Visualizador ONNX de DentaIA</h1>
        <p className={styles.intro}>
          Esta página analiza únicamente las dos fotografías públicas autorizadas.
        </p>
        <aside className={styles.educationalNotice} aria-label="Alcance educativo">
          Las marcas señalan una posible caries, pero no confirman un diagnóstico. La confianza del modelo no indica gravedad ni certeza diagnóstica, y no es una probabilidad clínica validada. Que no haya marcas no garantiza que no existan problemas; esta herramienta educativa no sustituye la evaluación de un odontólogo.
        </aside>

        <section className={styles.controls} aria-label="Controles de análisis">
          <label className={styles.fileLabel}>
            Seleccionar muestra pública
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} />
          </label>
          <p className={styles.allowed}>
            Permitidas: <code>Mandibular_View.jpg</code> y <code>Maxillary_Occlusal_View.jpg</code> verificadas.
          </p>
          {file && !selectedIsAllowed && (
            <p className={styles.error} role="alert">Selecciona una de las dos fotografías públicas autorizadas, sin cambiar su nombre.</p>
          )}
          <button className={styles.analyze} type="button" disabled={!selectedIsAllowed || loading} onClick={analyze}>
            {loading ? "Analizando localmente…" : "Analizar"}
          </button>
        </section>

        {error && <p className={styles.error} role="alert">{error}</p>}

        {previewUrl && file && (
          <section className={styles.viewer} aria-label="Vista previa y detecciones técnicas">
            <div className={styles.imageFrame}>
              <img src={previewUrl} alt={`Vista previa local de ${file.name}`} />
              {prediction && (
                <svg className={styles.overlay} viewBox={`0 0 ${prediction.width} ${prediction.height}`} aria-label="Cajas devueltas por el modelo">
                  {prediction.detections.map((detection, index) => {
                    const x = detection.box.x_min * prediction.width;
                    const y = detection.box.y_min * prediction.height;
                    const width = (detection.box.x_max - detection.box.x_min) * prediction.width;
                    const height = (detection.box.y_max - detection.box.y_min) * prediction.height;
                    return (
                      <g key={`${detection.class_name}-${index}`}>
                        <rect className={styles.box} x={x} y={y} width={width} height={height} />
                        <text className={styles.boxLabel} x={x + 4} y={Math.max(16, y - 5)}>
                          {detection.class_description}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>

            {prediction && (
              <div className={styles.result} aria-live="polite">
                <h2>Resultado técnico</h2>
                <p>Modelo: {prediction.model} · inferencia: {prediction.inference_ms.toFixed(3)} ms</p>
                {prediction.detections.length === 0 ? (
                  <p className={styles.empty}>El modelo no señaló zonas en esta imagen.</p>
                ) : (
                  <ul>
                    {prediction.detections.map((detection, index) => (
                      <li key={`${detection.class_name}-${index}`}>
                        <strong>{detection.class_description}</strong> · Confianza del modelo: {Math.round(detection.confidence * 100)}% · caja normalizada ({detection.box.x_min.toFixed(3)}, {detection.box.y_min.toFixed(3)})–({detection.box.x_max.toFixed(3)}, {detection.box.y_max.toFixed(3)})
                      </li>
                    ))}
                  </ul>
                )}
                <button className={styles.analyze} type="button" disabled={explaining || explanation !== null} onClick={explainResult}>
                  {explaining ? "Preparando explicación…" : explanation ? "Explicación disponible" : "Explicar resultado"}
                </button>
              </div>
            )}
            {explanation && (
              <section className={styles.explanation} aria-live="polite" aria-labelledby="explanation-heading">
                <div className={styles.explanationHeader}>
                  <h2 id="explanation-heading">Explicación sencilla</h2>
                  <span className={styles.explanationSource}>
                    {explanation.source === "ai" ? "Generada por IA" : "Texto predeterminado · no generado por IA"}
                  </span>
                </div>
                <p>{explanation.explanation}</p>
              </section>
            )}
          </section>
        )}

        <p className={styles.privacy}>
          El secreto de FastAPI nunca se envía al navegador. El proxy y el microservicio deben ejecutarse solo en <code>127.0.0.1</code>; este flujo no guarda fotografías.
        </p>
      </section>
    </main>
  );
}
