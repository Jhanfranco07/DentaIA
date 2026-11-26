# DI-211 · Preparación del servicio Railway RF-DETR Premium

Para la propuesta de QA aislado y aún sin despliegue, ver [DI211_RAILWAY_QA_RUNBOOK.md](DI211_RAILWAY_QA_RUNBOOK.md). Este documento conserva el criterio de producción.

Estado al 26 de noviembre de 2026: **preparación únicamente**. La imagen actual falla el gate de revisión y de despliegue de Trivy; no conectarla a despliegue automático ni activar inferencia. Este documento usa el servicio `rfdetr-premium` ya creado, sin crear otro servicio y sin modificar Smile V17.

## Configuración del servicio existente

1. Fuente GitHub: `Jhanfranco07/DentaIA`, rama `main` **solo después** de corregir la imagen y aprobar el merge. Mantener desconectada la rama `feat/di-211-rfdetr-premium`. Activar `Wait for CI` y comprobar que el job `sec-imagen-rfdetr` y `sec-quality-gate` del pipeline maestro están en verde antes de permitir un deploy. Una integración Git puede desplegar por fuera de GitHub Actions si se conecta sin este control.
2. Root Directory: `/services/rfdetr-premium`; Dockerfile: `Dockerfile` dentro de ese directorio; sin build command, start command ni pre-deploy command que sustituyan el Dockerfile. Healthcheck Path: `/health`. Fijar `PORT=7863` si Railway no lo asigna; el Dockerfile respeta el `PORT` efectivo. Una respuesta 200 de `/health` con estado `disabled` solo acredita que FastAPI responde, no que el checkpoint cargó.
3. Una réplica, CPU como máximo 2 vCPU y memoria como máximo 2 GiB **solo como punto inicial de validación**. El smoke local anterior midió un pico de cgroup de unos 576 MiB para una inferencia sintética; no mide el servicio bajo Railway ni el pico de arranque. Ajustar únicamente con métricas reales de CPU, RAM, latencia y OOM antes de habilitar tráfico.
4. No generar dominio público hasta que la imagen, el montaje privado y el secreto compartido estén validados. El BFF de Vercel no puede alcanzar el dominio `*.railway.internal`; la conexión futura requiere HTTPS público y el secreto exclusivo `X-Dentaia-Rfdetr-Secret` desde servidor. Nunca enviar ese secreto al navegador. `/analyze` devuelve 503 mientras esté deshabilitado y 401 si se habilita pero falta autenticación.

## Variables Railway

| Variable | Valor durante la preparación | Activación posterior autorizada |
| --- | --- | --- |
| `PORT` | `7863` | Mantener o respetar el valor inyectado por Railway. |
| `DENTAIA_ENV` | `production` | Mantener. |
| `DENTAIA_RFDETR_ENABLED` | `false` | `true` solo tras gate verde, permisos, paridad y autorización. |
| `DENTAIA_RFDETR_PRODUCTION_ENABLED` | `false` | `true` en la misma ventana de activación autorizada. |
| `DENTAIA_RFDETR_CHECKPOINT` | `/run/secrets/rfdetr/checkpoint_best_ema.pth` | Mantener. |
| `DENTAIA_RFDETR_SERVICE_SECRET` | Secreto aleatorio de al menos 32 caracteres, distinto de HMAC, gestionado como variable privada Railway. | Mismo valor en el BFF Vercel, solo en variables de servidor. Rotarlo coordinadamente. |
| `OMP_NUM_THREADS`, `MKL_NUM_THREADS`, `OPENBLAS_NUM_THREADS` | `2` en Dockerfile | Mantener inicialmente. |

No configurar claves de Supabase, Stripe, cookies de sesión ni token de Docker dentro de este servicio. El Dockerfile ya fija `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1` y `TORCH_FORCE_WEIGHTS_ONLY_LOAD=1`.

## Checkpoint privado

El checkpoint de 127563327 bytes, SHA-256 `e45f9d6ee728123c37e6f3036aa541e464b2bc2110e4c6c03b684264f71c6007`, queda fuera de Git y de la imagen. Usar **un volumen privado del mismo servicio** montado en `/run/secrets/rfdetr`, con al menos 1 GiB de capacidad. Railway documenta `railway volume files upload <origen> /checkpoint_best_ema.pth` para subir un archivo sin incluirlo en el build. Ejecutar la subida desde el equipo del responsable y verificar SHA-256 dentro del volumen antes de habilitar la inferencia. No adjuntar el archivo a issues, PR, Actions ni logs.

Railway monta volúmenes propiedad de root y recomienda `RAILWAY_RUN_UID=0` para escritura. Este servicio corre como UID 65532: **no cambiarlo a root**. Antes de activar, demostrar que UID 65532 puede leer el archivo y el directorio montado; si el modo del volumen lo impide, usar un mecanismo privado que mantenga el proceso sin privilegios o detener la activación. Un volumen Railway no acredita por sí solo un montaje de solo lectura; restringir el archivo a lectura para el proceso y comprobar que no pueda modificarlo. No hay prueba de estos permisos en Railway todavía.

## Criterios antes de conectar o activar

- Escanear la imagen **final** con Trivy 0.76.2 sin exclusiones; conservar el JSON del job `sec-imagen-rfdetr`; exigir cero bloqueos en `--mode deploy` y checks obligatorios verdes. El gate actual registra 64 bloqueos, por lo que el servicio no se despliega todavía.
- Validar imports, operadores, carga estricta Best EMA e inferencia sintética sobre esa imagen final; comprobar hash, memoria, p50/p95 y respuesta 429 con concurrencia limitada. La paridad de 300 candidatos con Colab ya pasó en la imagen experimental actual para una entrada sintética, pero deberá repetirse si cambia la base, el runtime o el posprocesamiento; ver [evidencia de paridad](DI211_PARITY_SYNTHETIC.md).
- Confirmar derechos del dataset y pesos derivados, política de fotografías clínicas y autorización de uso en Railway. La aceptación anterior cubre solo un smoke local offline.
- Tras la aprobación, configurar en Vercel `DENTAIA_RFDETR_API_URL=https://<dominio-Railway>/analyze` y el mismo secreto privado. Mantener los flags de RF-DETR y de ingesta DI-214 en `false` hasta la ventana de activación. Para ingesta HMAC, el valor hexadecimal de 64 caracteres debe coincidir con el verificador en Supabase bajo control de Jhan; no compartirlo con Railway.

Referencias: [Railway Volumes](https://docs.railway.com/volumes), [GitHub autodeploy y Wait for CI](https://docs.railway.com/deployments/github-autodeploys), [Healthchecks](https://docs.railway.com/deployments/healthchecks), [Public Networking](https://docs.railway.com/networking/public-networking), [Resource Limits](https://docs.railway.com/pricing/cost-control).
