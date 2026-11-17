"""Smoke visual local de /paciente/rutinas con Supabase sintético interceptado.

Requiere Playwright Python y Chrome/Chromium locales. Solo permite Next en loopback,
intercepta ux-fixtures.supabase.co y aborta cualquier otro host externo. No prueba RLS.
"""
import argparse
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright


parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--browser", required=True, help="Ruta local de Chrome/Chromium")
parser.add_argument("--base-url", default="http://127.0.0.1:3180")
parser.add_argument("--scenario", choices=("contenido", "vacio", "error"), default="contenido")
args = parser.parse_args()

base = urlparse(args.base_url)
if base.scheme != "http" or base.hostname not in ("127.0.0.1", "localhost", "::1"):
    raise SystemExit("Seguridad: --base-url debe ser HTTP y loopback")

args.output.mkdir(parents=True, exist_ok=True)
hoy = datetime.now(ZoneInfo("America/Lima")).date()
ayer = hoy - timedelta(days=1)
usuario_id = "91000000-0000-4000-8000-000000000001"
plan_id = "92000000-0000-4000-8000-000000000001"
actividades = [
    {"id": "93000000-0000-4000-8000-000000000001", "plan_id": plan_id,
     "activity_key": "cepillado-manana", "title": "Cepillado de la mañana",
     "description": "Cepilla suavemente tus dientes con pasta fluorada.", "time_of_day": "morning", "sort_order": 1},
    {"id": "93000000-0000-4000-8000-000000000002", "plan_id": plan_id,
     "activity_key": "limpieza-interdental", "title": "Limpieza interdental",
     "description": "Limpia con cuidado entre los dientes.", "time_of_day": "daytime", "sort_order": 2},
    {"id": "93000000-0000-4000-8000-000000000003", "plan_id": plan_id,
     "activity_key": "cepillado-noche", "title": "Cepillado de la noche",
     "description": "Incluye un cepillado suave antes de terminar el día.", "time_of_day": "evening", "sort_order": 3},
]
planes = [] if args.scenario == "vacio" else [{
    "id": plan_id, "plan_key": "general-preventive", "version": 1,
    "title": "Rutina general preventiva", "description": "Fixture sintético de hábitos preventivos.",
    "valid_from": "2026-01-01", "valid_until": None, "published": True,
    "created_at": "2026-01-01T00:00:00Z",
}]
marcas = [] if args.scenario == "vacio" else [
    {"id": "94000000-0000-4000-8000-000000000001", "patient_id": usuario_id,
     "plan_id": plan_id, "activity_id": actividades[0]["id"], "completion_date": hoy.isoformat(),
     "completed_at": datetime.now(ZoneInfo("UTC")).isoformat()},
    {"id": "94000000-0000-4000-8000-000000000002", "patient_id": usuario_id,
     "plan_id": plan_id, "activity_id": actividades[2]["id"], "completion_date": ayer.isoformat(),
     "completed_at": (datetime.now(ZoneInfo("UTC")) - timedelta(days=1)).isoformat()},
]
fallo_inicial = args.scenario == "error"
usuario = {
    "id": usuario_id, "email": "di172-paciente-a@example.test", "aud": "authenticated",
    "confirmed_at": "2026-01-01T00:00:00Z",
    "app_metadata": {"dentaia": {"version": "1", "estado": "activo", "roles": ["paciente"]}},
    "user_metadata": {"full_name": "Paciente sintético"},
}
sesion = {
    "access_token": "header.payload.fixture", "refresh_token": "fixture-refresh-not-a-secret",
    "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600,
    "user": usuario,
}
errores_js = []
resultados = []


def fulfill(route, status=200, body=None, count=None):
    route.fulfill(status=status, content_type="application/json",
                  headers={"Content-Range": f"*/{count if count is not None else len(body or [])}"},
                  body=json.dumps(body if body is not None else {}, ensure_ascii=False))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=args.browser)
    context = browser.new_context(viewport={"width": 1440, "height": 1000},
                                  service_workers="block", reduced_motion="reduce")
    context.add_init_script(
        "localStorage.setItem('sb-ux-fixtures-auth-token'," + json.dumps(json.dumps(sesion)) + ");"
    )

    def intercept(route):
        global fallo_inicial
        request = route.request
        url = urlparse(request.url)
        if url.hostname == "ux-fixtures.supabase.co":
            if url.path == "/auth/v1/user":
                fulfill(route, body=usuario)
                return
            if not url.path.startswith("/rest/v1/"):
                fulfill(route, body={})
                return
            table = url.path.rsplit("/", 1)[-1]
            query = parse_qs(url.query)
            if table == "oral_care_routine_plans":
                time.sleep(0.15)
                if fallo_inicial:
                    fallo_inicial = False
                    fulfill(route, status=503, body={"code": "PGRST000", "message": "fixture-error"})
                else:
                    fulfill(route, body=planes, count=len(planes))
            elif table == "oral_care_routine_activities":
                body = actividades if planes else []
                plan_filter = query.get("plan_id", [""])[0].removeprefix("eq.")
                if plan_filter:
                    body = [activity for activity in body if activity["plan_id"] == plan_filter]
                fulfill(route, body=body, count=len(body))
            elif table == "patient_routine_completions" and request.method == "GET":
                body = [mark.copy() for mark in marcas]
                for key in ("patient_id", "plan_id", "completion_date"):
                    value = query.get(key, [""])[0]
                    if value.startswith("eq."):
                        body = [mark for mark in body if str(mark.get(key)) == value[3:]]
                fulfill(route, body=body, count=len(body))
            elif table == "patient_routine_completions" and request.method == "POST":
                payload = request.post_data_json
                for item in payload if isinstance(payload, list) else [payload]:
                    key = (usuario_id, item["activity_id"], item["completion_date"])
                    if not any((m["patient_id"], m["activity_id"], m["completion_date"]) == key for m in marcas):
                        marcas.append({"id": f"fixture-{len(marcas)}", "patient_id": usuario_id,
                                       "plan_id": item["plan_id"], "activity_id": item["activity_id"],
                                       "completion_date": item["completion_date"],
                                       "completed_at": datetime.now(ZoneInfo("UTC")).isoformat()})
                route.fulfill(status=201, body={})
            elif table == "patient_routine_completions" and request.method == "DELETE":
                before = len(marcas)
                for key in ("patient_id", "plan_id", "activity_id", "completion_date"):
                    value = query.get(key, [""])[0]
                    if value.startswith("eq."):
                        expected = value[3:]
                        marcas[:] = [mark for mark in marcas if str(mark.get(key)) != expected]
                route.fulfill(status=204, body="")
            else:
                fulfill(route, body=[])
        elif url.hostname in ("127.0.0.1", "localhost", "::1"):
            route.continue_()
        else:
            route.abort()

    context.route("**/*", intercept)
    page = context.new_page()
    page.on("pageerror", lambda error: errores_js.append(str(error)))

    if args.scenario == "contenido":
        page.goto(f"{args.base_url}/panel", wait_until="domcontentloaded")
        menu = page.get_by_role("button", name="Abrir navegación")
        if menu.count() and menu.is_visible():
            menu.focus()
            page.keyboard.press("Enter")
        page.get_by_role("link", name="Mis rutinas").click()

    if args.scenario == "error":
        page.goto(f"{args.base_url}/paciente/rutinas", wait_until="domcontentloaded")
        page.get_by_role("alert").wait_for(timeout=30000)
        page.get_by_role("button", name="Volver a cargar").click()

    for width in (320, 390, 768, 1024, 1440):
        page.set_viewport_size({"width": width, "height": 900})
        if args.scenario == "contenido" and width == 390:
            page.goto(f"{args.base_url}/panel", wait_until="domcontentloaded")
            mobile_menu = page.get_by_role("button", name="Abrir navegación")
            mobile_menu.wait_for(state="visible", timeout=30000)
            mobile_menu.focus()
            page.keyboard.press("Enter")
            page.get_by_role("button", name="Cerrar navegación").wait_for(state="visible", timeout=5000)
            page.get_by_role("link", name="Mis rutinas").click()
            page.get_by_role("heading", name="Rutina general preventiva").wait_for(timeout=30000)
        page.goto(f"{args.base_url}/paciente/rutinas", wait_until="domcontentloaded")
        if args.scenario == "contenido":
            page.get_by_text("Cargando tus actividades…").wait_for(timeout=5000)
            page.get_by_role("heading", name="Rutina general preventiva").wait_for(timeout=30000)
            page.get_by_text("1 de 3 actividades · 33%", exact=True).wait_for(timeout=30000)
            checks = page.get_by_role("checkbox")
            assert checks.count() == 3, "Deben aparecer las tres actividades del fixture"
            if width == 390:
                checkbox_label = page.get_by_role("checkbox").first.locator("xpath=ancestor::label")
                label_box = checkbox_label.bounding_box()
                assert label_box and label_box["height"] >= 44, "La fila de actividad debe ofrecer un área táctil de 44px"
                target = page.get_by_role("checkbox", name="Marcar: Limpieza interdental")
                target.check()
                page.get_by_text("2 de 3 actividades · 67%", exact=True).wait_for(timeout=30000)
                page.get_by_role("checkbox", name="Desmarcar: Limpieza interdental").uncheck()
                page.get_by_text("1 de 3 actividades · 33%", exact=True).wait_for(timeout=30000)
                panel_historial = page.locator("aside")
                assert panel_historial.locator("li button").count() >= 2, "Debe listar hoy y un día histórico"
                panel_historial.locator("li button").last.click()
                assert page.get_by_role("status").filter(has_text="solo lectura").count() == 1
                assert page.get_by_role("checkbox").first.is_disabled()
                page.get_by_label("Elegir fecha de rutina").fill(hoy.isoformat())
                keyboard_check = page.get_by_role("checkbox", name="Marcar: Limpieza interdental")
                keyboard_check.focus()
                page.keyboard.press("Space")
                page.get_by_text("2 de 3 actividades · 67%", exact=True).wait_for(timeout=30000)
                page.keyboard.press("Space")
                page.get_by_text("1 de 3 actividades · 33%", exact=True).wait_for(timeout=30000)
        elif args.scenario == "vacio":
            page.get_by_text("No hay una rutina disponible para esta fecha.").wait_for(timeout=30000)
            page.get_by_text("Todavía no hay actividades registradas.").wait_for(timeout=30000)
        else:
            page.get_by_role("heading", name="Rutina general preventiva").wait_for(timeout=30000)

        overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
        assert not overflow, f"Desbordamiento horizontal a {width}px"
        page.screenshot(path=str(args.output / f"rutinas-{args.scenario}-{width}-claro.png"), full_page=True)
        resultados.append({"scenario": args.scenario, "width": width, "theme": "claro", "overflow": overflow})

        if width in (390, 1440):
            theme = page.get_by_role("button", name="Activar modo oscuro morado")
            theme.click()
            assert page.locator('[data-area="Paciente"][data-tema="oscuro"]').count() == 1
            page.screenshot(path=str(args.output / f"rutinas-{args.scenario}-{width}-oscuro.png"), full_page=True)
            page.get_by_role("button", name="Activar modo claro celeste").click()

    assert not errores_js, errores_js
    browser.close()

(args.output / "resultado.json").write_text(
    json.dumps({"fixture": "sintético; APIs Supabase interceptadas; tráfico externo bloqueado",
                "escenario": args.scenario, "resultados": resultados, "errores_js": errores_js},
               ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"escenario": args.scenario, "anchos": len(resultados),
                  "desbordamientos": sum(r["overflow"] for r in resultados),
                  "errores_js": len(errores_js)}))
