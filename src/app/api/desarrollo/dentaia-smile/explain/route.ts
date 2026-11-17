import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { authorizeVisionDemoRequest } from "@/features/autorizacion/vision-demo-server";
import { consumeVisionExplanationLimit } from "@/features/autorizacion/vision-demo";

const MAX_BYTES = 16 * 1024, MAX_OUTPUT = 350;
const LEVELS = ["Leve", "Moderado", "Intenso"] as const;
type Facts = { evaluable: number; lighting: "adequate" | "review" | "not_evaluable"; levels: Record<string, number> };
const response = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const fallback = (f: Facts) => {
  if (!f.evaluable) return "No pudimos evaluar con suficiente claridad la tonalidad en esta fotografía. Prueba con luz natural o neutra, de frente y sin filtros.";
  const total = LEVELS.reduce((n, level) => n + f.levels[level], 0);
  if (!total) return `Revisamos ${f.evaluable} dientes detectados y no observamos amarillo destacado con estos parámetros visuales.`;
  const details = LEVELS.filter(level => f.levels[level]).map(level => `${f.levels[level]} ${level.toLowerCase()}`).join(", ");
  return `Observamos amarillo destacado en ${total} dientes detectados (${details}). Es una observación visual de esta fotografía, no un diagnóstico.`;
};
const template = (summary: string) => ({ summary, observations: [], recommendation: "Si el cambio también se nota en persona o te preocupa, consúltalo con un odontólogo.", disclaimer: "Observación educativa basada en una fotografía; no es un diagnóstico.", source: "template" });

function facts(value: unknown): Facts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (result.model !== "teeth-4coz7/1" || !Array.isArray(result.regions) || !Number.isInteger(result.evaluable_regions)
    || !["adequate", "review", "not_evaluable"].includes(String(result.lighting_quality))) return null;
  const levels: Record<string, number> = { Leve: 0, Moderado: 0, Intenso: 0 }; let evaluable = 0;
  for (const region of result.regions) {
    if (!region || typeof region !== "object" || Array.isArray(region)) return null;
    const item = region as Record<string, unknown>;
    if (typeof item.evaluable !== "boolean" || typeof item.partial !== "boolean" || typeof item.illumination_warning !== "boolean"
      || !["No evaluable", "Sin amarillo destacado", ...LEVELS].includes(String(item.level))) return null;
    if (item.evaluable) { evaluable += 1; if (LEVELS.includes(item.level as typeof LEVELS[number])) levels[item.level as string] += 1; }
  }
  return evaluable === result.evaluable_regions ? { evaluable, lighting: result.lighting_quality as Facts["lighting"], levels } : null;
}

async function openAIText(apiKey: string, model: string, input: Facts): Promise<string | null> {
  try {
    const provider = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model,
      instructions: "Responde en español simple, máximo 350 caracteres, usando solamente el resumen técnico recibido. Puedes decir amarillo destacado y nivel visual. Nunca nombres dientes, ubicaciones, enfermedades, causas, tratamientos ni diagnósticos. No inventes datos.", input: JSON.stringify(input), tools: [], store: false, max_output_tokens: 180 }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000) });
    if (!provider.ok) return null;
    const raw = await provider.text(); if (Buffer.byteLength(raw, "utf8") > 32 * 1024) return null;
    const body = JSON.parse(raw) as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = body.output?.flatMap(item => item.content ?? []).filter(item => item.type === "output_text").map(item => item.text ?? "").join("\n").trim();
    return text && text.length <= MAX_OUTPUT ? text : null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const access = await authorizeVisionDemoRequest(request.headers);
  if (!access.allowed) return response(access.status, { detail: access.code === "AUTH_REQUIRED" ? "Inicia sesión para usar esta demostración." : "Tu cuenta no está autorizada para esta demostración." });
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return response(415, { detail: "La solicitud debe usar application/json." });
  const raw = await request.text(); if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) return response(413, { detail: "La solicitud supera el límite permitido." });
  let parsed: unknown; try { parsed = JSON.parse(raw); } catch { return response(400, { detail: "La solicitud debe ser JSON válido." }); }
  const smile = facts(parsed); if (!smile) return response(400, { detail: "El resumen técnico Smile no es válido." });
  const deterministic = fallback(smile);
  const rate = await consumeVisionExplanationLimit(access.userId, process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!rate.allowed) return response(rate.status === 429 ? 429 : 200, rate.status === 429 ? { detail: "Alcanzaste el límite de explicaciones. Inténtalo más tarde." } : template(deterministic));
  const apiKey = process.env.OPENAI_API_KEY?.trim(), model = process.env.OPENAI_MODEL?.trim();
  if (!apiKey || !model) return response(200, template(deterministic));
  const summary = await openAIText(apiKey, model, smile);
  return response(200, summary ? { summary, observations: [], recommendation: "Si el cambio también se nota en persona o te preocupa, consúltalo con un odontólogo.", disclaimer: "Observación educativa basada en una fotografía; no es un diagnóstico.", source: "openai" } : template(deterministic));
}
