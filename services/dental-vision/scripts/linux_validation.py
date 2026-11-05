"""Local Docker Linux validation. Never pushes, deploys, or prints service secrets.

Run from any directory: python scripts/linux_validation.py
Reports are separate from the historical Windows evidence.
"""
import hashlib
import json
import os
import secrets
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "evidence/linux"
RUNTIME_IMAGE = "dentaia-vision-poc:onnx-linux"


def command(args, timeout=3600, capture=False, check=True, env=None):
    result = subprocess.run(args, cwd=ROOT, text=True, encoding="utf-8", errors="replace",
                            capture_output=capture, timeout=timeout, env=env)
    if check and result.returncode:
        # Do not echo subprocess output: it may contain runtime configuration.
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(args[:3])}")
    return result


def request(base, path, data=None, secret=None, mime="image/jpeg"):
    headers = {"Content-Type": mime}
    if secret is not None:
        headers["X-Service-Secret"] = secret
    req = urllib.request.Request(base + path, data=data, headers=headers)
    try:
        # Never send the local evaluation secret through a host HTTP proxy.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(req, timeout=180) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


# stdlib-only probe: does not import ORT or allocate another model in the container.
PROBE = r'''
import hashlib, importlib.metadata, importlib.util, json
from pathlib import Path
status = dict(line.split(':', 1) for line in Path('/proc/1/status').read_text().splitlines() if ':' in line)
manifest = json.loads(Path('models/best.onnx.json').read_text())
with Path('models/best.onnx').open('rb') as stream:
    assert hashlib.file_digest(stream, 'sha256').hexdigest() == manifest['onnx_sha256']
result = {'process_peak_rss_kib': int(status['VmHWM'].split()[0]),
          'process_current_rss_kib': int(status['VmRSS'].split()[0]),
          'torch_installed': importlib.util.find_spec('torch') is not None,
          'ultralytics_installed': importlib.util.find_spec('ultralytics') is not None,
          'manifest': manifest,
          'packages': {d.metadata['Name']: d.version for d in importlib.metadata.distributions()}}
for name in ('memory.max', 'memory.peak', 'memory.current', 'memory.events', 'cpu.max'):
    path = Path('/sys/fs/cgroup') / name
    result[name] = path.read_text().strip() if path.exists() else None
print(json.dumps(result))
'''


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {"status": "running", "base_commit": "363d5e6", "requests": [],
              "method": "Linux Docker, real localhost HTTP, one worker; /proc/1 VmHWM kernel high-water RSS; cgroup memory.peak includes file cache and stdlib probes",
              "limits": {"memory_bytes": 512 * 1024**2, "swap_bytes": 0, "cpus": 0.1}}
    test_name = runtime_name = None
    try:
        info = command(["docker", "version", "--format", "{{json .Server}}"], timeout=30, capture=True)
        docker = json.loads(info.stdout)
        assert docker["Os"] == "linux", "A Linux Docker engine is required"
        report["docker"] = {key: docker.get(key) for key in ("Version", "Os", "Arch", "KernelVersion", "Platform")}
        command(["docker", "build", "--progress=plain", "--target", "runtime", "-f", "Dockerfile.onnx", "-t", RUNTIME_IMAGE, "."])
        suffix = secrets.token_hex(4)
        tests = command(["docker", "build", "--progress=plain", "--target", "test-receipt",
                         "--no-cache-filter", "test-execution", "--output", f"type=local,dest={OUTPUT}",
                         "-f", "Dockerfile.onnx", "."], check=False)
        report["suite_exit_code"] = tests.returncode
        report["suite_execution"] = "Docker BuildKit RUN --network=none; fresh test-execution stage; only JUnit exported"
        assert tests.returncode == 0, "Linux test suite failed"
        # Parse the JUnit receipt instead of inventing a count from an expected number.
        import xml.etree.ElementTree as ET
        suites = ET.parse(OUTPUT / "tests-linux.xml").getroot().findall("testsuite")
        report["suite"] = {key: sum(int(s.get(key, 0)) for s in suites)
                           for key in ("tests", "failures", "errors", "skipped")}
        assert report["suite"] == {"tests": 21, "failures": 0, "errors": 0, "skipped": 0}
        if not (ROOT / "evidence/private").exists():
            command([sys.executable, "scripts/download_samples.py"])
        samples = json.loads((ROOT / "evidence/samples.json").read_text())
        env = os.environ.copy()
        service_secret = secrets.token_hex(32)
        env["DENTAL_VISION_SERVICE_SECRET"] = service_secret
        runtime_name = "dentaia-runtime-" + suffix
        started = time.perf_counter()
        command(["docker", "run", "-d", "--name", runtime_name,
                 "--memory=512m", "--memory-swap=512m", "--cpus=0.1",
                 "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
                 "--cap-drop=ALL", "--security-opt", "no-new-privileges",
                 "-p", "127.0.0.1::10000", "--env", "DENTAL_VISION_SERVICE_SECRET",
                 RUNTIME_IMAGE], capture=True, env=env)
        port = command(["docker", "port", runtime_name, "10000/tcp"], capture=True).stdout.strip().split(":")[-1]
        base = "http://127.0.0.1:" + port
        deadline = time.monotonic() + 240
        while True:
            try:
                status, health = request(base, "/health")
                if status == 200:
                    break
            except (OSError, ValueError):
                pass
            if time.monotonic() > deadline:
                raise RuntimeError("Container did not become ready within 240s")
            time.sleep(0.5)
        assert health["backend"] == "onnx" and health["model_available"]
        report["ready_seconds"] = time.perf_counter() - started
        report["health"] = health
        assert request(base, "/predict", b"invalid")[0] == 401
        assert request(base, "/predict", b"invalid", "wrong")[0] == 401
        marker = "do-not-log-" + secrets.token_hex(8)
        assert request(base, "/predict", marker.encode(), service_secret)[0] == 422
        assert request(base, "/predict", b"invalid", service_secret, "image/gif")[0] == 415
        for sample in samples["files"]:
            data = (ROOT / "evidence/private" / sample["name"]).read_bytes()
            assert hashlib.sha256(data).hexdigest() == sample["sha256"]
            for repeat in range(4):
                started = time.perf_counter()
                status, result = request(base, "/predict", data, service_secret)
                elapsed = (time.perf_counter() - started) * 1000
                assert status == 200, f"Real prediction failed: HTTP {status}"
                assert result["width"] > 0 and result["height"] > 0
                for detection in result["detections"]:
                    box = detection["box"]
                    assert detection["class_name"] in ("d", "D")
                    assert 0 <= detection["confidence"] <= 1
                    assert 0 <= box["x_min"] <= box["x_max"] <= 1
                    assert 0 <= box["y_min"] <= box["y_max"] <= 1
                report["requests"].append({"sample": sample["name"], "repeat": repeat,
                                           "wall_ms": elapsed, "result": result})
                print(f"Real HTTP request completed: repeat={repeat}, wall_ms={elapsed:.1f}", flush=True)
        probe = command(["docker", "exec", runtime_name, "python", "-c", PROBE], capture=True)
        report["runtime"] = json.loads(probe.stdout)
        assert not report["runtime"]["torch_installed"] and not report["runtime"]["ultralytics_installed"]
        assert report["runtime"]["process_peak_rss_kib"] < 512 * 1024
        logs = command(["docker", "logs", runtime_name], capture=True)
        assert service_secret not in logs.stdout + logs.stderr
        assert marker not in logs.stdout + logs.stderr
        report["secret_and_payload_absent_from_logs"] = True
        state = json.loads(command(["docker", "inspect", runtime_name], capture=True).stdout)[0]
        assert not state["State"]["OOMKilled"]
        report["image_id"] = state["Image"]
        report["oom_killed"] = state["State"]["OOMKilled"]
        report["warm_median_wall_ms"] = statistics.median(q["wall_ms"] for q in report["requests"] if q["repeat"] > 0)
        report["status"] = "passed"
    except (Exception, KeyboardInterrupt) as error:
        report["status"] = "blocked_or_failed"
        report["blocker"] = type(error).__name__ + ": " + str(error)[:300]
        if runtime_name:
            try:
                state = json.loads(command(["docker", "inspect", runtime_name], timeout=15, capture=True).stdout)[0]
                report["oom_killed"] = state["State"]["OOMKilled"]
                report["container_exit_code"] = state["State"]["ExitCode"]
            except Exception:
                pass
        print("Linux validation did not complete; see evidence/linux/validation.json", flush=True)
    finally:
        # These are only uniquely named containers created by this run. Never prune user resources.
        for name in (runtime_name, test_name):
            if name:
                try:
                    command(["docker", "rm", "-f", name], timeout=30, capture=True, check=False)
                except (OSError, subprocess.TimeoutExpired):
                    pass
        (OUTPUT / "validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    if report["status"] != "passed":
        raise SystemExit(1)
    print(json.dumps({key: value for key, value in report.items() if key != "requests"}, indent=2))


if __name__ == "__main__":
    main()
