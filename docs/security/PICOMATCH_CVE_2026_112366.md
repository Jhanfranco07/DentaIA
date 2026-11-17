# Riesgo abierto — picomatch ReDoS (GHSA-fc5q-39xc-vjpf)

## Contexto y verificación (17/11/2026)

El workflow **Security → Dependencias JavaScript · npm audit** del PR #76 falla al auditar `picomatch@4.0.7`, vulnerabilidad de denegación de servicio mediante expresiones glob repetidas (CVE-2026-112366). En el árbol bloqueado de `package-lock.json`, tanto `picomatch@4.0.7` como `vitest@5.1.0`, `vite@8.3.8`, `tinyglobby@0.2.17` y `fdir@6.5.0` figuran con `dev: true`. Vitest/Vite se usan en pruebas y construcción, no como dependencia directa del servidor en el `package.json`.

**Esto reduce la exposición de los endpoints desplegados, pero NO corrige la vulnerabilidad**: el código vulnerable permanece en el entorno de CI/desarrollo. Un atacante que controle patrones glob procesados allí podría explotar el ReDoS. La clasificación `dev: true` debe volver a comprobarse si cambian dependencias o el empaquetado.

El aviso oficial https://github.com/advisories/GHSA-fc5q-39xc-vjpf afectaba a picomatch hasta 4.0.7 y **no publicaba versión parchada** durante esta revisión; la salida de `npm audit` recomendaba `npm audit fix --force`, opción que puede degradar la versión de Vitest o introducir incompatibilidades. No se ejecuta ese comando sin parche verificado.

## Tratamiento obligatorio

1. Mantener `npm audit` completo, los escaneos SAST, Gitleaks, pip-audit y Security Quality Gate **sin ignorar** `GHSA-fc5q-39xc-vjpf`. Un resultado rojo significa riesgo conocido pendiente.
2. No aceptar patrones glob arbitrarios desde solicitudes HTTP, datos de pacientes ni sistemas externos en tareas del backend o de build. Evitar ejecutar scripts o repositorios no confiables durante CI.
3. Actualizar `picomatch` **solo cuando exista una versión corregida publicada y avalada por el aviso**. Regenerar `package-lock.json` con `npm install --package-lock-only`, ejecutar `npm ci`, `npm audit`, TypeScript, Vitest, build y DevSecOps.
4. Verificar en cada actualización que el paquete vulnerable esté restringido a herramientas de desarrollo y no se convierta en dependencia de producción.
5. No fusionar el PR #76 mientras el Security Quality Gate obligatorio siga rojo, salvo una decisión excepcional de aceptación del riesgo registrada explícitamente por los responsables de seguridad y el equipo. Esa excepción no equivaldría a corregirlo.

Seguimiento: https://github.com/Jhanfranco07/DentaIA/issues/77

## Estado

**Pendiente de parche del proveedor.** Este documento describe el riesgo y las medidas de contención, no constituye una resolución ni habilita el merge.
