"""Prueba local con respuestas Supabase simuladas; no escribe en ninguna base."""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / "src/features/directorio/catalogo-demo.ts").read_text(encoding="utf-8")
rows = re.findall(r'\["([^"]+)", "([^"]+)", "([^"]+)", (-?\d+\.\d+), (-?\d+\.\d+)\]', source)
assert len(rows) == 20
points = []
for i, (_, _, district, lat, lon) in enumerate(rows, 1):
    n = f"{i:02d}"
    points.append(dict(id=f"a36a2026-0000-4000-8000-0000000000{n}", slug=f"odontologo-demo-s6-{n}",
                       name=f"Punto académico DEMO {n}", district=district, city="Lima", country="Perú",
                       latitude=float(lat), longitude=float(lon), is_demo=True, is_published=True,
                       requests_enabled=False, public_label="DEMO — Clínica ficticia, no ofrece atención real"))

def main():
    out = ROOT / "docs/directorio-demo/evidencia"
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for width in (320, 390, 768, 1024, 1440):
            page = browser.new_page(viewport={"width": width, "height": 900}, device_scale_factor=1)
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            def route_api(route):
                url = route.request.url
                if "/rest/v1/dentists" in url or "/rest/v1/dentist_public_locations" in url or "/rest/v1/dentist_reviews" in url:
                    payload = []
                elif "/rest/v1/directory_demo_locations" in url:
                    payload = points
                    if "slug=eq." in url:
                        slug = url.split("slug=eq.", 1)[1].split("&", 1)[0]
                        payload = [x for x in points if x["slug"] == slug]
                        payload = payload[0] if payload else None
                else:
                    payload = []
                route.fulfill(status=200, content_type="application/json", body=json.dumps(payload), headers={"content-range": "0-19/20"})
            page.route("https://demo-fixture.supabase.co/**", route_api)
            page.goto("http://127.0.0.1:3100/directorio", wait_until="domcontentloaded")
            page.get_by_text("Mostrando 20 de 20 profesionales").wait_for(timeout=20000)
            assert page.get_by_text("Perfiles de demostración. No representan profesionales verificados").count() >= 1
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"overflow en {width}"
            page.get_by_label("Buscar por nombre o especialidad").focus()
            page.keyboard.press("Tab")
            assert page.evaluate("document.activeElement.id") == "dir-distrito", f"teclado en {width}"
            page.screenshot(path=str(out / f"directorio-{width}.png"), full_page=True)
            page.get_by_label("Distrito", exact=True).select_option("Miraflores")
            page.get_by_text("Mostrando 1 de 20 profesionales").wait_for()
            page.get_by_label("Distrito", exact=True).select_option("")
            page.get_by_label("Especialidad", exact=True).select_option("Ortodoncia")
            page.get_by_text("Mostrando 3 de 20 profesionales").wait_for()
            page.get_by_label("Especialidad", exact=True).select_option("")
            page.get_by_label("Buscar por nombre o especialidad").fill("Alma")
            page.get_by_text("Mostrando 1 de 20 profesionales").wait_for()
            page.get_by_label("Buscar por nombre o especialidad").fill("Sin coincidencias XYZ")
            page.get_by_text("No hay profesionales que coincidan.").wait_for()
            page.get_by_role("button", name="Limpiar filtros").click()
            page.get_by_text("Mostrando 20 de 20 profesionales").wait_for()
            page.get_by_label("Buscar por nombre o especialidad").fill("Alma")
            page.get_by_text("Mostrando 1 de 20 profesionales").wait_for()
            page.get_by_role("button", name="Ver en mapa").click()
            page.get_by_role("tab", name="Mapa").click() if width <= 760 else None
            page.locator("[data-dentist-id='d36a2026-0000-4000-8000-000000000001']").wait_for(timeout=20000)
            page.goto("http://127.0.0.1:3100/directorio/d36a2026-0000-4000-8000-000000000001", wait_until="domcontentloaded")
            page.get_by_role("heading", name="Alma Valcárcel").wait_for(timeout=20000)
            assert page.get_by_text("Cómo llegar en OpenStreetMap").count() == 0
            assert page.get_by_role("link", name="Solicitar orientación").count() == 0
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            page.screenshot(path=str(out / f"perfil-{width}.png"), full_page=True)
            assert not errors, errors
            print(f"{width}px: lista, filtros, marcador, ficha y ancho correctos")
            page.close()
        browser.close()

if __name__ == "__main__":
    main()
