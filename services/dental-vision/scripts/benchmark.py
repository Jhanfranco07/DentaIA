"""Real HTTP-in-process measurements, including load and approximate sampled RSS.
No request photographs are written by the API. Only numerical results are saved.
"""
import hashlib
import importlib.metadata
import json
import os
import platform
import statistics
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import psutil
from fastapi.testclient import TestClient
from app.main import create_app


def main():
    os.chdir(Path(__file__).resolve().parents[1])
    os.environ["DENTAL_VISION_SERVICE_SECRET"] = "local-benchmark-only-" * 3
    process = psutil.Process()
    peak = [process.memory_info().rss]
    stop = threading.Event()
    def sample_memory():
        while not stop.wait(0.01):
            peak[0] = max(peak[0], process.memory_info().rss)
    monitor = threading.Thread(target=sample_memory, daemon=True)
    monitor.start()
    manifest = json.loads(Path("evidence/samples.json").read_text())
    backend = os.environ.get("MODEL_BACKEND", "torch")
    packages = ("torch", "torchvision", "ultralytics", "fastapi", "starlette", "Pillow", "numpy") if backend == "torch" else ("onnxruntime", "fastapi", "starlette", "Pillow", "numpy", "opencv-python")
    report = {"real_inference": True, "platform": platform.platform(), "backend": backend,
              "python": platform.python_version(), "cpu": platform.processor(),
              "physical_cores": psutil.cpu_count(logical=False), "device": "cpu",
              "versions": {name: importlib.metadata.version(name) for name in packages},
              "threads": 1, "imgsz": 640, "conf": 0.25, "iou": 0.45,
              "method": "TestClient HTTP in-process; wall latency excludes network; RSS sampled every 10ms; Windows is not Render Linux",
              "requests": []}
    started = time.perf_counter()
    try:
        with TestClient(create_app()) as client:
            report["load_seconds"] = time.perf_counter() - started
            assert client.get("/health").status_code == 200, "Real model failed to load"
            report["loaded_rss_mib"] = process.memory_info().rss / 1024**2
            for sample in manifest["files"]:
                data = (Path("evidence/private") / sample["name"]).read_bytes()
                assert hashlib.sha256(data).hexdigest() == sample["sha256"]
                for repeat in range(4):
                    started = time.perf_counter()
                    response = client.post("/predict", content=data, headers={
                        "x-service-secret": os.environ["DENTAL_VISION_SERVICE_SECRET"],
                        "content-type": "image/jpeg"})
                    elapsed = (time.perf_counter() - started) * 1000
                    assert response.status_code == 200, response.text
                    report["requests"].append({"sample": sample["name"], "repeat": repeat,
                        "cold": repeat == 0 and sample == manifest["files"][0],
                        "wall_ms": elapsed, "rss_mib": process.memory_info().rss / 1024**2,
                        "result": response.json()})
    finally:
        stop.set()
        monitor.join()
    report["peak_sampled_rss_mib"] = peak[0] / 1024**2
    report["warm_median_wall_ms"] = statistics.median(r["wall_ms"] for r in report["requests"] if r["repeat"] > 0)
    if backend == "onnx":
        report["torch_imported"] = "torch" in sys.modules
        assert not report["torch_imported"], "ONNX API unexpectedly imported Torch"
    output_name = "benchmark-onnx-api.json" if backend == "onnx" else "benchmark-torch.json"
    (Path("evidence") / output_name).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "requests"}, indent=2))


if __name__ == "__main__":
    main()
