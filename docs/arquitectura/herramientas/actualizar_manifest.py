"""Actualizar hashes documentales sin regenerar ni sobrescribir evidencias."""
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
paths=[p for p in sorted(root.rglob('*')) if p.is_file() and p.name!='MANIFEST_SHA256.json' and '__pycache__' not in p.parts]
manifest={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
(root/'MANIFEST_SHA256.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Archivos con SHA-256:',len(manifest))
