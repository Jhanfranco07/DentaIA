"""Fail closed on incomplete RF-DETR image scans and unresolved image CVEs."""
from __future__ import annotations

import json
import sys
from pathlib import Path


# Docker Scout classified these as HIGH in the local image. Keep blocking them
# even if a second advisory source assigns a lower severity.
KNOWN_BLOCKERS = {
    "CVE-2026-107493",
    "CVE-2026-84786",
    "CVE-2026-107496",
}
KNOWN_VULNERABLE_OPENSSL_VERSION = "3.5.9-1~deb13u1"


def evaluate(report: object) -> tuple[list[str], int]:
    if not isinstance(report, dict) or not isinstance(report.get("Results"), list):
        raise ValueError("Trivy report missing Results")
    if report.get("ArtifactType") != "container_image" or report.get("ArtifactName") != "dentaia-rfdetr-ci:local":
        raise ValueError("Trivy scanned a different target")
    results = report["Results"]
    if not results:
        raise ValueError("Trivy report is empty")
    os_packages = False
    python_packages = False
    blockers: list[str] = []
    scanned = 0
    for result in results:
        if not isinstance(result, dict):
            raise ValueError("Invalid Trivy result")
        packages = result.get("Packages") or []
        if not isinstance(packages, list):
            raise ValueError("Invalid package inventory")
        if result.get("Class") == "os-pkgs" and packages:
            os_packages = True
            for package in packages:
                if not isinstance(package, dict):
                    raise ValueError("Invalid OS package record")
                if package.get("Name") in {"openssl", "libssl3t64"} and package.get("Version") == KNOWN_VULNERABLE_OPENSSL_VERSION:
                    blockers.append(f"Known vulnerable OpenSSL package: {package['Name']}@{KNOWN_VULNERABLE_OPENSSL_VERSION}")
        if result.get("Class") == "lang-pkgs" and result.get("Type") == "python-pkg" and packages:
            python_packages = True
        vulnerabilities = result.get("Vulnerabilities") or []
        if not isinstance(vulnerabilities, list):
            raise ValueError("Invalid vulnerability inventory")
        for vulnerability in vulnerabilities:
            if not isinstance(vulnerability, dict):
                raise ValueError("Invalid vulnerability record")
            scanned += 1
            severity = vulnerability.get("Severity")
            identifier = vulnerability.get("VulnerabilityID")
            if not isinstance(identifier, str) or not isinstance(severity, str):
                raise ValueError("Incomplete vulnerability record")
            if severity.upper() in {"HIGH", "CRITICAL"} or identifier in KNOWN_BLOCKERS:
                package = vulnerability.get("PkgName", "unknown")
                version = vulnerability.get("InstalledVersion", "unknown")
                blockers.append(f"{identifier} {package}@{version} ({severity})")
    if not os_packages or not python_packages:
        raise ValueError(f"Incomplete package coverage: os={os_packages}, python={python_packages}")
    return blockers, scanned


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("usage: rfdetr-image-gate.py <trivy-json>")
    report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    blockers, scanned = evaluate(report)
    print(f"RF-DETR image: {scanned} CVE records, {len(blockers)} blocking findings")
    for blocker in blockers:
        print(blocker)
    return 1 if blockers else 0


if __name__ == "__main__":
    sys.exit(main())
