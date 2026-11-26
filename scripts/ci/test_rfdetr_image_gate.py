"""Regressions for distinct RF-DETR PR review and deployment controls."""
import runpy
import unittest
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path


gate = runpy.run_path(str(Path(__file__).with_name("rfdetr-image-gate.py")))
evaluate = gate["evaluate"]
CVES = gate["REVIEW_EXCEPTION_CVES"]
VERSION = gate["VULNERABLE_DEBIAN_VERSION"]


def report(vulnerabilities=(), openssl_version="3.5.10-1"):
    return {"ArtifactType": "container_image", "ArtifactName": "dentaia-rfdetr-ci:local", "Results": [
        {"Class": "os-pkgs", "Type": "debian", "Packages": [{"Name": "libssl3t64", "Version": openssl_version}],
         "Vulnerabilities": list(vulnerabilities)},
        {"Class": "lang-pkgs", "Type": "python-pkg", "Packages": [{"Name": "torch"}]},
    ]}


def finding(cve, *, severity="HIGH", package="libssl3t64", version=VERSION, fix=""):
    return {"VulnerabilityID": cve, "Severity": severity, "PkgName": package,
            "InstalledVersion": version, "FixedVersion": fix}


QA_NOW = datetime(2026, 11, 27, tzinfo=timezone.utc)


def qa_case(vulnerabilities=None):
    vulnerabilities = vulnerabilities or [finding("CVE-2026-76642", package="bsdutils", version="1:2.41.5")]
    image = report(vulnerabilities)
    image["Metadata"] = {"ImageID": "sha256:" + "a" * 64}
    exceptions = [{"cve": v["VulnerabilityID"], "source_class": "os-pkgs", "package": v["PkgName"],
                   "version": v["InstalledVersion"], "severity": v["Severity"],
                   "justification": "No fix reported; isolated synthetic QA only",
                   "applicability": "Package present; exploitability unverified",
                   "exposure": "QA service not deployed"} for v in vulnerabilities]
    policy = {"scope": "railway-qa", "image_name": image["ArtifactName"], "exceptions": exceptions}
    approval = {"approved_by": "Jhanfranco07", "image_id": image["Metadata"]["ImageID"],
                "exceptions_sha256": sha256(json.dumps(exceptions, sort_keys=True,
                     separators=(",", ":")).encode()).hexdigest(),
                "approved_at": "2026-11-26T00:00:00Z", "expires_at": "2026-12-10T00:00:00Z"}
    return image, policy, approval


class ImageGateTests(unittest.TestCase):
    def test_qa_exact_approval_does_not_change_review_or_deploy(self):
        image, policy, approval = qa_case()
        self.assertEqual(evaluate(image, "qa", policy, approval, QA_NOW)[0], [])
        self.assertEqual(len(evaluate(image, "review")[0]), 1)
        self.assertEqual(len(evaluate(image, "deploy")[0]), 1)

    def test_qa_requires_specific_approval_and_image(self):
        image, policy, approval = qa_case()
        for changed in (None, {**approval, "image_id": "sha256:" + "b" * 64},
                        {**approval, "approved_by": "someone-else"},
                        {**approval, "exceptions_sha256": "0" * 64}):
            with self.assertRaises(ValueError):
                evaluate(image, "qa", policy, changed, QA_NOW)
        image["Metadata"]["ImageID"] = "sha256:" + "c" * 64
        with self.assertRaisesRegex(ValueError, "bind this image"):
            evaluate(image, "qa", policy, approval, QA_NOW)

    def test_qa_expires_and_cannot_exceed_fourteen_days(self):
        image, policy, approval = qa_case()
        for changed, when in ((approval, datetime(2026, 12, 10, tzinfo=timezone.utc)),
                              ({**approval, "expires_at": "2026-12-10T00:00:01Z"}, QA_NOW),
                              ({**approval, "approved_at": "2026-11-28T00:00:00Z"}, QA_NOW)):
            with self.assertRaisesRegex(ValueError, "14 days"):
                evaluate(image, "qa", policy, changed, when)

    def test_qa_blocks_new_critical_fixed_and_changed_findings(self):
        image, policy, approval = qa_case()
        for new_finding in (finding("CVE-NEW", package="bsdutils", version="1:2.41.5"),
                            finding("CVE-NEW", severity="CRITICAL"),
                            finding("CVE-NEW", severity="LOW", fix="2")):
            image["Results"][0]["Vulnerabilities"].append(new_finding)
            self.assertTrue(evaluate(image, "qa", policy, approval, QA_NOW)[0])
            image["Results"][0]["Vulnerabilities"].pop()
        image["Results"][0]["Vulnerabilities"][0]["FixedVersion"] = "2"
        self.assertTrue(evaluate(image, "qa", policy, approval, QA_NOW)[0])
        image["Results"][0]["Vulnerabilities"].clear()
        self.assertTrue(evaluate(image, "qa", policy, approval, QA_NOW)[0])

    def test_clean_complete_image_passes_both_controls(self):
        for mode in ("review", "deploy"):
            self.assertEqual(evaluate(report(), mode), ([], [], 0))

    def test_only_three_exact_unfixed_openssl_cves_can_be_reviewed(self):
        image = report([finding(cve) for cve in CVES], VERSION)
        blockers, warnings, scanned = evaluate(image, "review")
        self.assertEqual((blockers, scanned), ([], 3))
        self.assertEqual(len(warnings), 4)  # Three advisories plus base version.
        self.assertTrue(all("approval pending" in warning for warning in warnings))
        deploy_blockers, _, _ = evaluate(image, "deploy")
        self.assertEqual(len(deploy_blockers), 4)

    def test_same_three_cves_in_legacy_openssl_package_are_review_only(self):
        image = report([finding(cve, package="openssl-provider-legacy") for cve in CVES])
        image["Results"][0]["Packages"].append({"Name": "openssl-provider-legacy", "Version": VERSION})
        self.assertEqual(evaluate(image, "review")[0], [])
        self.assertEqual(len(evaluate(image, "deploy")[0]), 4)

    def test_vulnerable_base_blocks_deploy_even_if_trivy_misses_advisories(self):
        image = report(openssl_version=VERSION)
        self.assertEqual(len(evaluate(image, "review")[1]), 1)
        self.assertEqual(len(evaluate(image, "deploy")[0]), 1)

    def test_unrelated_unfixed_high_blocks_review_and_deploy(self):
        image = report([finding("CVE-2099-0001", package="example", version="1")])
        for mode in ("review", "deploy"):
            self.assertEqual(len(evaluate(image, mode)[0]), 1)

    def test_exact_cve_with_fix_blocks_review(self):
        image = report([finding(next(iter(CVES)), fix="3.5.10-1~deb13u1")], VERSION)
        self.assertEqual(len(evaluate(image, "review")[0]), 1)

    def test_exact_cve_on_different_package_or_version_blocks_review(self):
        for package, version in (("example", VERSION), ("libssl3t64", "3.5.8")):
            image = report([finding(next(iter(CVES)), package=package, version=version, severity="LOW")])
            self.assertEqual(len(evaluate(image, "review")[0]), 1)

    def test_os_vulnerability_record_is_sufficient_when_inventory_omits_package(self):
        image = report([finding(next(iter(CVES)), severity="LOW")])
        self.assertEqual(evaluate(image, "review")[0], [])
        self.assertEqual(len(evaluate(image, "deploy")[0]), 2)

    def test_exception_rejects_python_result_with_same_package_and_version(self):
        image = report()
        image["Results"][1]["Vulnerabilities"] = [finding(next(iter(CVES)), severity="LOW")]
        self.assertEqual(len(evaluate(image, "review")[0]), 1)

    def test_missing_openssl_package_version_fails_closed(self):
        image = report()
        del image["Results"][0]["Packages"][0]["Version"]
        with self.assertRaisesRegex(ValueError, "OpenSSL package version missing"):
            evaluate(image, "review")

    def test_critical_without_fix_blocks_review(self):
        image = report([finding(next(iter(CVES)), severity="CRITICAL")], VERSION)
        self.assertEqual(len(evaluate(image, "review")[0]), 1)

    def test_missing_python_inventory_fails_closed(self):
        image = report()
        image["Results"].pop()
        with self.assertRaisesRegex(ValueError, "Incomplete package coverage"):
            evaluate(image, "review")

    def test_wrong_target_and_mode_fail_closed(self):
        image = report()
        image["ArtifactName"] = "another-image:local"
        with self.assertRaisesRegex(ValueError, "different target"):
            evaluate(image, "review")
        with self.assertRaisesRegex(ValueError, "Explicit review, qa or deploy"):
            evaluate(report(), "anything")


if __name__ == "__main__":
    unittest.main()
