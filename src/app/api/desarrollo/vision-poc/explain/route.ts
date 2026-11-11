import "server-only";

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_DETECTIONS = 100;
const MAX_OUTPUT_CHARS = 1_200;
const MAX_PROVIDER_RESPONSE_BYTES = 32 * 1024;
const PROVIDER_TIMEOUT_MS = 12_000;
const RATE_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT = 5;

// Best-effort process-local limit: 5 calls per address per 10 minutes. It resets on restart,
// can differ across server instances, and depends on trusted proxy headers; not public API protection.
const DEFAULT_EXPLANATION =
  "El detector marca regiones que superan su umbral y asigna a cada salida una etiqueta técnica y un score entre 0 y 1. Las etiquetas d y D son identificadores técnicos cuyo significado no está confirmado. El score describe la confianza interna del modelo para esa detección; no es una probabilidad clínica ni confirma o descarta una enfermedad. Una lista vacía solo indica que ninguna salida superó el umbral configurado.";

const INSTRUCTIONS = [
  "Escribe en español una explicación educativa muy breve de las salidas técnicas de un detector visual.",
  "Las etiquetas d y D son identificadores opacos; no les atribuyas enfermedades ni condiciones.",
  "Un confidence entre 0 y 1 es un score del modelo, no una probabilidad clínica ni una medida calibrada de salud.",
  "No diagnostiques, no recomiendes tratamientos ni des recomendaciones clínicas individualizadas.",
  "Si no hay detecciones, explica solo que ninguna salida superó el umbral; no infieras ausencia de enfermedad.",
  "No inventes hechos. Limítate a explicar qué son etiquetas, detecciones y scores en términos técnicos.",
  "Devuelve solo texto plano, máximo 3 frases y 600 caracteres.",
].join(" ");

const attemptsByAddress = new Map<string, number[]>();

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

function consumeRateLimit(request: NextRequest): { allowed: boolean; retryAfter: number } {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const address = (forwarded || request.headers.get("x-real-ip") || "unknown").slice(0, 128);
  const key = createHash("sha256").update(address).digest("hex");
  const now = Date.now();
  const active = (attemptsByAddress.get(key) ?? []).filter((time) => now - time < RATE_WINDOW_MS);

  if (active.length >= RATE_LIMIT) {
    attemptsByAddress.set(key, active);
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - active[0])) / 1_000)),
    };
  }

  if (attemptsByAddress.size >= 4_096 && !attemptsByAddress.has(key)) {
    for (const [candidate, times] of attemptsByAddress) {
      if (!times.some((time) => now - time < RATE_WINDOW_MS)) attemptsByAddress.delete(candidate);
    }
    if (attemptsByAddress.size >= 4_096) {
      return { allowed: false, retryAfter: Math.ceil(RATE_WINDOW_MS / 1_000) };
    }
  }

  attemptsByAddress.set(key, [...active, now]);
  return { allowed: true, retryAfter: 0 };
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

  const rate = consumeRateLimit(request);
  if (!rate.allowed) {
    return json(200, { source: "default", explanation: DEFAULT_EXPLANATION }, rate.retryAfter);
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
