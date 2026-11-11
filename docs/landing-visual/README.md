# Integración de la propuesta visual del landing

## Base y comparación

Rama `refactor/landing-experiencia-visual`, desde `main` **d6b3f89aae6ec6aa9dac4af76b6e2c1df2bd4ca8** (merge del PR #31). Se consultaron GitHub y las referencias remotas actualizadas. `develop` está en **7c0244fa247eb5f020156b71d42bddaed7a6d524**: sus cambios están incluidos en main, que añade cinco commits. El árbol de la base estaba limpio.

Se compararon los dos archivos recibidos en `landing_stephan_original.zip` con los archivos vigentes. La propuesta visual es de **Stephan**; esta integración adapta su diseño al sistema integrado y no constituye la implementación original de una historia de usuario. No modifica Jira ni la autoría o los commits anteriores.

El landing vigente está en `src/app/(public)/page.tsx`, con CSS Modules, layout público, header y footer compartidos. La referencia recibida contiene también navegación por estado local, directorio ficticio, resultados simulados y consentimiento experimental (`purpose: null`). Esa lógica no se traslada. Se mantienen las rutas reales, el contenido vigente sobre permisos/privacidad/IA y los componentes compartidos.

| Antes | Ahora |
| --- | --- |
| Hero con una fotografía lateral | Fondo fotográfico completo en escritorio, fundido suave, zoom ligero y degradados de la propuesta de Stephan |
| Fotografía lateral apilada en móvil | Franja fotográfica de 260px, texto debajo y tarjeta en el flujo, sin ocultar la fotografía ni superponer texto sobre rostros |
| Sin tarjeta comercial flotante | Tarjeta de preparación de fotografía enlazada a `/analisis`, flotante en escritorio y en flujo en móvil/tablet |
| Beneficios con iconos simples | Tarjetas numeradas con iconos y espaciado de la propuesta, conservando contenido y destinos vigentes |
| Carrusel existente sin utilizar, con cinco fondos solicitados juntos | Carrusel conectado, primera imagen prioritaria y resto progresivo, pausa/reanudación y movimiento reducido dinámico |

Se conservan las secciones de funcionamiento, privacidad, alcance de IA y CTA de cuenta. Se reutiliza el footer actual, coherente con la marca y sus advertencias clínicas. No se duplica el header, footer ni el elemento main.

## Archivos de implementación

- `src/app/(public)/page.tsx`: integración visual y enlaces vigentes.
- `src/app/(public)/home.module.css`: estilos exclusivos del landing.
- `src/components/HeroCarousel.tsx`: carga, rotación y controles.
- `src/components/hero-carousel.module.css`: estilos exclusivos del carrusel.
- `scripts/qa-landing-visual.py`: recorrido reproducible en Chromium.

`src/app/globals.css`, layouts, header/footer, autenticación, autorización, AAL2, módulos de paciente/odontólogo/administración, APIs, consentimiento, SQL/RLS y configuración permanecen sin cambios. No se modifican variables de entorno persistentes, credenciales ni Supabase.

## Fotografías y accesibilidad

Se utilizan exactamente `public/hero/hero-1.jpg` a `hero-5.jpg`, ya existentes y sin cambios de bytes. No se agregan fotografías. `next/image` genera tamaños responsivos; solamente la primera imagen lleva prioridad alta. La siguiente se monta 1,5s después de cargar la primera y las siguientes se incorporan a medida que avanza el carrusel. Si la siguiente foto no termina de cargar, se conserva la anterior.

Las fotos son decorativas (`alt=""`, contenedor oculto a tecnología de asistencia). El texto contiene toda la información funcional. El botón permite pausar/reanudar; se detiene la rotación con movimiento reducido o pestaña oculta. Se escuchan cambios de preferencia y se limpian listeners/temporizadores al desmontar. En movimiento reducido inicial se solicita solo una imagen y se desactivan zoom y fundido. El estado inicial servidor/cliente es determinista.

El degradado opaco protege el texto oscuro en escritorio; en móvil el texto queda fuera de la fotografía. Se conservan foco visible, salto al contenido, navegación por teclado y menú móvil existentes.

## Validación ejecutada

| Verificación | Resultado y alcance |
| --- | --- |
| TypeScript | `npm run typecheck`, exit 0; también después del build |
| Build | Next.js 15.5.28, exit 0; ver `evidencias/build.log` |
| Suite Node | **454 aprobadas, 0 fallidas/omitidas**, incluidos guards, AAL2 y política administrativa; ver `evidencias/unit.tap` |
| Chromium landing | **12 escenarios aprobados**, ver `evidencias/navegador.json` |
| Responsive | 360, 390, 768, 1366 y 1920px, sin desborde horizontal, foto visible, tarjeta sin tapar título, un main/h1 y footer visible; capturas adjuntas |
| Navegación | CTA a registro, directorio y preparación protegida; ancla del menú móvil, cierre y Escape; foco y salto al contenido |
| Carrusel | Rotación real, pausa, reanudación, cambio dinámico de movimiento reducido, carga progresiva; cinco JPEG y cinco respuestas del optimizador HTTP 200 |
| Administración | **8 escenarios aprobados**, script existente `qa-admin-produccion.py`, ver `evidencias/admin.json`: cuenta → panel, listado/búsqueda, responsive y denegación paciente/odontólogo/superusuario sin AAL2 |
| Diff | `git diff --check` sin errores; módulos ajenos intactos |

La suite se ejecutó con Node **24.19.0**. El primer intento bajo el sandbox informó únicamente 58 archivos y no acreditó sus casos internos; se repitió con los permisos de ejecución necesarios y se verificaron los **454 casos internos**. Una ejecución sin aislamiento también confirmó 454; no se suman como pruebas diferentes. El primer build encontró una restricción del directorio de telemetría; se desactivó la telemetría para ejecutar correctamente el build sin escribir fuera del workspace.

Las comprobaciones usan un build local y Chromium real, con URL/clave públicas **sintéticas** suministradas solo al proceso de QA, y contexto Vercel Production/main simulado para ejecutar la regresión del PR #31. Los valores no son credenciales ni configuración remota. Auth y API administrativas son fixtures interceptados: **no acreditan Supabase/MFA reales**. No se realizan escrituras remotas.

La muestra local del carrusel registró LCP **248ms** y primera imagen optimizada de aproximadamente **69KB** transferidos en escritorio. Ver `evidencias/performance-local.json`. Es una observación local con caché caliente, sin throttling; no acredita rendimiento de campo, comparación antes/después ni LCP en Vercel. El comportamiento comprobado evita solicitar las cinco fotos durante el arranque.

Para reproducir (dependencias instaladas):

```bash
node --experimental-strip-types --test --test-reporter=tap 'src/features/**/*.test.mjs'
NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=https://admin404-fixtures.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture VERCEL=1 VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=main npm run build
npm run typecheck
# En terminal independiente, con los mismos valores sintéticos del build:
NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=https://admin404-fixtures.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture VERCEL=1 VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=main npm run start -- --hostname 127.0.0.1 --port 3181
python3 scripts/qa-landing-visual.py --output /tmp/qa-landing
python3 scripts/qa-admin-produccion.py --output /tmp/qa-admin
```

## Revisión antes de producción

El PR se dirige a main, sin merge automático ni cambios en producción. Revisar el Preview en móvil/escritorio y sus fotografías antes de aprobar. El Preview de una rama distinta de develop conserva el bloqueo administrativo previsto por la política vigente; no se amplía para esta entrega. La regresión administrativa se verifica en el build local con contexto Production/main.
