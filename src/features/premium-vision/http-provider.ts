import "server-only";

import { PREMIUM_VISION_CATEGORY_LABELS, isPremiumVisionResult, type PremiumVisionCategory, type PremiumVisionResult } from "./contract";
import type { PremiumVisionProvider, PremiumVisionProviderInput } from "./provider";
import type { RfdetrRuntime } from "./runtime";

const CLASSES = Object.keys(PREMIUM_VISION_CATEGORY_LABELS) as PremiumVisionCategory[];

export class PremiumProviderError extends Error {
  constructor(readonly code: "UNAVAILABLE" | "BUSY" | "TIMEOUT" | "INVALID_RESPONSE") {
    super(code);
  }
}

export function createRfdetrHttpProvider(runtime: Extract<RfdetrRuntime, { enabled: true }>): PremiumVisionProvider {
  return {
    descriptor: { id: "rf-detr-premium", architecture: "RF-DETR Small", inputWidth: 512,
      inputHeight: 512, weightsFormat: "pytorch" },
    async evaluate(input: PremiumVisionProviderInput, signal?: AbortSignal): Promise<PremiumVisionResult> {
      const timeout = AbortSignal.timeout(45_000);
      let response: Response;
      try {
        response = await fetch(runtime.target, {
          method: "POST", redirect: "error", cache: "no-store",
          headers: { "Content-Type": input.mediaType, "X-Dentaia-Rfdetr-Secret": runtime.serviceSecret },
          body: Buffer.from(input.image), signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (error) {
        throw new PremiumProviderError(error instanceof DOMException && error.name === "TimeoutError" ? "TIMEOUT" : "UNAVAILABLE");
      }
      if (response.status === 429) throw new PremiumProviderError("BUSY");
      if (!response.ok) throw new PremiumProviderError("UNAVAILABLE");
      if (!response.body) throw new PremiumProviderError("INVALID_RESPONSE");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 132000) throw new PremiumProviderError("INVALID_RESPONSE");
          chunks.push(value);
        }
      } catch (error) {
        if (error instanceof PremiumProviderError) throw error;
        throw new PremiumProviderError("UNAVAILABLE");
      } finally {
        await reader.cancel().catch(() => {});
      }
      const body = Buffer.concat(chunks, length).toString("utf8");
      let candidate: unknown;
      try { candidate = JSON.parse(body); } catch { throw new PremiumProviderError("INVALID_RESPONSE"); }
      if (!isPremiumVisionResult(candidate)
        || candidate.model.identifier !== "rfdetr-small-premium"
        || candidate.model.version !== "1.0.0"
        || candidate.provider.availability !== "available"
        || (input.referenceImage !== undefined &&
          (candidate.evaluation.reference_image.width !== input.referenceImage.width
            || candidate.evaluation.reference_image.height !== input.referenceImage.height))
        || candidate.evaluation.detections.some(({ category, confidence }) =>
          category.inference_class_index < 0 || category.inference_class_index >= CLASSES.length
          || category.coco_category_id !== category.inference_class_index + 1
          || category.original_label !== CLASSES[category.inference_class_index]
          || confidence <= 0.35)) {
        throw new PremiumProviderError("INVALID_RESPONSE");
      }
      return candidate;
    },
  };
}
