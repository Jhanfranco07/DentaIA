import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { authorizeVisionDemoRequest } from "@/features/autorizacion/vision-demo-server";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);
const LOCAL_API = "http://127.0.0.1:7862/analyze";
const PREVIEW_BRANCH = "feature/integracion-ia-premium";
const SERVICE_SECRET_MIN_LENGTH = 32;

function failure(status: number, detail: string) {
  return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

function smileTarget(): URL | null {
  if (process.env.NODE_ENV === "development") {
    try { return new URL(process.env.DENTAIA_SMILE_API_URL || LOCAL_API); } catch { return null; }
  }
  const serviceSecret = process.env.DENTAIA_SMILE_SERVICE_SECRET;
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== PREVIEW_BRANCH
    || process.env.DENTAIA_SMILE_PREVIEW_ENABLED !== "true"
    || !serviceSecret || serviceSecret.length < SERVICE_SECRET_MIN_LENGTH) return null;
  try {
    const target = new URL(process.env.DENTAIA_SMILE_API_URL ?? "");
    return target.protocol === "https:" && !target.username && !target.password && !target.search && !target.hash ? target : null;
  } catch { return null; }
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

    const target = smileTarget();
    if (!target) return failure(503, "Smile V17 no está habilitado para este entorno.");
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        ...(process.env.NODE_ENV === "development" ? {} : { "X-Dentaia-Smile-Secret": process.env.DENTAIA_SMILE_SERVICE_SECRET! }),
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
      : "No se pudo conectar con DentaIA Smile local. Inicia api.py en el puerto 7862.");
  }
}
