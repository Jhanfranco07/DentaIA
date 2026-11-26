"""Separate PR review from deployment policy for the RF-DETR container image."""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import os
import re
import sys
from pathlib import Path


# Exception proposed for PR review only. It does not authorize a deployment.
REVIEW_EXCEPTION_CVES = frozenset({
    "CVE-2026-107493", "CVE-2026-84786", "CVE-2026-107496",
})
OPENSSL_PACKAGES = frozenset({"openssl", "libssl3t64", "openssl-provider-legacy"})
VULNERABLE_DEBIAN_VERSION = "3.5.9-1~deb13u1"
RISK_RECORD = "docs/security/OPENSSL_CVE_2026_DI211_IMAGE.md"
QA_POLICY = Path("docs/security/DI211_RAILWAY_QA_EXCEPTIONS.json")


def _qa_approval(report: dict, policy: object, approval: object, now: datetime | None) -> set[tuple[str, str, str, str, str]]:
    """Accept only Jhan's time-limited approval for this exact scanned image and inventory."""
    if not isinstance(policy, dict) or policy.get("scope") != "railway-qa":
        raise ValueError("QA exception policy missing or wrong scope")
    metadata = report.get("Metadata")
    image_id = metadata.get("ImageID") if isinstance(metadata, dict) else None
    if policy.get("image_name") != report["ArtifactName"]:
        raise ValueError("QA policy image_name does not match the scanned artifact")
    if not isinstance(image_id, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", image_id):
        raise ValueError("Trivy report missing or invalid ImageID")
    exceptions = policy.get("exceptions")
    if not isinstance(exceptions, list) or not exceptions:
        raise ValueError("QA exception list missing")
    allowed: set[tuple[str, str, str, str, str]] = set()
    for item in exceptions:
        if not isinstance(item, dict) or any(not isinstance(item.get(k), str) or not item[k]
                                             for k in ("cve", "source_class", "package", "version", "severity",
                                                       "justification", "applicability", "exposure")):
            raise ValueError("Incomplete QA exception record")
        key = (item["cve"], item["source_class"], item["package"], item["version"], item["severity"])
        if key in allowed or item["severity"] == "CRITICAL":
            raise ValueError("Duplicate or CRITICAL QA exception")
        allowed.add(key)
    if not isinstance(approval, dict) or approval.get("approved_by") != "Jhanfranco07":
        raise ValueError("Jhan's specific QA approval is pending")
    digest = sha256(json.dumps(exceptions, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    if approval.get("image_id") != image_id or approval.get("exceptions_sha256") != digest:
        raise ValueError("QA approval does not bind this image and exception list")
    try:
        approved_at = datetime.fromisoformat(approval["approved_at"].replace("Z", "+00:00"))
        expires_at = datetime.fromisoformat(approval["expires_at"].replace("Z", "+00:00"))
    except (KeyError, TypeError, AttributeError, ValueError) as exc:
        raise ValueError("QA approval dates missing or invalid") from exc
    if approved_at.tzinfo is None or expires_at.tzinfo is None:
        raise ValueError("QA approval dates must include timezone")
    current = now or datetime.now(timezone.utc)
    if (current < approved_at or current >= expires_at
            or expires_at <= approved_at or expires_at - approved_at > timedelta(days=14)):
        raise ValueError("QA approval not active or exceeds 14 days")
    return allowed


def evaluate(report: object, mode: str, policy: object = None, approval: object = None,
             now: datetime | None = None) -> tuple[list[str], list[str], int]:
    """Return (blockers, review warnings, CVE count); fail on incomplete scans."""
    if mode not in {"review", "qa", "deploy"}:
        raise ValueError("Explicit review, qa or deploy mode required")
    if not isinstance(report, dict) or not isinstance(report.get("Results"), list):
        raise ValueError("Trivy report missing Results")
    if report.get("ArtifactType") != "container_image" or report.get("ArtifactName") != "dentaia-rfdetr-ci:local":
        raise ValueError("Trivy scanned a different target")
    if not report["Results"]:
        raise ValueError("Trivy report is empty")
    qa_allowed = _qa_approval(report, policy, approval, now) if mode == "qa" else set()
    qa_seen: set[tuple[str, str, str, str, str]] = set()

    os_packages = False
    python_packages = False
    vulnerable_packages: set[str] = set()
    blockers: list[str] = []
    warnings: list[str] = []
    records: list[tuple[dict, str]] = []

    for result in report["Results"]:
        if not isinstance(result, dict):
            raise ValueError("Invalid Trivy result")
        source_class = result.get("Class")
        if not isinstance(source_class, str):
            raise ValueError("Invalid Trivy result class")
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
            records.append((vulnerability, source_class))

    if not os_packages or not python_packages:
        raise ValueError(f"Incomplete package coverage: os={os_packages}, python={python_packages}")
    for vulnerability, source_class in records:
        identifier = vulnerability.get("VulnerabilityID")
        severity = vulnerability.get("Severity")
        fixed = vulnerability.get("FixedVersion") or ""
        if not isinstance(identifier, str) or not isinstance(severity, str) or not isinstance(fixed, str):
            raise ValueError("Incomplete vulnerability record")
        package = vulnerability.get("PkgName")
        version = vulnerability.get("InstalledVersion")
        label = f"{identifier} {package}@{version} ({severity})"
        if mode == "qa":
            key = (identifier, source_class, package, version, severity)
            qa_seen.add(key)
            if severity.upper() == "CRITICAL" or fixed.strip() or key not in qa_allowed:
                blockers.append(f"QA unauthorized, CRITICAL or fix available: {label}; FixedVersion={fixed or 'none'}")
            else:
                warnings.append(f"QA exception expires under specific approval: {label}")
            continue
        if source_class == "os-pkgs" and package in OPENSSL_PACKAGES and version == VULNERABLE_DEBIAN_VERSION:
            vulnerable_packages.add(package)
        exception = (identifier in REVIEW_EXCEPTION_CVES
                     and source_class == "os-pkgs"
                     and package in OPENSSL_PACKAGES
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
        elif mode == "deploy":
            blockers.append(f"Deployment prohibited: {message}")
    if mode == "qa":
        for missing in sorted(qa_allowed - qa_seen):
            blockers.append(f"QA approved finding absent from current scan: {missing}")
    return blockers, warnings, len(records)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=("review", "qa", "deploy"))
    parser.add_argument("--policy", type=Path, default=QA_POLICY)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    report = json.loads(args.report.read_text(encoding="utf-8"))
    policy = json.loads(args.policy.read_text(encoding="utf-8")) if args.mode == "qa" else None
    approval = json.loads(os.environ["DI211_QA_APPROVAL_JSON"]) if os.environ.get("DI211_QA_APPROVAL_JSON") else None
    try:
        blockers, warnings, scanned = evaluate(report, args.mode, policy, approval)
    except ValueError as exc:
        print(f"BLOCKER: {exc}")
        return 1
    print(f"RF-DETR image ({args.mode}): {scanned} CVE records, {len(blockers)} blockers")
    for warning in warnings:
        print(f"WARNING: {warning}")
    for blocker in blockers:
        print(f"BLOCKER: {blocker}")
    return 1 if blockers else 0


if __name__ == "__main__":
    sys.exit(main())
