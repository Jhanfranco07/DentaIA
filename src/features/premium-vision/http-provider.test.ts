import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { createRfdetrHttpProvider, PremiumProviderError } from "./http-provider";

const runtime = {
  enabled: true as const,
  target: new URL("https://vision.example.test/analyze"),
  serviceSecret: "x".repeat(32),
};
const input = { image: new Uint8Array([1, 2, 3]), mediaType: "image/png" as const };
const valid = {
  schema_version: "dentaia.premium-vision-result.v1",
  provider: { id: "rf-detr-premium", availability: "available" },
  model: { identifier: "rfdetr-small-premium", version: "1.0.0", architecture: "RF-DETR Small",
    weights_format: "pytorch", input_width: 512, input_height: 512 },
  evaluation: { status: "evaluated", reference_image: { width: 512, height: 512 },
    image_quality: { status: "review", issues: ["Calidad clínica sin evaluar."] },
    detections: [{ category: { original_label: "ulcer", label_es: "Posible úlcera oral",
      coco_category_id: 6, inference_class_index: 5 }, confidence: 0.8,
      bounding_box: { format: "xyxy", coordinate_space: "reference_image_pixels", origin: "top_left",
        x_min: 1, y_min: 2, x_max: 20, y_max: 30 } }],
    limitations: ["Hallazgo preliminar."], error_code: null },
};

describe("independent RF-DETR HTTP provider", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("accepts exact model identity and preserves COCO 6 after excluding internal background", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(valid)));
    const result = await createRfdetrHttpProvider(runtime).evaluate(input);
    expect(result.evaluation.detections[0].category.coco_category_id).toBe(6);
    expect(fetcher).toHaveBeenCalledWith(runtime.target, expect.objectContaining({
      redirect: "error", headers: expect.objectContaining({ "X-Dentaia-Rfdetr-Secret": runtime.serviceSecret }),
    }));
  });

  it("rejects wrong class mapping, wrong identity and a busy service", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...valid, evaluation: {
      ...valid.evaluation, detections: [{ ...valid.evaluation.detections[0],
        category: { ...valid.evaluation.detections[0].category, coco_category_id: 7 } }],
    } })));
    await expect(createRfdetrHttpProvider(runtime).evaluate(input)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...valid, model: { ...valid.model, version: "wrong" } })));
    await expect(createRfdetrHttpProvider(runtime).evaluate(input)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    fetcher.mockResolvedValueOnce(new Response(null, { status: 429 }));
    await expect(createRfdetrHttpProvider(runtime).evaluate(input)).rejects.toEqual(new PremiumProviderError("BUSY"));
  });

  it("stops reading an oversized service response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array(132001)));
    await expect(createRfdetrHttpProvider(runtime).evaluate(input)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
