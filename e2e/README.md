# Suite E2E pública de DentaIA

Guía breve de ejecución. La arquitectura, los doce casos, la cronología #418–#422 y la matriz de cobertura están en [DI-136 — Playwright y DevSecOps](../docs/qa/DI-136-playwright-devsecops.md). El [informe de seguridad](SECURITY_REPORT.md) conserva los hallazgos y decisiones de las fases anteriores.

## Estado verificado

La [ejecución DevSecOps #422](https://github.com/Jhanfranco07/DentaIA/actions/runs/45133429576) del commit `fe301faf08eac04408f8247a65e98b0fe743d656` terminó con **30/30 jobs exitosos**. En Ubuntu, Playwright pasó **12/12 en 41,1 s** y la regresión de aislamiento pasó **1/1**. `tests-playwright` es obligatorio para `tests-resumen` y el gate final de calidad. La suite cubre interfaz y estados públicos; los servicios reales están simulados.

## Ejecutar en el worktree local

Requisitos: Node 22, dependencias del sistema necesarias para Chromium, puerto local libre (`43117` por defecto) y **ningún archivo `.env` local** en la raíz. El lanzador rechaza esos archivos sin leerlos. No copiar credenciales ni conectar las pruebas a servicios remotos. Las instalaciones descargan paquetes y navegador **antes** de iniciar la suite aislada.

**Windows PowerShell** (usar `npm.cmd` si la política bloquea `npm.ps1`):

```powershell
npm.cmd ci
node node_modules/playwright/cli.js install chromium
node --test e2e/isolation/isolation.test.cjs
$env:CI = 'true'
npm.cmd run test:e2e
Remove-Item Env:CI
```

**Ubuntu bash** (secuencia equivalente al job de CI):

```bash
npm ci --include=optional
test -f node_modules/@next/swc-linux-x64-gnu/next-swc.linux-x64-gnu.node
./node_modules/.bin/playwright install --with-deps chromium
node --test e2e/isolation/*.test.cjs
CI=true npm run test:e2e
```

El CLI de Chromium procede de Playwright 1.65.1 fijado en `package-lock.json`. El hash de SWC Linux 15.5.29 se corrigió sin cambiar la versión; el job comprueba el binario antes de activar la guarda de red. Si el puerto predeterminado está ocupado, definir `E2E_PORT` con otro puerto local libre. Playwright se niega a reutilizar un servidor ajeno.

Los resultados HTML se escriben en `playwright-report/` y las capturas y trazas de fallos en `test-results/`; ambos directorios están ignorados por Git. En CI se suben como artefacto solo cuando el job falla; si faltan, `upload-artifact` también falla. No se incluyen secretos en el entorno de las pruebas.

## Alcance del aislamiento

`globalSetup` inicia Next.js en loopback con un entorno construido por lista permitida y variables ficticias de Supabase. La guarda Node bloquea intentos externos por los caminos instrumentados. Chromium bloquea Service Workers y usa interceptores de contexto, respuestas simuladas y un proxy local sin servicio. Los intentos de red y errores inesperados hacen fallar las pruebas. Las salidas de instalación ocurren antes de esta fase. Estos controles no sustituyen un sandbox del sistema operativo ni prueban autenticación, pagos, inferencia de IA o Supabase remoto. Consultar la [explicación completa](../docs/qa/DI-136-playwright-devsecops.md#arquitectura-de-ejecución-y-aislamiento).
