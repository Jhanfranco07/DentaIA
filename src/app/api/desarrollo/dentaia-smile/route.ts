import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { smileRuntime } from "@/features/analisis/smile-preview";
import { authorizeVisionDemoRequest, consumeVisionAnalysisRequestLimit } from "@/features/autorizacion/vision-demo-server";
import { authorizePremiumVisionRequest } from "@/features/premium-vision/server";
import { rfdetrRuntime } from "@/features/premium-vision/runtime";
import { createRfdetrHttpProvider } from "@/features/premium-vision/http-provider";
import { evaluateWithPremiumVisionProvider } from "@/features/premium-vision/provider";
import { isSmileAnalysisResponse } from "@/features/analisis/smile-contract";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

function failure(status: number, detail: string, code?: string) {
  return NextResponse.json({ detail, ...(code ? { code } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}

function rateFailure(retryAfter?: number) {
  return NextResponse.json(
    { detail: "Has alcanzado el limite temporal de analisis. Intentalo mas tarde." },
    { status: 429, headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) } },
  );
}

export async function POST(request: NextRequest) {
  try {
    const access = await authorizeVisionDemoRequest(request.headers);
    if (!access.allowed) return failure(access.status, access.code === "AUTH_REQUIRED" ? "Inicia sesión para usar esta demostración." : "Tu cuenta no está autorizada para esta demostración.");
    const premiumRequested = request.headers.has("x-dentaia-premium-processing-consent");
    const premiumRuntime = rfdetrRuntime(process.env);
    if (premiumRequested) {
      if (!premiumRuntime.enabled) return failure(503, "La evaluación Premium no está habilitada.", "FEATURE_NOT_ENABLED");
      const permission = await authorizePremiumVisionRequest(request, async () =>
        request.headers.get("x-dentaia-premium-processing-consent") === "premium-vision-processing-v1"
          ? { granted: true, scope: "temporary_premium_evaluation", version: "premium-vision-processing-v1",
            source: "request_acknowledgement", consentId: null }
          : { granted: false, reason: "invalid" });
      if (!permission.allowed) return failure(permission.status, permission.code, permission.code);
    }
    const limit = await consumeVisionAnalysisRequestLimit(access.userId);
    if (!limit.allowed) return limit.status === 429 ? rateFailure(limit.retryAfter) : failure(503, "El analisis no esta disponible temporalmente.");
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
    const image = await file.arrayBuffer();
    const response = await fetch(runtime.target, {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        ...(runtime.serviceSecret ? { "X-Dentaia-Smile-Secret": runtime.serviceSecret } : {}),
      },
      body: image,
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const body = await response.text();
    if (premiumRequested && premiumRuntime.enabled && response.ok) {
      let smile: unknown;
      try { smile = JSON.parse(body); } catch { return failure(503, "Smile devolvió una respuesta inesperada."); }
      if (!isSmileAnalysisResponse(smile)) return failure(503, "Smile devolvió una respuesta inesperada.");
      try {
        const result = await evaluateWithPremiumVisionProvider(
          createRfdetrHttpProvider(premiumRuntime),
          { image: new Uint8Array(image), mediaType: file.type as "image/jpeg" | "image/png" | "image/webp" },
        );
        return NextResponse.json({ ...smile, premium_vision: result }, { headers: { "Cache-Control": "no-store" } });
      } catch {
        // Smile remains usable. A provider failure is explicit, never a zero-detection result.
        return NextResponse.json({ ...smile, premium_vision_error: "provider_unavailable" },
          { headers: { "Cache-Control": "no-store" } });
      }
    }
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
