# DI-211 · Preparación de Railway QA, sin despliegue

La autorización comunicada por Jhan admite estudiar una aceptación temporal de riesgos **solo** para QA. Falta su revisión y aprobación de las excepciones individuales, el gate QA debe pasar y la identidad de la imagen desplegada debe coincidir con la aprobada. No conectar todavía el servicio a una rama que dispare autodeploy. No modifica el servicio Smile V17, el BFF de producción, Supabase ni la ingesta HMAC.

## Configuración manual, en el proyecto Railway existente

1. Crear el entorno aislado `di211-qa` sin copiar variables, volúmenes ni servicios con credenciales de producción. Usar únicamente `rfdetr-premium` en ese entorno; mantener la fuente Git desconectada y autodeploy apagado hasta la aprobación específica. Después, seleccionar la rama `feat/di-211-railway-qa`, Root Directory `/services/rfdetr-premium`, Dockerfile del directorio, healthcheck `/health` y `Wait for CI`. No usar la rama Premium para QA. [Entornos](https://docs.railway.com/environments), [autodeploy y Wait for CI](https://docs.railway.com/deployments/github-autodeploys).
2. No generar dominio público. El acceso de QA debe ser por la cuenta Railway autorizada o por un cliente sintético dentro del mismo entorno y su red privada. La red privada está aislada entre entornos. El secreto `X-Dentaia-Rfdetr-Secret` se exige aun dentro de QA; no ponerlo en el navegador ni en logs. [Red privada](https://docs.railway.com/networking/private-networking/how-it-works), [dominios públicos opcionales](https://docs.railway.com/networking/public-networking).
3. Empezar con **una réplica**, límite de **2 vCPU y 2 GiB RAM**, y comprobar métricas reales antes de inferencia. Reservar al menos 4 GiB de almacenamiento para imagen/capas temporales y un volumen privado de al menos 1 GiB para el checkpoint. Son valores iniciales, no una prueba de capacidad Railway. Sin base de datos, Stripe ni variables de Supabase en este servicio.

## Variables del servicio `rfdetr-premium` en `di211-qa`

| Variable | Valor de preparación |
| --- | --- |
| `PORT` | `7863` si Railway no lo inyecta |
| `DENTAIA_ENV` | `qa` |
| `DENTAIA_RFDETR_ENABLED` | `false` hasta aprobación del gate QA y autorización de prueba |
| `DENTAIA_RFDETR_PRODUCTION_ENABLED` | `false` siempre en QA |
| `DENTAIA_RFDETR_CHECKPOINT` | `/run/secrets/rfdetr/checkpoint_best_ema.pth` |
| `DENTAIA_RFDETR_SERVICE_SECRET` | secreto aleatorio **exclusivo de QA**, mínimo 32 caracteres, variable privada Railway |
| `DENTAIA_PREMIUM_INGEST_ENABLED` | `false` |
| `DENTAIA_PREMIUM_INGEST_PRODUCTION_ENABLED` | `false` |

El Dockerfile fija `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, `TORCH_FORCE_WEIGHTS_ONLY_LOAD=1` y dos hilos para OMP/MKL/OpenBLAS. No establecer `DENTAIA_PREMIUM_INGEST_HMAC_HEX`, `SUPABASE_SERVICE_ROLE_KEY`, credenciales de producción ni `DENTAIA_RFDETR_API_URL` en Vercel. `DENTAIA_RFDETR_ENABLED=true` solo puede cambiarse en QA después de la aprobación específica y de la comprobación de checkpoint y permisos; `DENTAIA_RFDETR_PRODUCTION_ENABLED` sigue en `false`. `/health` responde `disabled` mientras el flag está apagado; `configured` no prueba que el modelo haya cargado.

## Checkpoint externo y acceso de mínimo privilegio

Mantener el archivo original de **127563327 bytes** con SHA-256 `e45f9d6ee728123c37e6f3036aa541e464b2bc2110e4c6c03b684264f71c6007` fuera de Git, imagen, Actions, PR y logs. Montar un volumen privado del **servicio QA** en `/run/secrets/rfdetr`. Desde el equipo de Jhan, tras seleccionar inequívocamente proyecto, entorno y volumen QA en Railway CLI, subir con `railway volume files --volume <volumen-QA> upload <ruta-local-checkpoint> /checkpoint_best_ema.pth`. Verificar SHA y lectura del archivo desde el contenedor con UID 65532 antes de habilitar inferencia. [Comandos de volumen](https://docs.railway.com/cli/volume), [permisos](https://docs.railway.com/volumes).

Railway monta volúmenes como root y su documentación sugiere `RAILWAY_RUN_UID=0` para escritura. **No elevar este proceso a root.** Si UID 65532 no puede leer el checkpoint, detener la activación y elegir un mecanismo privado compatible; no asumir que el volumen es de solo lectura. El servicio no debe recibir otro archivo ni datos clínicos.

## Condiciones previas a cualquier deploy QA

- Jhan revisa el JSON completo de Trivy y el registro `docs/security/DI211_RAILWAY_QA_EXCEPTIONS.json`, aprueba explícitamente la lista y la **imagen exacta** mediante `DI211_QA_APPROVAL_JSON` en las variables del repositorio GitHub. Vigencia máxima 14 días desde `approved_at`; el gate falla sin aprobación o después de `expires_at`.
- El PR QA hacia `feat/di-211-rfdetr-premium` pasa todos los checks, incluido `sec-imagen-rfdetr` en modo QA. `workflow_dispatch` y PR hacia `main`/`develop` conservan la política estricta correspondiente.
- Verificar que Railway ejecutaría la **misma imagen aprobada**; una reconstrucción Git que cambie el ImageID requiere nuevo escaneo y nueva aprobación. No usar `Wait for CI` como sustituto de esta comprobación.
- Confirmar permisos documentales DI-232 para ejecutar el modelo derivado en Railway QA. Aceptación de CVE no sustituye derechos de uso.
- Solo después de esas condiciones, una prueba QA autorizada con imagen sintética y secreto QA. No enlazar el BFF de producción ni habilitar HMAC. No se ejecutó ninguna acción Railway al redactar este plan.
