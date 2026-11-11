"""Smoke local de sesión, roles y errores con respuestas sintéticas, sin escrituras reales."""
import argparse
import base64
import json
import time
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--base", default="http://127.0.0.1:3181")
args = parser.parse_args()

def sesion(rol):
    codificar = lambda dato: base64.urlsafe_b64encode(json.dumps(dato).encode()).decode().rstrip("=")
    usuario = {"id": "00000000-0000-4000-8000-000000000001", "email": "qa@example.test",
               "aud": "authenticated", "app_metadata": {"dentaia": {"version": 1, "estado": "activo", "roles": [rol]}},
               "user_metadata": {"full_name": "Cuenta sintética QA"}}
    expira = int(time.time()) + 3600
    token = codificar({"alg": "HS256", "typ": "JWT"}) + "." + codificar({"sub": usuario["id"], "exp": expira, "role": "authenticated"}) + ".fixture"
    return {"access_token": token, "refresh_token": "fixture", "token_type": "bearer", "expires_at": expira,
            "expires_in": 3600, "user": usuario}

def responder_supabase(route, usuario=None, fallo=False):
    url = route.request.url
    if "/auth/v1/user" in url:
        if fallo:
            route.fulfill(status=503, content_type="application/json", body='{"message":"servicio no disponible"}')
        else:
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"user": usuario} if usuario else {"user": None}))
    else:
        route.fulfill(status=503 if fallo else 200, content_type="application/json", body="[]")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width in (320, 390, 768, 1024, 1440):
        context = browser.new_context(viewport={"width": width, "height": 900}, service_workers="block")
        context.route("https://ux-fixtures.supabase.co/**", lambda route: responder_supabase(route))
        page = context.new_page()
        for path in ("/panel", "/profesional", "/solicitudes", "/fotografias"):
            page.goto(args.base + path, wait_until="domcontentloaded", timeout=30000)
            page.get_by_role("heading", name="Inicia sesión para continuar").wait_for(timeout=15000)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (width, path)
        page.goto(args.base + "/directorio", wait_until="domcontentloaded", timeout=30000)
        page.get_by_text("Por ahora no hay odontólogos activos ni ubicaciones publicadas").wait_for(timeout=15000)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (width, "/directorio")
        context.close()
        print(f"{width}px: acceso sin sesión, directorio vacío y ancho correctos")

    paciente = sesion("paciente")
    context = browser.new_context(viewport={"width": 390, "height": 900}, service_workers="block")
    context.add_init_script("localStorage.setItem('sb-ux-fixtures-auth-token'," + json.dumps(json.dumps(paciente)) + ");")
    context.route("https://ux-fixtures.supabase.co/**", lambda route: responder_supabase(route, paciente["user"]))
    page = context.new_page()
    page.goto(args.base + "/profesional", wait_until="domcontentloaded")
    page.get_by_role("heading", name="Acceso restringido").wait_for()
    page.goto(args.base + "/fotografias", wait_until="domcontentloaded")
    page.get_by_role("heading", name="Mis fotografías dentales").wait_for()
    page.get_by_text("Aún no hay fotografías guardadas.", exact=False).wait_for()
    context.close()
    print("Rol permitido, rol no autorizado y estado vacío correctos")

    context = browser.new_context(viewport={"width": 390, "height": 900}, service_workers="block")
    context.add_init_script("localStorage.setItem('sb-ux-fixtures-auth-token'," + json.dumps(json.dumps(paciente)) + ");")
    context.route("https://ux-fixtures.supabase.co/**", lambda route: responder_supabase(route, fallo=True))
    page = context.new_page()
    page.goto(args.base + "/panel", wait_until="domcontentloaded")
    page.get_by_role("heading", name="No pudimos validar la sesión").wait_for()
    page.get_by_role("button", name="Volver a comprobar").wait_for()
    context.close()
    print("Error de sesión y reintento visibles")

    context = browser.new_context(viewport={"width": 390, "height": 900}, service_workers="block")
    context.route("https://ux-fixtures.supabase.co/**", lambda route: responder_supabase(route, fallo=True))
    page = context.new_page()
    page.goto(args.base + "/directorio", wait_until="domcontentloaded")
    page.get_by_role("alert").get_by_text("No pudimos cargar el directorio.").wait_for()
    page.get_by_role("button", name="Reintentar").focus()
    assert page.evaluate("document.activeElement.tagName") == "BUTTON"
    context.close()
    print("Error de servicio del directorio y control de teclado correctos")
    browser.close()
