"""Static supply-chain gate for the independent RF-DETR service (no weights needed)."""
from __future__ import annotations

import hashlib
from pathlib import Path
import re
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
SERVICE = ROOT / "services" / "rfdetr-premium"
LOCKS = [SERVICE / "requirements.lock", SERVICE / "requirements-api.lock"]
ALLOWED_HOSTS = {"files.pythonhosted.org", "download-r2.pytorch.org"}
EXPECTED = {"torch": "torch-2.15.0%2Bcpu", "torchvision": "torchvision-0.29.2%2Bcpu",
            "rfdetr": "rfdetr-1.12.1", "opencv-python-headless": "opencv_python_headless-5.0.0.93",
            "fastapi": "fastapi-0.135.2", "starlette": "starlette-1.10.0", "uvicorn": "uvicorn-0.42.0"}
LINE = re.compile(r"^([A-Za-z0-9_.-]+) @ (https://\S+) --hash=sha256:([a-f0-9]{64})$")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    seen: dict[str, str] = {}
    for lock in LOCKS:
        for raw in lock.read_text(encoding="utf-8").splitlines():
            if not raw or raw.startswith("#"):
                continue
            match = LINE.fullmatch(raw)
            if match is None:
                raise ValueError(f"invalid locked wheel in {lock.name}")
            name, url, _digest = match.groups()
            parsed = urlparse(url)
            if parsed.hostname not in ALLOWED_HOSTS or parsed.username or parsed.password or parsed.query or parsed.fragment:
                raise ValueError("unapproved wheel source")
            if name in seen or not parsed.path.endswith(".whl"):
                raise ValueError("duplicate or non-wheel dependency")
            seen[name] = parsed.path.rsplit("/", 1)[-1]
    for name, prefix in EXPECTED.items():
        if name not in seen or not seen[name].startswith(prefix):
            raise ValueError(f"unexpected {name} wheel")
    if "opencv-python" in seen:
        raise ValueError("mixed OpenCV variants")
    if sha256(SERVICE / "config" / "model_config.json") != "fdbaf304404fb9bcdd22b41dd213091cf98b2cb10204c77c2b0a9ac3afc94662":
        raise ValueError("model config hash")
    if sha256(SERVICE / "config" / "class_mapping.json") != "d6065dc2a74e532907a904b73eda516ea654eb249c59cce93aac588489054ef6":
        raise ValueError("class mapping hash")
    print(f"RF-DETR lock and metadata verified: {len(seen)} pinned wheels; no weights read")


if __name__ == "__main__":
    main()
