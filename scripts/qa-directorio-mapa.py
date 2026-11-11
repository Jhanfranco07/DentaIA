"""QA local del directorio con datos inequívocamente sintéticos y tráfico externo bloqueado."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--browser", required=True)
parser.add_argument("--fase", choices=("antes", "despues"), required=True)
args = parser.parse_args()
out = args.output / args.fase
out.mkdir(parents=True, exist_ok=True)

def uid(n):
    return f"00000000-0000-4000-8000-{n:012d}"

dentists = [
    {"id": uid(1), "name": "Profesional sintético de QA A", "specialty": "Ortodoncia", "district": "Miraflores",
     "initials": "QA", "avatar_color": "#d9eee8", "description": "Perfil exclusivo de pruebas visuales.",
     "consultation_price": 0, "currency": "PEN", "slug": "qa-a", "created_at": "2026-01-01",
     "is_active": True, "is_demo": False},
    {"id": uid(2), "name": "Profesional sintético de QA B", "specialty": "Odontopediatría", "district": "Surco",
     "initials": "QB", "avatar_color": "#e1eaf5", "description": "Perfil exclusivo de pruebas visuales.",
     "consultation_price": 0, "currency": "PEN", "slug": "qa-b", "created_at": "2026-01-01",
     "is_active": True, "is_demo": False},
]
locations = [
    {"id": uid(11), "dentist_id": uid(1), "practice_name": "Consultorio sintético A",
     "practice_address": "Dirección de prueba A", "latitude": -12.120, "longitude": -77.030, "created_at": "2026-01-01"},
    {"id": uid(12), "dentist_id": uid(2), "practice_name": "Consultorio sintético B",
     "practice_address": "Dirección de prueba B", "latitude": -12.145, "longitude": -76.990, "created_at": "2026-01-01"},
]
demo = [{"id": uid(21), "slug": "qa-demo", "name": "Establecimiento ficticio de QA",
         "district": "Miraflores", "city": "Lima", "country": "Perú",
         "latitude": -12.13, "longitude": -77.04, "is_demo": True,
         "is_published": True, "requests_enabled": False,
         "public_label": "DEMO — Clínica ficticia, no ofrece atención real"}]
tile = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082")
report = {"fixture": "datos sintéticos de QA; ningún servicio remoto", "fase": args.fase,
          "anchos": [], "checks": [], "errores_js": []}

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path=args.browser)
    context = browser.new_context(viewport={"width": 1440, "height": 900},
                                  service_workers="block", reduced_motion="reduce",
                                  permissions=[])
    flags = {"empty": False, "error": False, "tiles_offline": False}
    def intercept(route):
        u = urlparse(route.request.url)
        if u.hostname == "ux-fixtures.supabase.co":
            if u.path == "/rest/v1/dentists":
                if flags["error"]:
                    route.fulfill(status=503, content_type="application/json", body='{"message":"fixture"}')
                    return
                body = [] if flags["empty"] else dentists
            elif u.path == "/rest/v1/dentist_public_locations":
                body = [] if flags["empty"] else locations
                if "eq." in u.query:
                    body = [x for x in body if x["dentist_id"] in u.query]
            elif u.path == "/rest/v1/dentist_reviews":
                body = []
            elif u.path == "/rest/v1/directory_demo_locations":
                body = [] if flags["empty"] else demo
            else:
                body = []
            route.fulfill(status=200, content_type="application/json",
                          headers={"Content-Range": "*/0"}, body=json.dumps(body))
        elif u.hostname == "tile.openstreetmap.org":
            if flags["tiles_offline"]:
                route.abort()
            else:
                route.fulfill(status=200, content_type="image/png", body=tile)
        elif u.hostname == "127.0.0.1":
            route.continue_()
        else:
            route.abort()
    context.route("**/*", intercept)
    page = context.new_page()
    page.on("pageerror", lambda error: report["errores_js"].append(str(error)))

    def check(name, fn):
        try:
            fn()
            report["checks"].append({"nombre": name, "ok": True})
            print("PASS", name, flush=True)
        except Exception as exc:
            report["checks"].append({"nombre": name, "ok": False, "detalle": str(exc)[:500]})
            print("FAIL", name, str(exc)[:120], flush=True)

    for width in (320, 390, 768, 1024, 1440):
        page.set_viewport_size({"width": width, "height": 900})
        page.goto("http://127.0.0.1:3180/directorio", wait_until="domcontentloaded")
        page.get_by_text("Profesional sintético de QA A").first.wait_for(timeout=30000)
        if width > 760:
            page.get_by_role("button", name="Ver odontólogo Profesional sintético de QA A, Consultorio sintético A").wait_for(timeout=20000)
        page.add_style_tag(content="nextjs-portal{display:none!important}")
        page.screenshot(path=str(out / f"directorio-{width}.png"), full_page=True)
        overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
        report["anchos"].append({"ancho": width, "desbordamiento": overflow})
        check(f"Directorio sin desbordamiento a {width}px", lambda overflow=overflow: (
            None if not overflow else (_ for _ in ()).throw(AssertionError("horizontal"))
        ))

    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto("http://127.0.0.1:3180/directorio")
    page.get_by_text("Profesional sintético de QA A").first.wait_for()
    check("Búsqueda por especialidad", lambda: (
        page.get_by_label("Buscar por nombre o especialidad").fill("odontopediatria"),
        page.get_by_text("Profesional sintético de QA B").first.wait_for(),
        page.get_by_text("Profesional sintético de QA A").count() == 0 or (_ for _ in ()).throw(AssertionError("filtro"))
    ))
    page.get_by_label("Buscar por nombre o especialidad").fill("")
    check("Filtro por distrito", lambda: (
        page.get_by_label("Distrito", exact=True).select_option("Miraflores"),
        page.get_by_text("Profesional sintético de QA A").first.wait_for(),
        page.get_by_text("Profesional sintético de QA B").count() == 0 or (_ for _ in ()).throw(AssertionError("distrito"))
    ))
    page.get_by_label("Distrito", exact=True).select_option("")
    check("Marcadores, ficha y atribución", lambda: (
        page.get_by_role("button", name="Ver odontólogo Profesional sintético de QA A, Consultorio sintético A").wait_for(timeout=20000),
        page.get_by_text("OpenStreetMap contributors").first.wait_for(timeout=20000),
        page.get_by_role("button", name="Ver odontólogo Profesional sintético de QA A, Consultorio sintético A").click(),
        page.get_by_role("link", name="Ver perfil").last.wait_for()
    ))
    if args.fase == "despues":
        check("Lista selecciona el marcador", lambda: (
            page.get_by_role("button", name="Ver en mapa", exact=True).first.click(),
            page.locator('[data-dentist-id="' + uid(1) + '"][data-selected="true"]').wait_for(timeout=10000)
        ))
    flags["empty"] = True
    page.goto("http://127.0.0.1:3180/directorio")
    check("Estado sin datos", lambda: page.get_by_text(
        "Por ahora no hay odontólogos activos ni ubicaciones publicadas en el directorio.").wait_for())
    flags["empty"] = False
    flags["error"] = True
    page.goto("http://127.0.0.1:3180/directorio")
    check("Error recuperable", lambda: page.get_by_text("No pudimos cargar el directorio.").wait_for())
    flags["error"] = False
    page.get_by_role("button", name="Reintentar").click()
    page.get_by_text("Profesional sintético de QA A").first.wait_for()
    report["errores_js"] = report["errores_js"][:20]
    browser.close()

(out / "resultado.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"aprobadas": sum(c["ok"] for c in report["checks"]), "fallidas": sum(not c["ok"] for c in report["checks"])}))
