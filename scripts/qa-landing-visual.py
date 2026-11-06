"""Chromium sobre build local. Sin credenciales ni escrituras remotas.
Ejecutar con servidor en 127.0.0.1:3181 y --output DIR.
"""
import argparse, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
results, errors, failed_requests = [], [], []
BASE = 'http://127.0.0.1:3181'

def check(name, fn):
    try:
        fn()
        results.append({'nombre': name, 'aprobada': True})
        print('PASS', name, flush=True)
    except Exception as error:
        results.append({'nombre': name, 'aprobada': False, 'detalle': str(error)[:1600]})
        print('FAIL', name, str(error)[:300], flush=True)

def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium')
    context = browser.new_context(reduced_motion='reduce', service_workers='block')
    context.route('**/*.supabase.co/**', lambda route: route.abort())
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failed_requests.append({'url':response.url,'status':response.status}) if response.status >= 400 and '/_next/' in response.url else None)
    page.set_default_timeout(15000)
    def responsive(width):
        page.set_viewport_size({'width':width, 'height':950})
        response = page.goto(BASE + '/')
        assert response.status == 200
        expect(page.locator('h1')).to_have_count(1)
        expect(page.locator('main')).to_have_count(1)
        photo = page.locator('[data-active-slide] img').first
        expect(photo).to_be_visible()
        page.wait_for_function('document.querySelector("[data-active-slide] img").naturalWidth > 0')
        no_overflow(page)
        tag = page.locator('a[href="/analisis"]').filter(has_text='Conoce DentaIA ahora')
        expect(tag).to_be_visible()
        h1_box, tag_box = page.locator('h1').bounding_box(), tag.bounding_box()
        assert h1_box['x'] + h1_box['width'] <= tag_box['x'] or h1_box['y'] + h1_box['height'] <= tag_box['y']
        rect = photo.bounding_box()
        assert rect['width'] >= width - 1 and rect['height'] >= 200
        if width <= 900:
            assert page.locator('h1').bounding_box()['y'] >= rect['y'] + 200
        expect(page.locator('footer')).to_be_visible()
        page.screenshot(path=str(args.output / f'landing-{width}.png'), full_page=True)
        args.output.joinpath(f'layout-{width}.json').write_text(json.dumps({'foto':rect,'titulo':h1_box,'tarjeta':tag_box}))
    for width in [360,390,768,1366,1920]:
        check(f'Responsive, fotografía, tarjeta y ausencia de desborde: {width}px',lambda width=width: responsive(width))
    def mobile_menu():
        page.set_viewport_size({'width':390,'height':950})
        page.goto(BASE + '/')
        menu = page.get_by_role('button',name='Abrir menú')
        menu.click()
        expect(page.get_by_role('button',name='Cerrar menú')).to_have_attribute('aria-expanded','true')
        page.get_by_role('navigation',name='Navegación principal').get_by_role('link',name='Cómo funciona').click()
        expect(menu).to_have_attribute('aria-expanded','false')
        expect(page.locator('#como-funciona')).to_be_in_viewport()
        menu.click()
        page.keyboard.press('Escape')
        expect(menu).to_be_focused()
    check('Menú móvil: ancla, cierre y teclado Escape',mobile_menu)
    def navigation():
        page.goto(BASE + '/')
        page.get_by_role('link',name='Comenzar ahora',exact=True).click()
        expect(page).to_have_url(BASE + '/cuenta?modo=registro')
        expect(page.get_by_role('heading',name='Crea tu cuenta',exact=True)).to_be_visible()
        page.goto(BASE + '/')
        page.get_by_role('link',name='Explorar odontólogos',exact=True).click()
        expect(page).to_have_url(BASE + '/directorio')
        no_overflow(page)
        page.goto(BASE + '/')
        page.locator('a[href="/analisis"]').filter(has_text='Conoce DentaIA ahora').click()
        expect(page).to_have_url(BASE + '/analisis')
        expect(page.get_by_role('heading',name='Inicia sesión para continuar',exact=False)).to_be_visible()
    check('CTA reales: registro, directorio y preparación protegida',navigation)
    def keyboard():
        page.goto(BASE + '/')
        page.keyboard.press('Tab')
        assert page.evaluate('document.activeElement.getAttribute("href")') == '#contenido'
        assert page.evaluate('getComputedStyle(document.activeElement).outlineStyle') != 'none'
    check('Teclado: salto al contenido y foco visible',keyboard)
    def reduced_motion():
        page.goto(BASE + '/')
        expect(page.get_by_role('button',name='Carrusel detenido por preferencia de movimiento reducido')).to_be_disabled()
        page.wait_for_timeout(6700)
        expect(page.locator('[data-active-slide]')).to_have_attribute('data-active-slide','0')
        expect(page.locator('[data-active-slide] img')).to_have_count(1)
        assert page.locator('[data-active-slide] img').evaluate('(img) => getComputedStyle(img).animationName') == 'none'
    check('Movimiento reducido: imagen fija y sin precarga del resto',reduced_motion)
    context.close()
    context = browser.new_context(viewport={'width':1366,'height':950},reduced_motion='no-preference')
    page = context.new_page()
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.add_init_script('window.lcp = 0; new PerformanceObserver(list => { for (const entry of list.getEntries()) window.lcp = entry.startTime; }).observe({type:"largest-contentful-paint", buffered:true});')
    def carousel():
        page.goto(BASE + '/')
        page.wait_for_function('document.querySelector("[data-active-slide] img").naturalWidth > 0')
        expect(page.locator('[data-active-slide] img')).to_have_count(1)
        assert page.locator('[data-active-slide] img').first.get_attribute('fetchpriority') == 'high'
        expect(page.locator('[data-active-slide]')).to_have_attribute('data-active-slide','1',timeout=12000)
        page.get_by_role('button',name='Pausar carrusel',exact=True).click()
        current = page.locator('[data-active-slide]').get_attribute('data-active-slide')
        page.wait_for_timeout(6600)
        expect(page.locator('[data-active-slide]')).to_have_attribute('data-active-slide',current)
        page.get_by_role('button',name='Reanudar carrusel',exact=True).click()
        expect(page.locator('[data-active-slide]')).to_have_attribute('data-active-slide','2',timeout=12000)
        page.emulate_media(reduced_motion='reduce')
        expect(page.get_by_role('button',name='Carrusel detenido por preferencia de movimiento reducido')).to_be_disabled()
        current = page.locator('[data-active-slide]').get_attribute('data-active-slide')
        page.wait_for_timeout(6600)
        expect(page.locator('[data-active-slide]')).to_have_attribute('data-active-slide',current)
        args.output.joinpath('performance-local.json').write_text(json.dumps(page.evaluate('({lcpMs:window.lcp, images:performance.getEntriesByType("resource").filter(x=>x.name.includes("/_next/image")).map(x=>({url:x.name,bytes:x.transferSize,durationMs:x.duration}))})'),indent=2))
    check('Carrusel: carga progresiva, rotación, pausa, reanudación y cambio de preferencia',carousel)
    def photos():
        for index in range(1,6):
            response = context.request.get(BASE + f'/hero/hero-{index}.jpg')
            assert response.status == 200 and response.headers['content-type'].startswith('image/')
            response = context.request.get(BASE + f'/_next/image?url=%2Fhero%2Fhero-{index}.jpg&w=1080&q=75')
            assert response.status == 200 and response.headers['content-type'].startswith('image/')
    check('Cinco fotografías: originales y optimizador del build',photos)
    check('Sin errores JavaScript o fallos de recursos Next en landing', lambda: (_ for _ in ()).throw(AssertionError(str(errors+failed_requests))) if errors or failed_requests else None)
    browser.close()
report = {'contexto':'Build local de producción; Chromium real; sin Supabase remoto. No es medición de campo ni aceptación de producción.','pruebas':results,'aprobadas':sum(x['aprobada'] for x in results),'fallidas':sum(not x['aprobada'] for x in results),'erroresJS':errors,'recursosFallidos':failed_requests}
args.output.joinpath('navegador.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(bool(report['fallidas']))
