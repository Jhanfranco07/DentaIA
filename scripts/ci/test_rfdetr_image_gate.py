"""Regression for the image gate's fail-closed policy."""
import runpy
import unittest
from pathlib import Path


evaluate = runpy.run_path(str(Path(__file__).with_name("rfdetr-image-gate.py")))["evaluate"]


def report(vulnerabilities=()):
    return {"ArtifactType": "container_image", "ArtifactName": "dentaia-rfdetr-ci:local", "Results": [
        {"Class": "os-pkgs", "Type": "debian", "Packages": [{"Name": "openssl", "Version": "3.5.10-1"}],
         "Vulnerabilities": list(vulnerabilities)},
        {"Class": "lang-pkgs", "Type": "python-pkg", "Packages": [{"Name": "torch"}]},
    ]}


class ImageGateTests(unittest.TestCase):
    def test_clean_complete_image_passes(self):
        self.assertEqual(evaluate(report()), ([], 0))

    def test_known_openssl_cve_blocks_even_when_other_scanner_calls_it_low(self):
        finding = {"VulnerabilityID": "CVE-2026-84786", "Severity": "LOW",
                   "PkgName": "openssl", "InstalledVersion": "3.5.9"}
        blockers, count = evaluate(report([finding]))
        self.assertEqual(count, 1)
        self.assertEqual(len(blockers), 1)

    def test_known_vulnerable_base_blocks_even_when_advisory_database_is_empty(self):
        scanned = report()
        scanned["Results"][0]["Packages"] = [{"Name": "libssl3t64", "Version": "3.5.9-1~deb13u1"}]
        blockers, count = evaluate(scanned)
        self.assertEqual(count, 0)
        self.assertEqual(len(blockers), 1)

    def test_other_high_cve_blocks(self):
        finding = {"VulnerabilityID": "CVE-2099-0001", "Severity": "HIGH",
                   "PkgName": "example", "InstalledVersion": "1"}
        self.assertEqual(len(evaluate(report([finding]))[0]), 1)

    def test_missing_python_inventory_fails_closed(self):
        incomplete = report()
        incomplete["Results"].pop()
        with self.assertRaisesRegex(ValueError, "Incomplete package coverage"):
            evaluate(incomplete)

    def test_wrong_target_fails_closed(self):
        wrong = report()
        wrong["ArtifactName"] = "another-image:local"
        with self.assertRaisesRegex(ValueError, "different target"):
            evaluate(wrong)


if __name__ == "__main__":
    unittest.main()
