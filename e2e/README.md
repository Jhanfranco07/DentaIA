# E2E público

La suite valida páginas reales de Next.js con Chromium. Playwright inicia y detiene el servidor local. No requiere cuentas, Supabase ni claves de servicios.

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

En Windows, usar `npm.cmd` si PowerShell impide ejecutar `npm.ps1`. El puerto predeterminado es 43117; si está ocupado, definir `E2E_PORT` con un puerto local libre. Playwright nunca reutiliza un servidor existente.

Las solicitudes del navegador a dominios externos se bloquean. Supabase apunta a `127.0.0.1:1` y sus respuestas se simulan como servicio no disponible, lo que permite comprobar el catálogo demo sin contactar una base real. La RPC de consulta del directorio usa HTTP POST, pero se intercepta antes de salir del navegador. Cualquier otra solicitud de escritura hace fallar la prueba. Las pruebas no envían formularios, fotografías, solicitudes ni pagos.

La salida HTML se guarda en `playwright-report/` y las capturas y trazas de fallos en `test-results/`; ambos directorios están ignorados por Git. Las pruebas autenticadas futuras deben vivir fuera de `e2e/public/` y usar una configuración y datos aislados.
