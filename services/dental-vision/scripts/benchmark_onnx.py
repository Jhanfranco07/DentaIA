"""Standalone ORT evaluation: no torch/ultralytics imports. Not the API backend.
Reports actual model outputs and approximate memory; does not claim equivalence.
"""
import hashlib
import json
import os
import platform
import statistics
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import cv2
import onnxruntime as ort
import psutil
from PIL import Image, ImageOps


from app.onnx_model import preprocess, postprocess


def main():
    os.chdir(Path(__file__).resolve().parents[1])
    cv2.setNumThreads(1)
    manifest = json.loads(Path("evidence/onnx-export.json").read_text())
    model = Path("models/best.onnx")
    assert hashlib.sha256(model.read_bytes()).hexdigest() == manifest["onnx_sha256"]
    process = psutil.Process()
    peak = [process.memory_info().rss]
    stop = threading.Event()
    def sample():
        while not stop.wait(0.01):
            peak[0] = max(peak[0], process.memory_info().rss)
    monitor = threading.Thread(target=sample, daemon=True)
    monitor.start()
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    low_memory = os.environ.get("ORT_LOW_MEMORY") == "1"
    if low_memory:
        options.enable_cpu_mem_arena = False
        options.enable_mem_pattern = False
    started = time.perf_counter()
    session = ort.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"])
    report = {"real_inference": True, "platform": platform.platform(), "runtime": ort.__version__,
              "low_memory": low_memory, "intra_op_threads": 1, "inter_op_threads": 1,
              "load_seconds": time.perf_counter() - started,
              "loaded_rss_mib": process.memory_info().rss / 1024**2,
              "method": "Standalone ORT with OpenCV linear letterbox, class-aware NumPy NMS; no HTTP overhead; RSS sampled every 10ms; no Torch imports",
              "requests": []}
    samples = json.loads(Path("evidence/samples.json").read_text())
    for entry in samples["files"]:
        path = Path("evidence/private") / entry["name"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry["sha256"]
        for repeat in range(4):
            started = time.perf_counter()
            with Image.open(path) as source:
                image = ImageOps.exif_transpose(source).convert("RGB")
            tensor, ratio, left, top = preprocess(image)
            output = session.run(None, {session.get_inputs()[0].name: tensor})[0]
            detections = postprocess(output, image.width, image.height, ratio, left, top)
            image.close()
            report["requests"].append({"sample": entry["name"], "repeat": repeat,
                        "wall_ms": (time.perf_counter() - started) * 1000,
                        "detections": detections, "rss_mib": process.memory_info().rss / 1024**2})
    stop.set()
    monitor.join()
    report["peak_sampled_rss_mib"] = peak[0] / 1024**2
    report["warm_median_wall_ms"] = statistics.median(r["wall_ms"] for r in report["requests"] if r["repeat"] > 0)
    report_name = "benchmark-onnx-lowmem.json" if low_memory else "benchmark-onnx.json"
    (Path("evidence") / report_name).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "requests"}, indent=2))


if __name__ == "__main__":
    main()
