"""Two public occlusal test images, attributed to the CC BY 4.0 Zenodo dataset.
Images remain ignored; the manifest retains provenance and LFS integrity metadata.
"""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

COMMIT = "f02596a0227b9eaf767b955cd67196236111a3d5"
NAMES = [f"anonymous_003-007-1004-00_1731042060585_{view}_View.jpg"
         for view in ("Mandibular", "Maxillary_Occlusal")]


def main():
    root = Path(__file__).resolve().parents[1] / "evidence"
    private = root / "private"
    private.mkdir(parents=True, exist_ok=True)
    manifest = {"dataset": "https://doi.org/10.5281/zenodo.14827784",
                "license": "CC-BY-4.0", "license_metadata": "https://zenodo.org/api/records/14827784",
                "attribution": "Ahmed, Ghori, Khalid, Nooruddin, Adnan, Lal and Umer; Aga Khan University, 2025",
                "usage": "Unmodified public test photographs; technical smoke test only, not clinical validation",
                "files": []}
    for name in NAMES:
        path = "yolo_split/images/test/" + name
        pointer_url = f"https://raw.githubusercontent.com/Eeman1113/dental_study/{COMMIT}/{path}"
        url = f"https://media.githubusercontent.com/media/Eeman1113/dental_study/{COMMIT}/{path}"
        with urlopen(pointer_url, timeout=60) as response:
            pointer = response.read().decode()
        expected = pointer.split("oid sha256:")[1].split()[0]
        size = int(pointer.split("\nsize ")[1].strip())
        with urlopen(url, timeout=60) as response:
            data = response.read(8 * 1024 * 1024 + 1)
        digest = hashlib.sha256(data).hexdigest()
        if len(data) != size or digest != expected:
            raise ValueError("Sample integrity mismatch")
        (private / name).write_bytes(data)
        manifest["files"].append({"name": name, "url": url, "sha256": digest,
                                  "bytes": size, "modified": False})
    (root / "samples.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Two CC BY 4.0 occlusal public samples verified")


if __name__ == "__main__":
    main()
