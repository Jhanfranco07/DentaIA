"""Offline regression tests: no API keys or Roboflow network requests."""
import unittest
from PIL import Image
from app.oral_basic import analyze, parse_predictions, MODEL


class OralBasicTests(unittest.TestCase):
    def test_allowlist_and_coordinates_scaled(self):
        response = {
            "image": {"width": 400, "height": 200},
            "predictions": [
                {"class": "toothLoss", "confidence": 0.89, "x": 200, "y": 100, "width": 80, "height": 60},
                {"class": "dentalCrowding", "confidence": 0.75, "x": 100, "y": 50, "width": 60, "height": 40},
                {"class": "caries", "confidence": 0.99, "x": 100, "y": 50, "width": 60, "height": 40},
                {"class": "rootStump", "confidence": 0.99, "x": 100, "y": 50, "width": 60, "height": 40},
                {"class": "toothLoss", "confidence": 0.2, "x": 200, "y": 100, "width": 80, "height": 60},
            ],
        }
        findings = parse_predictions(response, 800, 400)
        self.assertEqual([f["class"] for f in findings], ["toothLoss", "dentalCrowding"])
        self.assertEqual(findings[0]["box"], {"x1": 320, "y1": 140, "x2": 480, "y2": 260})
        result = analyze(Image.new("RGB", (800, 400), "white"), response)
        self.assertEqual(result["model"], MODEL)
        self.assertTrue(result["overlay_url"].startswith("data:image/png;base64,"))
        self.assertEqual(len(result["detections"]), 2)

    def test_empty_and_malformed_predictions_do_not_create_diagnoses(self):
        response = {"predictions": [
            {"class": "toothLoss", "confidence": "nan", "x": 20, "y": 30, "width": 10, "height": 10},
            {"class": "toothLoss", "confidence": .99, "x": 20, "y": 30, "width": -5, "height": 10},
            {"class": "malocclusion", "confidence": .98, "x": 20, "y": 30, "width": 10, "height": 10},
        ]}
        self.assertEqual(parse_predictions(response, 100, 100), [])
        self.assertEqual(analyze(Image.new("RGB", (100, 100)), response)["detections"], [])


if __name__ == "__main__":
    unittest.main()
