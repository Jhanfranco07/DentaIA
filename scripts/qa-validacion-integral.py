"""Smoke local sin cuentas ni escrituras; requiere servidor Next con URL Supabase fixture."""
import argparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--base", default="http://127.0.0.1:3181")
args = parser.parse_args()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width in (320, 390, 768, 1024, 1440):
        context = browser.new_context(viewport={"width": width, "height": 900}, service_workers="block")
        context.route("https://ux-fixtures.supabase.co/**", lambda route: route.fulfill(status=503, body='{"message":"fixture no disponible"}', content_type="application/json"))
        page = context.new_page()
        for path in ("/panel", "/profesional", "/solicitudes", "/fotografias"):
            page.goto(args.base + path, wait_until="domcontentloaded", timeout=30000)
            page.get_by_role("heading", name="Inicia sesión para continuar").wait_for(timeout=15000)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (width, path)
        page.goto(args.base + "/directorio", wait_until="domcontentloaded", timeout=30000)
        page.get_by_role("alert").get_by_text("No pudimos cargar el directorio.").wait_for(timeout=15000)
        page.get_by_role("button", name="Reintentar").focus()
        assert page.evaluate("document.activeElement.tagName") == "BUTTON"
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (width, "/directorio")
        context.close()
        print(f"{width}px: acceso sin sesión, error de directorio, teclado y ancho correctos")
    browser.close()
