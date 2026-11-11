# Resultados comprobados · 11/11/2026

## Integración y línea base

- PR #40 fusionado a `main` con merge commit `8347e9ed5720ac48ea9e28beec5226208d9a8833`; `develop` avanzó al mismo commit por fast-forward. Pipeline posterior de `main`: **success** (run `43043320067`).
- Rama de QA `test/validacion-integral-sprint6` creada desde ese commit. Sin cambios en Auth, RLS, MFA, backend clínico, IA, Vercel o workflows.

## Ejecuciones de este ciclo

| Capa | Comando/entorno | Resultado | Qué acredita |
|---|---|---|---|
| Tipos | `npm run typecheck` | Aprobado | Contratos TypeScript estáticos |
| Compilación | `npm run build` | Aprobado dos veces | Bundles y rutas Next.js compilables |
| Node | `node --experimental-strip-types --test <59 archivos .test.mjs>` | **457/457** aprobadas | Lógica aislada, guards y adaptadores simulados |
| Dependencias | `npm audit --audit-level=high` | 0 vulnerabilidades reportadas | Árbol npm actual, no infraestructura remota |
| Playwright paciente | Copia temporal de `qa-ux-paciente.py` apuntando a puerto 3181 | 5 anchos, 0 desbordamientos, 0 errores JS | UI con sesión/API sintéticas; servidor clínico no configurado devolvió 404 esperado fuera del fixture |
| Playwright odontólogo | Copia temporal de `qa-ux-odontologo.py` apuntando a puerto 3181 | 12 comprobaciones aprobadas | Panel y estados con sesión/respuestas clínicas sintéticas |
| Playwright directorio | Evidencia de PR #40, `scripts/test-directorio-demo-visual.py` | 5 anchos, 20 perfiles, filtros, ficha y marcador | UI con fixtures; no confirma carga remota |
| Playwright fotografías | `qa-ux-fotografias.py` en servidor local | **Inconcluso**: error de captura; reintento agotó `page.goto` | No acredita consentimiento ni Storage extremo a extremo |
| Smoke adicional | `scripts/qa-validacion-integral.py` | **No completado**: timeout en navegación del servidor dev | No se contabiliza como aprobación de denegación/error |
| PostgreSQL | Contenedor aislado PostgreSQL 16, migración existente, seed dos veces, cleanup | 20/20 slugs únicos tras dos cargas; `anon` lee 21 filas demo publicadas (20 nuevas + 1 anterior) y no tiene `INSERT`; cleanup `DELETE 20`, final 0 nuevas y 1 anterior | SQL real local, RLS/grants de la migración aislada; no refleja esquema remoto completo |

El contenedor de prueba se elimina al finalizar esta validación. No se modificaron pacientes, profesionales ni cuentas reales. Las pruebas de roles en Node y Playwright usan usuarios sintéticos; no hay credenciales remotas autorizadas para confirmar Auth/MFA/Storage reales. Las capturas previas del directorio están en `docs/directorio-demo/evidencia/`.

## Pendiente para aceptación funcional

En un proyecto QA separado: registro/login/correo, tres roles con cuentas autorizadas, AAL2, permisos de API/RLS, consentimientos y Storage privado, flujo profesional con historial de pacientes sintéticos y directorio con seed. Registrar resultados por caso con identificador del entorno y fecha, sin secretos ni datos personales. Ver [PLAN_VALIDACION_REMOTA.md](PLAN_VALIDACION_REMOTA.md).
