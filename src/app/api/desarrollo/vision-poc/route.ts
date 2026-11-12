import "server-only";

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizeVisionDemoRequest } from "@/features/autorizacion/vision-demo-server";

const MAX_BYTES = 8 * 1024 * 1024;
const LOCAL_VISION_URL = "http://127.0.0.1:10000/predict";
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BACKEND_TIMEOUT_MS = 60_000;

// Initial local demo: only the two public, hash-verified CC-BY-4.0 samples.
const PUBLIC_SAMPLE_HASHES = new Set([
  "5dc8ba6309984f4c44050dc672051ccb2e60e66992a373910f9c225a9c483be4",
  "2f50d26eb8c907bc391432e1022c2240ec61010bba7fc65d1104cbbdc4905569",
]);

function error(status: number, detail: string) {
  return NextResponse.json(
    { detail },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function validSecret(secret: string | undefined): secret is string {
  return Boolean(secret && /^[\x00-\x7F]+$/.test(secret) && Buffer.byteLength(secret) >= 32);
}

function configuredVisionUrl(): URL | null {
  const configured = process.env.DENTAL_VISION_API_URL;
  if (!configured) {
    return process.env.NODE_ENV === "development" ? new URL(LOCAL_VISION_URL) : null;
  }

  try {
    const url = new URL(configured);
    if (url.pathname !== "/predict" || url.username || url.password || url.search || url.hash) {
      return null;
    }
    if (url.protocol === "https:") return url;
    if (process.env.NODE_ENV === "development"
        && url.protocol === "http:"
        && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const access = await authorizeVisionDemoRequest(request.headers);
  if (!access.allowed) {
    return error(access.status, access.code === "AUTH_REQUIRED"
      ? "Inicia sesión para usar esta demostración."
      : access.code === "ALLOWLIST_UNCONFIGURED"
        ? "El acceso a la demostración no está configurado."
        : access.code === "AUTH_UNAVAILABLE"
          ? "No se pudo verificar la sesión. Inténtalo más tarde."
          : "Tu cuenta no está autorizada para esta demostración.");
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].toLowerCase();
  if (!contentType || !ACCEPTED_TYPES.has(contentType)) {
    return error(415, "Envía una imagen JPEG, PNG o WebP.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BYTES) {
    return error(413, "La imagen supera 8 MiB.");
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.byteLength) {
    return error(422, "La imagen está vacía.");
  }
  if (bytes.byteLength > MAX_BYTES) {
    return error(413, "La imagen supera 8 MiB.");
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (!PUBLIC_SAMPLE_HASHES.has(sha256)) {
    return error(403, "Esta prueba local solo acepta las dos muestras públicas verificadas.");
  }

  const secret = process.env.DENTAL_VISION_SERVICE_SECRET;
  if (!validSecret(secret)) {
    return error(503, "Vision service credentials are not configured correctly.");
  }

  const visionUrl = configuredVisionUrl();
  if (!visionUrl) {
    return error(503, "Vision backend URL is missing or invalid for this environment.");
  }

  try {
    const response = await fetch(visionUrl, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "X-Service-Secret": secret,
      },
      body: bytes,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
    const responseBody = await response.text();

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      return error(504, "Vision backend exceeded the 60-second time limit.");
    }
    return error(503, "Could not connect to the configured vision backend.");
  }
}
