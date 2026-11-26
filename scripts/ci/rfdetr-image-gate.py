"""Separate PR review from deployment policy for the RF-DETR container image."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


# Exception proposed for PR review only. It does not authorize a deployment.
REVIEW_EXCEPTION_CVES = frozenset({
    "CVE-2026-107493", "CVE-2026-84786", "CVE-2026-107496",
})
OPENSSL_PACKAGES = frozenset({"openssl", "libssl3t64", "openssl-provider-legacy"})
VULNERABLE_DEBIAN_VERSION = "3.5.9-1~deb13u1"
RISK_RECORD = "docs/security/OPENSSL_CVE_2026_DI211_IMAGE.md"


def evaluate(report: object, mode: str) -> tuple[list[str], list[str], int]:
    """Return (blockers, review warnings, CVE count); fail on incomplete scans."""
    if mode not in {"review", "deploy"}:
        raise ValueError("Explicit review or deploy mode required")
    if not isinstance(report, dict) or not isinstance(report.get("Results"), list):
        raise ValueError("Trivy report missing Results")
    if report.get("ArtifactType") != "container_image" or report.get("ArtifactName") != "dentaia-rfdetr-ci:local":
        raise ValueError("Trivy scanned a different target")
    if not report["Results"]:
        raise ValueError("Trivy report is empty")

    os_packages = False
    python_packages = False
    vulnerable_packages: set[str] = set()
    blockers: list[str] = []
    warnings: list[str] = []
    records: list[dict] = []

    for result in report["Results"]:
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
                if package.get("Name") in OPENSSL_PACKAGES:
                    if not isinstance(package.get("Version"), str):
                        raise ValueError("OpenSSL package version missing")
                    if package["Version"] == VULNERABLE_DEBIAN_VERSION:
                        vulnerable_packages.add(package["Name"])
        if result.get("Class") == "lang-pkgs" and result.get("Type") == "python-pkg" and packages:
            python_packages = True

        vulnerabilities = result.get("Vulnerabilities") or []
        if not isinstance(vulnerabilities, list):
            raise ValueError("Invalid vulnerability inventory")
        for vulnerability in vulnerabilities:
            if not isinstance(vulnerability, dict):
                raise ValueError("Invalid vulnerability record")
            records.append(vulnerability)

    if not os_packages or not python_packages:
        raise ValueError(f"Incomplete package coverage: os={os_packages}, python={python_packages}")
    for vulnerability in records:
        identifier = vulnerability.get("VulnerabilityID")
        severity = vulnerability.get("Severity")
        fixed = vulnerability.get("FixedVersion") or ""
        if not isinstance(identifier, str) or not isinstance(severity, str) or not isinstance(fixed, str):
            raise ValueError("Incomplete vulnerability record")
        package = vulnerability.get("PkgName")
        version = vulnerability.get("InstalledVersion")
        label = f"{identifier} {package}@{version} ({severity})"
        exception = (identifier in REVIEW_EXCEPTION_CVES
                     and package in vulnerable_packages
                     and version == VULNERABLE_DEBIAN_VERSION
                     and not fixed.strip()
                     and severity.upper() != "CRITICAL")
        if exception and mode == "review":
            warnings.append(f"PR review only: {label}; approval pending; {RISK_RECORD}")
        elif (exception or identifier in REVIEW_EXCEPTION_CVES
              or severity.upper() in {"HIGH", "CRITICAL"}):
            blockers.append(f"{label}; FixedVersion={fixed or 'none'}")

    if vulnerable_packages:
        message = (f"OpenSSL Debian {VULNERABLE_DEBIAN_VERSION}: "
                   f"{', '.join(sorted(REVIEW_EXCEPTION_CVES))}; {RISK_RECORD}")
        if mode == "review":
            warnings.append(f"PR review only; approval pending: {message}")
        else:
            blockers.append(f"Deployment prohibited: {message}")
    return blockers, warnings, len(records)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=("review", "deploy"))
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    report = json.loads(args.report.read_text(encoding="utf-8"))
    blockers, warnings, scanned = evaluate(report, args.mode)
    print(f"RF-DETR image ({args.mode}): {scanned} CVE records, {len(blockers)} blockers")
    for warning in warnings:
        print(f"WARNING: {warning}")
    for blocker in blockers:
        print(f"BLOCKER: {blocker}")
    return 1 if blockers else 0


if __name__ == "__main__":
    sys.exit(main())
