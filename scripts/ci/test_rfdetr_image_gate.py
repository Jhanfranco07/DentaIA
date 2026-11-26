"""Regressions for distinct RF-DETR PR review and deployment controls."""
import runpy
import unittest
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


class ImageGateTests(unittest.TestCase):
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

    def test_exception_requires_matching_package_inventory(self):
        image = report([finding(next(iter(CVES)), severity="LOW")])
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
        with self.assertRaisesRegex(ValueError, "Explicit review or deploy"):
            evaluate(report(), "anything")


if __name__ == "__main__":
    unittest.main()
