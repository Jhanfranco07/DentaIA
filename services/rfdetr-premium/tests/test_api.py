import io
import os
import unittest
from unittest.mock import patch

from PIL import Image
from starlette.testclient import TestClient

from app.api import app
from app.result import map_rows


SECRET = "s" * 32


def synthetic_png(size=(16, 16)):
    out = io.BytesIO()
    Image.new("RGB", size, (128, 128, 128)).save(out, format="PNG")
    return out.getvalue()


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.env = patch.dict(os.environ, {
            "DENTAIA_RFDETR_ENABLED": "true", "DENTAIA_RFDETR_SERVICE_SECRET": SECRET,
            "DENTAIA_ENV": "test",
        })
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.client.close()

    def request(self, data=b"x", content_type="image/png", secret=SECRET):
        return self.client.post("/analyze", content=data,
                                headers={"content-type": content_type, "x-dentaia-rfdetr-secret": secret})

    def test_disabled_and_bad_secret_reject_before_prediction(self):
        with patch("app.api.predict") as inference:
            with patch.dict(os.environ, {"DENTAIA_RFDETR_ENABLED": "false"}):
                self.assertEqual(self.request().status_code, 503)
            self.assertEqual(self.request(secret="wrong").status_code, 401)
            inference.assert_not_called()

    def test_media_size_and_decode_bounds(self):
        self.assertEqual(self.request(content_type="application/octet-stream").status_code, 415)
        self.assertEqual(self.request(data=b"x" * (8 * 1024 * 1024 + 1)).status_code, 413)
        self.assertEqual(self.request().status_code, 422)
        self.assertEqual(self.request(data=synthetic_png((4000, 4000))).status_code, 413)

    def test_synthetic_image_mapping_without_checkpoint(self):
        with patch("app.api.predict", side_effect=lambda image: map_rows([], *image.size)) as inference:
            response = self.request(data=synthetic_png())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["evaluation"]["status"], "evaluated_no_detections")
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        inference.assert_called_once()


if __name__ == "__main__":
    unittest.main()
