import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { smileRuntime } from "@/features/analisis/smile-preview";
import { authorizeVisionDemoRequest } from "@/features/autorizacion/vision-demo-server";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

function failure(status: number, detail: string) {
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const access = await authorizeVisionDemoRequest(request.headers);
    if (!access.allowed) return failure(access.status, access.code === "AUTH_REQUIRED" ? "Inicia sesión para usar esta demostración." : "Tu cuenta no está autorizada para esta demostración.");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return failure(422, "Selecciona una fotografía.");
    if (!ACCEPTED.has(file.type)) return failure(415, "Solo se admiten JPG, PNG o WebP.");
    if (!file.size || file.size > MAX_BYTES) return failure(413, "La fotografía está vacía o supera 8 MB.");

    const runtime = smileRuntime(process.env);
    if (!runtime.enabled) {
      return NextResponse.json({
        detail: "Smile V17 no está habilitado para este entorno.",
        code: "SMILE_PREVIEW_NOT_ENABLED",
        failed_checks: runtime.failedChecks,
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const response = await fetch(runtime.target, {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        ...(runtime.serviceSecret ? { "X-Dentaia-Smile-Secret": runtime.serviceSecret } : {}),
      },
      body: await file.arrayBuffer(),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (cause) {
    const timeout = cause instanceof DOMException && cause.name === "TimeoutError";
    return failure(timeout ? 504 : 503, timeout
      ? "El análisis superó el tiempo máximo de 60 segundos."
      : "No se pudo conectar con DentaIA Smile.");
  }
}
