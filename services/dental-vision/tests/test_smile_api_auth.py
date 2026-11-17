import asyncio
import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

from app.smile_api import analyze, app, health


async def receive():
    return {"type": "http.request", "body": b"x", "more_body": False}


class SmileApiAuthenticationTests(unittest.TestCase):
    def test_remote_mode_rejects_analyze_without_the_service_secret(self):
        with patch.dict(
            os.environ,
            {
                "DENTAIA_SMILE_REQUIRE_SERVICE_SECRET": "true",
                "DENTAIA_SMILE_SERVICE_SECRET": "x" * 32,
            },
            clear=False,
        ):
            asyncio.run(self._request_without_secret())

    async def _request_without_secret(self):
        async with app.router.lifespan_context(app):
            health_response = await health()
            self.assertEqual(health_response["model"], "teeth-4coz7/1")
            request = Request(
                {"type": "http", "method": "POST", "headers": [(b"content-type", b"image/jpeg")]},
                receive,
            )
            with self.assertRaises(HTTPException) as raised:
                await analyze(request)
            self.assertEqual(raised.exception.status_code, 401)

    def test_remote_mode_does_not_start_with_a_short_service_secret(self):
        with patch.dict(
            os.environ,
            {
                "DENTAIA_SMILE_REQUIRE_SERVICE_SECRET": "true",
                "DENTAIA_SMILE_SERVICE_SECRET": "short",
            },
            clear=False,
        ):
            with self.assertRaisesRegex(RuntimeError, "at least 32"):
                asyncio.run(self._start_service())

    async def _start_service(self):
        async with app.router.lifespan_context(app):
            pass
