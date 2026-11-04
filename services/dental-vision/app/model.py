"""Only verified candidate weights; no automatic model downloads or photo writes."""
import hashlib
import os
import tempfile
from pathlib import Path

EXPECTED_SHA256 = "7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d"
EXPECTED_SIZE = 80923921


def verify_weights(path: Path) -> None:
    if path.stat().st_size != EXPECTED_SIZE:
        raise ValueError("Unexpected model size (possibly an LFS pointer)")
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != EXPECTED_SHA256:
        raise ValueError("Model SHA-256 mismatch")


class TorchDetector:
    def __init__(self, path: Path):
        verify_weights(path)
        # These settings prevent Ultralytics telemetry and bound CPU parallelism.
        config_dir = Path(os.environ.get("YOLO_CONFIG_DIR", str(Path(tempfile.gettempdir()) / "dentaia-yolo")))
        config_dir.mkdir(parents=True, exist_ok=True)
        os.environ["YOLO_CONFIG_DIR"] = str(config_dir)
        os.environ["YOLO_AUTOINSTALL"] = "false"
        import torch
        from ultralytics import YOLO, settings

        settings.update({"sync": False})
        torch.set_num_threads(1)
        self.model = YOLO(str(path), task="detect")
        if self.model.names != {0: "d", 1: "D"}:
            raise ValueError("Unexpected class map")

    def predict(self, image):
        result = self.model.predict(
            source=image, device="cpu", imgsz=640, conf=0.25, iou=0.45,
            max_det=100, save=False, save_txt=False, save_crop=False,
            verbose=False, half=False, augment=False, rect=False,
        )[0]
        detections = []
        for box in result.boxes:
            class_id = int(box.cls.item())
            coordinates = [min(1.0, max(0.0, float(v))) for v in box.xyxyn[0].tolist()]
            detections.append({"class_id": class_id, "class_name": result.names[class_id],
                               "confidence": float(box.conf.item()),
                               "box": dict(zip(("x_min", "y_min", "x_max", "y_max"), coordinates))})
        return detections
