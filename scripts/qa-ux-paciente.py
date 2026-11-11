"""Capturas y comprobaciones de UI del paciente con sesión y HTTP sintéticos.

Requiere Playwright Python y Chrome/Edge locales; servidor Next en 127.0.0.1:3180
con NEXT_PUBLIC_SUPABASE_URL=https://ux-fixtures.supabase.co.
"""
import argparse
import base64
import json
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--browser", required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)

uid = "00000000-0000-4000-8000-000000000001"
user = {
    "id": uid, "email": "fixture@example.test", "aud": "authenticated",
    "confirmed_at": "2026-11-01T00:00:00Z",
    "app_metadata": {"dentaia": {"version": 1, "estado": "activo", "roles": ["paciente"]}},
    "user_metadata": {"full_name": "Cuenta sintética de QA"},
}
encode = lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")
token = encode({"alg": "HS256", "typ": "JWT"}) + "." + encode({
    "sub": uid, "exp": int(time.time()) + 3600, "role": "authenticated"
}) + ".fixture"
session = {
    "access_token": token, "refresh_token": "fixture-refresh-not-a-secret",
    "token_type": "bearer", "expires_in": 3600,
    "expires_at": int(time.time()) + 3600, "user": user,
}
results = []

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=args.browser)
    context = browser.new_context(viewport={"width": 1440, "height": 900},
                                  service_workers="block", reduced_motion="reduce")
    context.add_init_script(
        "localStorage.setItem('sb-ux-fixtures-auth-token'," +
        json.dumps(json.dumps(session)) + ");"
    )

    def intercept(route):
        request = route.request
        url = urlparse(request.url)
        if url.hostname == "ux-fixtures.supabase.co":
            if url.path == "/auth/v1/user":
                body = user
            elif url.path.startswith("/rest/v1/"):
                body = {"id": uid, "full_name": "Cuenta sintética de QA"} if url.path == "/rest/v1/profiles" else []
            else:
                body = {}
            route.fulfill(status=200, content_type="application/json",
                          headers={"Content-Range": "*/0"}, body=json.dumps(body))
        elif url.hostname == "127.0.0.1":
            route.continue_()
        else:
            route.abort()

    context.route("**/*", intercept)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    for width in (320, 390, 768, 1024, 1440):
        page.set_viewport_size({"width": width, "height": 900})
        page.goto("http://127.0.0.1:3180/panel")
        page.get_by_role("heading", name="Hola, Cuenta").wait_for(timeout=30000)
        page.screenshot(path=str(args.output / f"panel-{width}.png"), full_page=True)
        overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
        links = {path: page.locator(f'a[href="{path}"]').count() for path in
                 ("/directorio", "/solicitudes", "/fotografias", "/cuenta")}
        text_sizes = page.locator("main a, main p, main span").evaluate_all(
            """nodes => nodes.filter(n => n.getBoundingClientRect().width > 0)
               .map(n => ({text:(n.textContent||'').trim().slice(0,50),
                           px:parseFloat(getComputedStyle(n).fontSize)}))
               .filter(n => n.text && n.px < 12).slice(0,20)"""
        )
        results.append({"width": width, "overflow": overflow, "links": links,
                        "small_text": text_sizes})
        assert not overflow, f"Desbordamiento a {width}px"
        assert all(links.values()), f"Falta una ruta de paciente a {width}px: {links}"
        if width == 390:
            menu = page.get_by_role("button", name="Abrir navegación")
            menu.focus()
            page.keyboard.press("Enter")
            assert page.get_by_role("button", name="Cerrar navegación").count() >= 1
            page.keyboard.press("Escape")
            assert menu.evaluate("(element) => document.activeElement === element")
    assert not errors, errors
    browser.close()

(args.output / "resultado.json").write_text(
    json.dumps({"fixture": "sintético; tráfico externo bloqueado", "resultados": results,
                "errores_js": errors}, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(json.dumps({"anchos": len(results), "desbordamientos": 0, "errores_js": 0}))
