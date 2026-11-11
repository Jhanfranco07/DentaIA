"""Comprueba el portal con sesión y respuestas clínicas sintéticas en Next local."""
import argparse
import base64
import json
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

BASE = "http://127.0.0.1:3180"
WIDTHS = (320, 390, 768, 1024, 1440)


def uid(number):
    return f"00000000-0000-4000-8000-{number:012d}"


def session(role):
    def encode(payload):
        return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")

    expires = int(time.time()) + 3600
    user = {
        "id": uid(1), "email": "fixture@example.test", "aud": "authenticated",
        "app_metadata": {"dentaia": {"version": 1, "estado": "activo", "roles": [role]}},
        "user_metadata": {"full_name": "Cuenta sintética de QA"},
    }
    token = encode({"alg": "HS256", "typ": "JWT"}) + "." + encode({
        "sub": uid(1), "exp": expires, "role": "authenticated",
    }) + ".fixture"
    return {"access_token": token, "refresh_token": "fixture", "token_type": "bearer",
            "expires_at": expires, "expires_in": 3600, "user": user}


def portal(browser, role=None, requests_status=200, history_status=None):
    context = browser.new_context(service_workers="block", reduced_motion="reduce")
    profile = session(role)
    reads = []
    errors = []
    if role:
        context.add_init_script(
            'localStorage.setItem("sb-ux-fixtures-auth-token",'
            + json.dumps(json.dumps(profile)) + ');'
        )

    def intercept(route):
        url = urlparse(route.request.url)
        path = url.path
        if url.hostname == "ux-fixtures.supabase.co" and path == "/auth/v1/user":
            route.fulfill(json=profile["user"])
        elif url.hostname != "127.0.0.1":
            route.abort()
        elif path.startswith("/api/professional/"):
            reads.append(path)
            assert route.request.method == "GET"
            if path.endswith("/me"):
                kind = "professional"
                data = {"professionalId": uid(1), "dentistId": uid(2), "contexts": [
                    {"membershipId": uid(3), "clinicId": uid(4), "clinicName": "Clínica sintética de QA",
                     "validFrom": "2026-01-01T00:00:00Z", "validUntil": None},
                ]}
            else:
                kind = "patients" if path.endswith("patients") else "requests"
                if kind == "requests" and requests_status != 200:
                    route.fulfill(status=requests_status, json={"ok": False, "code": "SERVICE_UNAVAILABLE", "requestId": uid(99)})
                    return
                items = [] if kind == "patients" else [
                    {"id": uid(10 + index), "status": status, "createdAt": "2026-11-01T15:00:00Z",
                     "preferredDate": "2026-11-20", "preferredTime": preferred_time, "isDemo": True}
                    for index, (status, preferred_time) in enumerate([
                        ("requested", "10:30:00"), ("cancelled", None),
                    ])
                ]
                if kind == "patients" and history_status is not None:
                    items = [{"patientId": uid(7)}]
                data = {"membershipId": uid(3), "professionalId": uid(1), "items": items}
            route.fulfill(json={"ok": True, "status": 200, "environment": "qa_local",
                                "requestId": uid(99), "apiVersion": "clinical.workspace.v1",
                                "kind": kind, "data": data, "nextAfterId": None})
        elif path.startswith("/api/clinical/"):
            reads.append(path)
            assert route.request.method == "GET"
            assert path == f"/api/clinical/patients/{uid(7)}/history"
            assert f"membershipId={uid(3)}" in url.query
            if history_status == 403:
                route.fulfill(status=403, json={"ok": False, "code": "ACCESS_DENIED", "requestId": uid(99)})
                return
            route.fulfill(json={
                "ok": True, "apiVersion": "clinical.v1", "origen": "supabase",
                "environment": "qa_local", "estado": "sin_datos", "requestId": uid(99),
                "caso": {"patientId": uid(7), "clinicContext": uid(4), "professionalContext": uid(1)},
                "entries": [], "nextCursor": None,
            })
        else:
            route.continue_()

    context.route("**/*", intercept)
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    return context, page, reads, errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--baseline", action="store_true")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        results = []
        context, page, _, errors = portal(browser, "odontologo")
        for width in WIDTHS:
            page.set_viewport_size({"width": width, "height": 900})
            page.goto(BASE + "/profesional")
            expect(page.get_by_role("heading", name="Panel del odontólogo")).to_be_visible(timeout=30000)
            expect(page.get_by_text("Solicitada", exact=True)).to_be_visible()
            expect(page.get_by_text("Cancelada", exact=True)).to_be_visible()
            expect(page.get_by_text("No hay pacientes autorizados", exact=False)).to_be_visible()
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            page.screenshot(path=args.output / f"profesional-{width}.png", full_page=True)
            results.append(f"Portal profesional sin desbordamiento a {width} px")

        if not args.baseline:
            expect(page.get_by_role("link", name="Ver perfil en el directorio")).to_have_attribute(
                "href", "/directorio/" + uid(2)
            )
            results.append("Perfil vinculado al directorio")
            page.set_viewport_size({"width": 390, "height": 700})
            menu = page.get_by_role("button", name="Abrir navegación")
            menu.focus()
            page.keyboard.press("Enter")
            expect(page.locator("#navegacion-portal").get_by_role("button", name="Cerrar navegación")).to_be_focused()
            page.keyboard.press("Escape")
            expect(menu).to_be_focused()
            page.keyboard.press("Enter")
            page.get_by_role("link", name="Pacientes e historial", exact=True).press("Enter")
            expect(page.get_by_role("region", name="Pacientes autorizados")).to_be_focused()
            expect(page).to_have_url(BASE + "/profesional#historial-clinico")
            results.append("Menú móvil operable por teclado y foco en destino")
        assert not errors, errors
        context.close()

        for role, heading in [(None, "Inicia sesión para continuar"), ("paciente", "Acceso restringido")]:
            context, page, reads, errors = portal(browser, role)
            page.goto(BASE + "/profesional")
            expect(page.get_by_role("heading", name=heading)).to_be_visible()
            expect(page.get_by_role("heading", name="Panel del odontólogo")).to_have_count(0)
            assert not reads and not errors, (reads, errors)
            context.close()
            results.append(f"Acceso bloqueado sin lecturas clínicas: {role or 'sin sesión'}")

        context, page, _, errors = portal(browser, "odontologo", requests_status=503)
        page.goto(BASE + "/profesional")
        expect(page.locator("#solicitudes-profesionales").get_by_role("alert")).to_be_visible()
        assert not errors, errors
        results.append("Error de solicitudes anunciado en su sección")
        context.close()

        for status, message in [
            (200, "No hay atenciones autorizadas para este paciente y contexto clínico."),
            (403, "Acceso restringido."),
        ]:
            context, page, reads, errors = portal(browser, "odontologo", history_status=status)
            page.goto(BASE + "/profesional")
            patient = page.get_by_role("combobox", name="Paciente autorizado")
            expect(patient).to_be_enabled()
            assert not any(path.startswith("/api/clinical/") for path in reads)
            patient.select_option(uid(7))
            history = page.get_by_role("region", name="Pacientes autorizados")
            expect(history.get_by_text(message, exact=True)).to_be_visible()
            if status == 403:
                expect(patient).to_have_value("")
                expect(patient.get_by_role("option", name="Paciente autorizado 1")).to_have_count(0)
            assert not errors, errors
            context.close()
            results.append(f"Historial sintético: respuesta {status} tras seleccionar paciente")

        report = {"chromium": browser.version, "entorno": "local sintético", "aprobadas": results}
        (args.output / "resultado.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"{len(results)} comprobaciones aprobadas")


if __name__ == "__main__":
    main()
