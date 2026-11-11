"""QA visual del flujo de fotografías con sesión y respuestas sintéticas."""
import argparse
import base64
import json
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument("--fase", choices=("antes", "despues"), required=True)
p.add_argument("--output", type=Path, required=True)
p.add_argument("--browser", required=True)
p.add_argument("--base", default="http://127.0.0.1:3180")
args = p.parse_args()
out = args.output / args.fase
out.mkdir(parents=True, exist_ok=True)
uid = "00000000-0000-4000-8000-000000000001"
user = {"id": uid, "email": "fixture@example.test", "aud": "authenticated",
        "app_metadata": {"dentaia": {"version": 1, "estado": "activo", "roles": ["paciente"]}},
        "user_metadata": {"full_name": "Paciente sintético de QA"}}
enc = lambda x: base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip("=")
token = enc({"alg": "HS256", "typ": "JWT"}) + "." + enc({"sub": uid, "exp": int(time.time()) + 3600}) + ".fixture"
session = {"access_token": token, "refresh_token": "fixture-refresh", "token_type": "bearer",
           "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": user}
report = {"entorno": "Chromium local; sesión, API e imágenes sintéticas", "anchos": [], "casos": []}

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path=args.browser)
    context = browser.new_context(viewport={"width": 1440, "height": 900}, service_workers="block", reduced_motion="reduce")
    context.add_init_script("localStorage.setItem('sb-ux-fixtures-auth-token'," + json.dumps(json.dumps(session)) + ");")
    flags = {"consent": False, "photos": [], "fail": False, "mutations": []}

    def intercept(route):
        req = route.request
        url = urlparse(req.url)
        if url.hostname == "ux-fixtures.supabase.co":
            path = url.path
            if path == "/auth/v1/user":
                body = user
            elif path == "/rest/v1/patient_consents":
                if req.method == "POST":
                    flags["mutations"].append("consent")
                    flags["consent"] = True
                    body = {"id": uid}
                elif req.method == "PATCH":
                    flags["mutations"].append("revoke")
                    flags["consent"] = False
                    body = []
                else:
                    body = {"id": uid} if flags["consent"] else None
            elif path == "/rest/v1/dental_photos":
                if req.method == "POST":
                    flags["mutations"].append("photo")
                    submitted = json.loads(req.post_data or "{}")
                    body = {"id": "00000000-0000-4000-8000-000000000002", "consent_id": uid,
                            "object_path": submitted.get("object_path", ""), "original_filename": submitted.get("original_filename", "prueba-sintetica.png"),
                            "mime_type": "image/png", "size_bytes": 68, "created_at": "2026-01-01T00:00:00Z"}
                    flags["photos"].insert(0, body)
                elif req.method == "DELETE":
                    flags["mutations"].append("delete")
                    body = {"id": flags["photos"][0]["id"]} if flags["photos"] else None
                    flags["photos"].clear()
                elif "bucket_id" in url.query:
                    body = {**flags["photos"][0], "user_id": uid, "bucket_id": "dental-photos"} if flags["photos"] else None
                else:
                    body = flags["photos"]
            elif path.startswith("/storage/v1/object/"):
                flags["mutations"].append("storage")
                route.fulfill(status=200, content_type="application/json", body=json.dumps([] if req.method == "DELETE" or "/list/" in path else {"Key": "synthetic/photo.png"}))
                return
            else:
                body = []
            route.fulfill(status=503 if flags["fail"] and path.startswith("/rest/v1/") else 200, content_type="application/json",
                          headers={"Content-Range": "*/0"}, body=json.dumps(body))
        elif url.hostname == "127.0.0.1":
            route.continue_()
        else:
            route.abort()

    context.route("**/*", intercept)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    def check(name, action):
        try:
            action()
            report["casos"].append({"nombre": name, "aprobado": True})
            print("PASS", name, flush=True)
        except Exception as exc:
            report["casos"].append({"nombre": name, "aprobado": False, "detalle": str(exc)[:500]})
            print("FAIL", name, str(exc)[:120], flush=True)

    for width in (320, 390, 768, 1024, 1440):
        page.set_viewport_size({"width": width, "height": 900})
        page.goto(args.base + "/fotografias", wait_until="domcontentloaded")
        page.get_by_role("heading", name="Mis fotografías dentales").wait_for(timeout=30000)
        page.add_style_tag(content="nextjs-portal{display:none!important}")
        page.screenshot(path=str(out / f"fotografias-{width}.png"))
        overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
        report["anchos"].append({"ancho": width, "desbordamiento": overflow})
        check(f"Sin desbordamiento a {width}px", lambda o=overflow: None if not o else (_ for _ in ()).throw(AssertionError("horizontal")))

    if args.fase == "despues":
        page.set_viewport_size({"width": 390, "height": 900})
        page.goto(args.base + "/fotografias", wait_until="domcontentloaded")
        page.get_by_role("heading", name="Tu permiso para guardar imágenes").wait_for()
        check("Consentimiento no premarcado", lambda: (
            None if not page.get_by_role("checkbox").is_checked() and page.get_by_role("button", name="Dar consentimiento").is_disabled()
            else (_ for _ in ()).throw(AssertionError("consentimiento"))
        ))
        page.get_by_role("checkbox").check()
        page.get_by_role("button", name="Dar consentimiento").click()
        check("Consentimiento registrado antes de elegir imagen", lambda: page.get_by_role("heading", name="Prepara una imagen clara").wait_for())
        page.get_by_role("button", name="Continuar a elegir imagen").click()
        def camera_fallback():
            with page.expect_file_chooser(timeout=5000):
                page.get_by_role("button", name="Tomar fotografía").click()
        check("Control de cámara abre selección del navegador", camera_fallback)
        check("Sin carga automática", lambda: (
            None if "storage" not in flags["mutations"] else (_ for _ in ()).throw(AssertionError("subida prematura"))
        ))
        page.get_by_label("Seleccionar fotografía de prueba").set_input_files({"name": "invalido.txt", "mimeType": "text/plain", "buffer": b"texto"})
        check("Archivo inválido rechazado", lambda: page.get_by_role("alert").get_by_text("Elige una imagen JPG, PNG o WebP.").wait_for())
        tile = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082")
        page.get_by_label("Seleccionar fotografía de prueba").set_input_files({"name": "prueba-sintetica.png", "mimeType": "image/png", "buffer": tile})
        check("Vista previa local sin subir", lambda: (
            page.get_by_role("heading", name="Revisa antes de guardar").wait_for(),
            None if "storage" not in flags["mutations"] else (_ for _ in ()).throw(AssertionError("subida prematura"))
        ))
        page.get_by_role("button", name="Descartar o reemplazar").click()
        check("Cancelación local", lambda: (
            page.get_by_role("heading", name="Elige una fotografía").wait_for(),
            None if "storage" not in flags["mutations"] else (_ for _ in ()).throw(AssertionError("subida al descartar"))
        ))
        page.get_by_label("Seleccionar fotografía de prueba").set_input_files({"name": "prueba-sintetica.png", "mimeType": "image/png", "buffer": tile})
        page.get_by_role("button", name="Subir fotografía").click()
        check("Confirmación tras guardado", lambda: (
            page.get_by_role("heading", name="Fotografía guardada").wait_for(timeout=15000),
            None if "storage" in flags["mutations"] and "photo" in flags["mutations"] else (_ for _ in ()).throw(AssertionError("guardado incompleto"))
        ))
        page.once("dialog", lambda dialog: dialog.accept())
        page.get_by_role("button", name="Eliminar").click()
        check("Eliminación de fotografía guardada", lambda: (
            page.get_by_text("Fotografía eliminada correctamente.").wait_for(timeout=15000),
            None if "delete" in flags["mutations"] else (_ for _ in ()).throw(AssertionError("sin borrado"))
        ))
        flags["fail"] = True
        page.goto(args.base + "/fotografias", wait_until="domcontentloaded")
        check("Error de carga recuperable", lambda: (
            page.get_by_role("alert").wait_for(timeout=15000),
            page.get_by_role("button", name="Volver a cargar").wait_for()
        ))
        flags["fail"] = False
        page.get_by_role("button", name="Volver a cargar").click()
        check("Reintento de carga", lambda: page.get_by_role("heading", name="Prepara una imagen clara").wait_for(timeout=15000))
        def keyboard_path():
            button = page.get_by_role("button", name="Continuar a elegir imagen")
            button.focus()
            assert button.evaluate("el => el === document.activeElement")
            page.keyboard.press("Enter")
            page.get_by_role("heading", name="Elige una fotografía").wait_for()
        check("Navegación por teclado", keyboard_path)
        page.get_by_role("button", name="Administrar permiso").click()
        page.once("dialog", lambda dialog: dialog.accept())
        page.get_by_role("button", name="Revocar consentimiento").click()
        check("Revocación conserva galería y bloquea cargas", lambda: (
            page.get_by_text("Consentimiento revocado.", exact=False).wait_for(timeout=15000),
            page.get_by_role("heading", name="Mis fotografías", exact=True).wait_for(),
            None if not flags["consent"] and "revoke" in flags["mutations"] else (_ for _ in ()).throw(AssertionError("revocación"))
        ))
    report["errores_js"] = errors[:20]
    browser.close()

(out / "resultado.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"aprobadas": sum(c["aprobado"] for c in report["casos"]), "fallidas": sum(not c["aprobado"] for c in report["casos"])}))
if any(not caso["aprobado"] for caso in report["casos"]) or report["errores_js"] or any(item["desbordamiento"] for item in report["anchos"]):
    raise SystemExit(1)
