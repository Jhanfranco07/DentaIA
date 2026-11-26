import type { TipoFotografiaPermitido } from "@/features/analisis/fotografia";
import { assertPremiumVisionResult, type PremiumVisionResult } from "./contract.ts";

export type PremiumVisionProviderInput = {
  image: Uint8Array;
  mediaType: TipoFotografiaPermitido;
  referenceImage?: { width: number; height: number };
};

export type PremiumVisionProviderDescriptor = {
  id: "rf-detr-premium";
  architecture: "RF-DETR Small";
  inputWidth: 512;
  inputHeight: 512;
  weightsFormat: "pytorch";
};

/**
 * Boundary for the server-side RF-DETR adapter. Authentication, plan,
 * consent, rate limits and persistence stay outside the inference provider.
 */
export interface PremiumVisionProvider {
  readonly descriptor: PremiumVisionProviderDescriptor;
  evaluate(input: PremiumVisionProviderInput, signal?: AbortSignal): Promise<PremiumVisionResult>;
}

/** Validates the provider boundary even when an adapter is typed incorrectly at runtime. */
export async function evaluateWithPremiumVisionProvider(
  provider: PremiumVisionProvider,
  input: PremiumVisionProviderInput,
  signal?: AbortSignal,
): Promise<PremiumVisionResult> {
  const result: unknown = await provider.evaluate(input, signal);
  assertPremiumVisionResult(result);
  if (result.provider.id !== provider.descriptor.id
    || result.model.architecture !== provider.descriptor.architecture
    || result.model.input_width !== provider.descriptor.inputWidth
    || result.model.input_height !== provider.descriptor.inputHeight
    || result.model.weights_format !== provider.descriptor.weightsFormat) {
    throw new Error("El resultado no coincide con el descriptor del proveedor Premium.");
  }
  return result;
}
