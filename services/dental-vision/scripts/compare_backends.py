"""Compare recorded real outputs on the two smoke samples, not clinical accuracy."""
import json
import os
import sys
from pathlib import Path


def main():
    os.chdir(Path(__file__).resolve().parents[1])
    torch = json.loads(Path("evidence/benchmark-torch.json").read_text())
    low_memory = "--low-memory" in sys.argv
    onnx_name = "benchmark-onnx-lowmem.json" if low_memory else "benchmark-onnx.json"
    onnx = json.loads((Path("evidence") / onnx_name).read_text())
    cases = []
    for first in (r for r in torch["requests"] if r["repeat"] == 1):
        second = next(r for r in onnx["requests"] if r["sample"] == first["sample"] and r["repeat"] == 1)
        a, b = first["result"]["detections"], second["detections"]
        same = len(a) == len(b) and [d["class_id"] for d in a] == [d["class_id"] for d in b]
        confidence_error = max((abs(x["confidence"] - y["confidence"]) for x, y in zip(a, b)), default=0) if same else None
        box_error = max((abs(x["box"][key] - y["box"][key]) for x, y in zip(a, b) for key in x["box"]), default=0) if same else None
        cases.append({"sample": first["sample"], "torch_count": len(a), "onnx_count": len(b),
                      "same_count_and_class_order": same,
                      "max_confidence_absolute_error": confidence_error,
                      "max_normalized_box_absolute_error": box_error,
                      "within_1e_minus_4": same and confidence_error <= 1e-4 and box_error <= 1e-4})
    report = {"method": "Recorded repeat 1, detection confidence order; FP32; only two samples, not a general equivalence or accuracy claim",
              "cases": cases, "all_within_tolerance": all(c["within_1e_minus_4"] for c in cases)}
    report_name = "backend-comparison-lowmem.json" if low_memory else "backend-comparison.json"
    (Path("evidence") / report_name).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
