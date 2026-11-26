"""Strict Best EMA loading and CPU inference. No base-weight fallback or network downloads."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from threading import Lock

from PIL import Image

from .result import map_rows
from .result import LABELS

WEIGHTS_SHA = "e45f9d6ee728123c37e6f3036aa541e464b2bc2110e4c6c03b684264f71c6007"
CONFIG_SHA = "fdbaf304404fb9bcdd22b41dd213091cf98b2cb10204c77c2b0a9ac3afc94662"
MAPPING_SHA = "d6065dc2a74e532907a904b73eda516ea654eb249c59cce93aac588489054ef6"
CONFIG = Path(__file__).resolve().parents[1] / "config" / "model_config.json"
MAPPING = Path(__file__).resolve().parents[1] / "config" / "class_mapping.json"
CHECKPOINT = Path(os.environ.get("DENTAIA_RFDETR_CHECKPOINT", "/run/secrets/rfdetr/checkpoint_best_ema.pth"))
_model = None
_load_lock = Lock()


def _sha256(file) -> str:
    file.seek(0)
    digest = hashlib.file_digest(file, "sha256").hexdigest()
    file.seek(0)
    return digest


def load_model():
    global _model
    if _model is not None:
        return _model
    with _load_lock:
        if _model is not None:
            return _model
        import torch
        from importlib.metadata import version
        from rfdetr._namespace import _namespace_from_configs
        from rfdetr.config import RFDETRSmallConfig, TrainConfig
        from rfdetr.models.lwdetr import build_model

        if version("torch") != "2.15.0+cpu" or version("rfdetr") != "1.12.1" or torch.version.cuda is not None:
            raise ValueError("runtime_version")
        torch.set_num_threads(2)
        torch.set_num_interop_threads(1)
        with CONFIG.open("rb") as file:
            if _sha256(file) != CONFIG_SHA:
                raise ValueError("config_digest")
            config = json.load(file)
        with MAPPING.open("rb") as file:
            if _sha256(file) != MAPPING_SHA:
                raise ValueError("mapping_digest")
            mapping = json.load(file)
        if mapping.get("excluded_background_index") != 6 or [
            (row.get("inference_class_index"), row.get("coco_category_id"),
             row.get("original_label"), row.get("label_es"))
            for row in mapping.get("categories", [])
        ] != [(i, i + 1, *labels) for i, labels in enumerate(LABELS)]:
            raise ValueError("class_mapping")
        if (config.pop("model_name", None) != "RFDETRSmall" or config.pop("license", None) != "Apache-2.0"
                or config.get("num_classes") != 6 or config.get("resolution") != 512
                or config.get("num_queries") != 300 or config.get("num_select") != 300):
            raise ValueError("model_config")
        with CHECKPOINT.open("rb") as file:
            if os.fstat(file.fileno()).st_size != 127563327 or _sha256(file) != WEIGHTS_SHA:
                raise ValueError("checkpoint_digest")
            if torch.serialization.get_unsafe_globals_in_checkpoint(file):
                raise ValueError("checkpoint_globals")
            torch.serialization.clear_safe_globals()
            if torch.serialization.get_safe_globals():
                raise ValueError("checkpoint_allowlist")
            file.seek(0)
            payload = torch.load(file, weights_only=True, map_location="cpu")
        if not isinstance(payload, dict) or payload.get("epoch") != 16 or payload.get("model_name") != "RFDETRSmall":
            raise ValueError("best_ema_metadata")
        weights = payload.get("model")
        if not isinstance(weights, dict):
            raise ValueError("best_ema_state")
        config.update(device="cpu", pretrain_weights=None, amp=False, compile=False,
                      cuda_graphs=False, fused_optimizer=False)
        args = _namespace_from_configs(RFDETRSmallConfig(**config), TrainConfig(dataset_dir=None))
        args.pretrained_encoder = False
        args.force_no_pretrain = True
        model = build_model(args)
        expected = model.state_dict()
        if set(weights) != set(expected):
            raise ValueError("state_keys")
        for key, template in expected.items():
            value = weights[key]
            if (not isinstance(value, torch.Tensor) or value.device.type != "cpu"
                    or value.layout != torch.strided or value.dtype != template.dtype or value.shape != template.shape):
                raise ValueError("state_signature")
        if weights["class_embed.weight"].shape != (7, 256) or weights["class_embed.bias"].shape != (7,):
            raise ValueError("classification_head")
        model.load_state_dict(weights, strict=True)
        model.eval()
        _model = model
        return model


def predict(image: Image.Image) -> dict:
    import torch
    from torchvision.transforms import functional as F
    from rfdetr.models.postprocess import PostProcess

    width, height = image.size
    model = load_model()
    tensor = F.to_tensor(image)
    tensor = F.resize(tensor, [512, 512], antialias=False)
    tensor = F.normalize(tensor, mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225))
    with torch.inference_mode():
        raw = model(tensor.unsqueeze(0))
        if raw["pred_logits"].shape != (1, 300, 7) or raw["pred_boxes"].shape != (1, 300, 4):
            raise ValueError("output_shape")
        if not torch.isfinite(raw["pred_logits"]).all() or not torch.isfinite(raw["pred_boxes"]).all():
            raise ValueError("nonfinite_output")
        rows = PostProcess(num_select=300)(raw, torch.tensor([[height, width]]), score_threshold=0.35)[0]
    if not (len(rows["scores"]) == len(rows["labels"]) == len(rows["boxes"])):
        raise ValueError("postprocess_shape")
    return map_rows([(int(label), float(score), tuple(float(v) for v in box))
                     for label, score, box in zip(rows["labels"], rows["scores"], rows["boxes"])], width, height)
