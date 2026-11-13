import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { authorizeVisionDemoRequest } from "@/features/autorizacion/vision-demo-server";
import { consumeVisionExplanationLimit } from "@/features/autorizacion/vision-demo";

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_DETECTIONS = 100;
const MAX_OUTPUT_CHARS = 350;
const MAX_PROVIDER_RESPONSE_BYTES = 32 * 1024;
const PROVIDER_TIMEOUT_MS = 12_000;
const DEFAULT_EXPLANATION =
  "El modelo usa «d» para señalar una posible caries en diente temporal y «D» en diente permanente. La confianza no indica gravedad ni certeza diagnóstica, y no es una probabilidad clínica validada.";

const INSTRUCTIONS = [
  "Responde en español sencillo, profesional, cercano y sin alarmismo, para una persona sin conocimientos odontológicos.",
  "Explica el resultado en 2 o 3 frases y menos de 350 caracteres, con palabras comunes y sin repeticiones.",
  "Interpreta las clases exactamente así: d minúscula = posible caries en diente temporal (de leche); D mayúscula = posible caries en diente permanente. No intercambies las letras.",
  "Habla de una posible caries, nunca de una caries confirmada ni de un diagnóstico.",
  "Usa solo las etiquetas y valores recibidos. No describas la imagen ni inventes características, hallazgos o cantidades.",
  "Nunca interpretes el porcentaje de confianza como gravedad, certeza diagnóstica o probabilidad de enfermedad.",
  "Si la lista está vacía, di únicamente que no hay detecciones en esta imagen; no digas que los dientes están sanos.",
  "La página ya muestra una advertencia educativa permanente sobre el alcance de la herramienta; no la repitas.",
  "No diagnostiques ni recomiendes tratamientos. Devuelve solo texto claro, sin jerga, explicaciones largas ni repeticiones.",
].join(" ");

type DetectionInput = { class_name: "d" | "D"; confidence: number };

function json(status: number, body: Record<string, unknown>, retryAfter?: number) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (retryAfter !== undefined) headers.set("Retry-After", String(retryAfter));
  return NextResponse.json(body, { status, headers });
}

function defaultResult() {
  return json(200, { source: "default", explanation: DEFAULT_EXPLANATION });
}

function validateDetections(value: unknown): DetectionInput[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== 1 || !Array.isArray(body.detections)) return null;
  if (body.detections.length > MAX_DETECTIONS) return null;

  const detections: DetectionInput[] = [];
  for (const item of body.detections) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const detection = item as Record<string, unknown>;
    if (Object.keys(detection).length !== 2
        || (detection.class_name !== "d" && detection.class_name !== "D")
        || typeof detection.confidence !== "number"
        || !Number.isFinite(detection.confidence)
        || detection.confidence < 0
        || detection.confidence > 1) {
      return null;
    }
    detections.push({ class_name: detection.class_name, confidence: detection.confidence });
  }
  return detections;
}

async function readJsonLimited(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new Error("Provider response too large");
  }
  if (!response.body) throw new Error("Provider response body missing");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PROVIDER_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Provider response too large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function extractOutputText(value: unknown): string | null {
  if (!value || typeof value !== "object" || !Array.isArray((value as { output?: unknown }).output)) {
    return null;
  }
  const messages = (value as { output: unknown[] }).output;
  const textParts: string[] = [];
  for (const item of messages) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const outputPart = part as { type?: unknown; text?: unknown };
      if (outputPart.type === "output_text" && typeof outputPart.text === "string") {
        textParts.push(outputPart.text);
      }
    }
  }
  const text = textParts.join("\n").trim();
  return text && text.length <= MAX_OUTPUT_CHARS ? text : null;
}

export async function POST(request: NextRequest) {
  const access = await authorizeVisionDemoRequest(request.headers);
  if (!access.allowed) {
    return json(access.status, {
      detail: access.code === "AUTH_REQUIRED"
        ? "Inicia sesión para usar esta demostración."
        : access.code === "ALLOWLIST_UNCONFIGURED"
          ? "El acceso a la demostración no está configurado."
          : access.code === "AUTH_UNAVAILABLE"
            ? "No se pudo verificar la sesión. Inténtalo más tarde."
            : "Tu cuenta no está autorizada para esta demostración.",
    });
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return json(415, { detail: "La solicitud debe usar application/json." });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_REQUEST_BYTES) {
    return json(413, { detail: "La solicitud supera el límite permitido." });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json(400, { detail: "No se pudo leer la solicitud." });
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
    return json(413, { detail: "La solicitud supera el límite permitido." });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return json(400, { detail: "La solicitud debe ser JSON válido." });
  }
  const detections = validateDetections(parsed);
  if (!detections) {
    return json(400, { detail: "Envía como máximo 100 detecciones con etiqueta d/D y confidence entre 0 y 1." });
  }

  const rate = await consumeVisionExplanationLimit(access.userId,
    process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!rate.allowed) {
    if (rate.status === 429) return json(429, { detail: "Alcanzaste el límite de explicaciones. Inténtalo más tarde." }, rate.retryAfter);
    return defaultResult();
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !apiKey.trim() || !model || !model.trim()) return defaultResult();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.trim(),
        instructions: INSTRUCTIONS,
        input: JSON.stringify({ detections }),
        tools: [],
        store: false,
        max_output_tokens: 200,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    if (!response.ok) return defaultResult();

    const text = extractOutputText(await readJsonLimited(response));
    return text
      ? json(200, { source: "ai", explanation: text })
      : defaultResult();
  } catch {
    return defaultResult();
  }
}
