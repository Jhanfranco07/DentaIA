"""Compila, inicia Next, espera disponibilidad, ejecuta QA local y cierra el servidor."""
import argparse
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.request import urlopen

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, default=Path("docs/validacion-integral/evidencias"))
parser.add_argument("--skip-build", action="store_true")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
args.output.mkdir(parents=True, exist_ok=True)

with socket.socket() as probe:
    probe.bind(("127.0.0.1", 0))
    port = probe.getsockname()[1]
base = f"http://127.0.0.1:{port}"
env = os.environ.copy()
env.update({
    "NEXT_PUBLIC_SUPABASE_URL": "https://ux-fixtures.supabase.co",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_fixture",
    "DENTAIA_CLINICAL_HTTP_ENABLED": "false",
    "DENTAIA_ADMIN_READS_ENABLED": "false",
    "DENTAIA_ROLE_WRITES_ENABLED": "false",
})

def ejecutar(comando):
    print("+", " ".join(map(str, comando)), flush=True)
    subprocess.run(comando, cwd=root, env=env, check=True)

if not args.skip_build:
    ejecutar(["npm.cmd" if os.name == "nt" else "npm", "run", "build"])

log_path = args.output / "next-server.log"
with log_path.open("w", encoding="utf-8") as log:
    server = subprocess.Popen(
        ["node", str(root / "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", str(port)],
        cwd=root, env=env,
        stdout=log, stderr=subprocess.STDOUT,
    )
    try:
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            if server.poll() is not None:
                raise RuntimeError(f"Next terminó antes de estar listo; revisar {log_path}")
            try:
                with urlopen(base + "/cuenta", timeout=2) as response:
                    if response.status == 200:
                        break
            except Exception:
                time.sleep(0.25)
        else:
            raise TimeoutError(f"Next no quedó listo en 45 s; revisar {log_path}")
        print(f"Next listo en {base}", flush=True)
        browser = subprocess.check_output([
            sys.executable, "-c",
            "from playwright.sync_api import sync_playwright; p=sync_playwright().start(); print(p.chromium.executable_path); p.stop()",
        ], text=True).strip()
        ejecutar([sys.executable, "scripts/qa-ux-fotografias.py", "--fase", "despues", "--output", str(args.output), "--browser", browser, "--base", base])
        ejecutar([sys.executable, "scripts/qa-validacion-integral.py", "--base", base])
    finally:
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)
        print("Servidor Next cerrado", flush=True)
