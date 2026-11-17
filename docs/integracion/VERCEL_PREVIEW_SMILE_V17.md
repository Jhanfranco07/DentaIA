# Smile V17 en Vercel Preview

El Route Handler de Next solo reenvía una fotografía tras autenticar al usuario.
En desarrollo usa el servicio local `http://127.0.0.1:7862/analyze`. En Vercel
no existe ese fallback: el análisis queda cerrado salvo que se cumplan todas
estas condiciones:

- `VERCEL_ENV=preview` y rama `feature/integracion-ia-premium`.
- `DENTAIA_SMILE_PREVIEW_ENABLED=true` en el scope Preview de esa rama.
- `DENTAIA_SMILE_API_URL` es una URL HTTPS del backend Smile de pruebas.
- `DENTAIA_SMILE_SERVICE_SECRET` es un valor aleatorio de al menos 32 caracteres,
  idéntico en Vercel Preview y en el servicio Smile. El proxy lo envía como cabecera
  interna y el servicio rechaza peticiones que no la presentan.
- `ROBOFLOW_API_KEY` existe solo en ese backend Python, no en Vercel ni en el navegador.

No se habilita en Production. No configurar `DENTAIA_SMILE_PREVIEW_ENABLED` para
Production ni usar `localhost` como destino remoto.

## Activación controlada en Production

Production permanece cerrada hasta definir `DENTAIA_SMILE_PRODUCTION_ENABLED=true`
como variable **Production**. Deben existir también `DENTAIA_SMILE_API_URL` HTTPS y
`DENTAIA_SMILE_SERVICE_SECRET` (32+ caracteres) solo en servidor; Railway conserva
el mismo secreto. Mantener `OPENAI_API_KEY`, `OPENAI_MODEL`, `UPSTASH_REDIS_REST_URL`
y `UPSTASH_REDIS_REST_TOKEN` como secretos server-only. No usar `localhost`,
variables `NEXT_PUBLIC_` ni la clave de Roboflow en Vercel.

## Variables de sistema de Vercel

El Route Handler comprueba `VERCEL_ENV` y `VERCEL_GIT_COMMIT_REF` en runtime. En
Project Settings debe estar habilitada la exposición de **System Environment
Variables** para que Vercel entregue ambas; no se crean manualmente ni se sustituyen
por valores públicos. Si falta la segunda, la respuesta autenticada incluirá solo
`branch_missing_or_not_allowed`, sin mostrar secretos, URL del backend ni valores de
configuración.

## Límite para FastAPI dentro de Vercel

Vercel permite Functions Python/FastAPI, pero el límite de cuerpo de Function
es 4,5 MB. Smile permite fotografías de hasta 8 MB y requiere OpenCV nativo.
Por ello no se incorpora FastAPI al deployment Next sin una validación separada
del empaquetado Python y una decisión explícita sobre ese límite. Para Preview,
usar un backend Smile HTTPS separado que conserve los límites actuales.

## Pasos de prueba

1. Crear un backend Smile efímero HTTPS con `ROBOFLOW_API_KEY` y
   `DENTAIA_SMILE_SERVICE_SECRET` como secretos.
2. En Vercel, crear variables de Preview restringidas a esta rama:
   `DENTAIA_SMILE_PREVIEW_ENABLED=true`, `DENTAIA_SMILE_API_URL=https://.../analyze` y
   el mismo `DENTAIA_SMILE_SERVICE_SECRET` (32+ caracteres).
3. Mantener `OPENAI_API_KEY`, `OPENAI_MODEL`, Upstash y variables Supabase como
   secretos server-only de Preview si se desea la explicación automática.
4. Verificar que una cuenta paciente autorizada puede analizar una foto menor a
   8 MB; probar formato inválido, sesión inválida y ausencia de la flag.
5. Confirmar que Production devuelve indisponible y no intenta acceder a localhost.
