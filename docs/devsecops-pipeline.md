# Pipeline DevSecOps

El workflow `.github/workflows/devsecops.yml` corre en PR hacia `main` o `develop`, en pushes a esas ramas y en pushes a `feature/**`. Los workflows reutilizables `ci.yml`, `tests.yml` y `security.yml` siguen disponibles y no se alteraron.

## Grafo y alcance

```text
dependencias ─┬─ TypeScript ───┐
              ├─ pruebas ─────┼─ build ──────────┐
              └─ integración ─┘                  ├─ validación final
auditoría de dependencias ────────────────────────┘
```

`dependencias` comprueba que el lockfile instala con `npm ci --ignore-scripts`. TypeScript, pruebas aisladas e integración local simulada se ejecutan en paralelo después de esa comprobación. Cada job instala en su propio runner con caché de npm: se reutilizan los paquetes descargados, sin transferir `node_modules` entre entornos. La auditoría usa el lockfile y corre en paralelo. El build depende de tipos y pruebas; el cierre comprueba el resultado de todos los jobs, incluso si alguno fue cancelado u omitido. En pushes a `feature/**` se omite el build deliberadamente; en PR y ramas principales es obligatorio. Un push a feature no equivale a una validación completa de PR.

Las pruebas aisladas ejecutan todos los `*.test.mjs` salvo los `*integracion.test.mjs`. El job de integración ejecuta estos últimos: prueban componentes conectados mediante dobles locales, sin servicio remoto. No requiere secretos de producción.

## Interpretar resultados

La tabla del resumen de `Validación final` muestra el estado de cada job. Sólo `success` es aceptable, salvo `build: skipped` en pushes a feature. Un job omitido por fallo de `needs` causa cierre rojo. `npm audit` falla con las vulnerabilidades que npm considera bloqueantes; no se usa `continue-on-error`.

## Controles pendientes

- **Lint:** el proyecto no tiene ESLint ni script `lint`; configurarlo requiere acordar reglas y corregir los hallazgos iniciales.
- **CodeQL:** no existe workflow CodeQL en el repositorio. Antes de activarlo hay que confirmar en GitHub Security si el análisis predeterminado ya está habilitado; duplicarlo generaría análisis repetidos. La API de configuración requiere acceso que no estuvo disponible durante esta edición.
- **Secretos:** no hay detector de secretos configurado. Se debe elegir herramienta, fijar versión y definir el tratamiento de hallazgos históricos antes de convertirlo en control bloqueante.
- **E2E y responsive:** no hay Playwright, servidor de pruebas ni escenarios E2E existentes. Requieren fixtures de datos no productivos, puertos y expectativas visuales o de interacción estables. No se reportan como ejecutados.

Los tiempos y minutos adicionales se deben leer en la primera ejecución real de GitHub Actions. La separación crea más runners y más instalaciones `npm ci`; el caché de npm reduce descargas, pero no elimina esas instalaciones. El tiempo de pared depende del job más lento y de la cola de runners.
