# Preparación de Railway para DentaIA Vision

Esta guía prepara una evaluación académica local o privada. **No autoriza la publicación pública**: consulta [LICENSE_REVIEW.md](LICENSE_REVIEW.md) antes de exponer o distribuir el servicio.

La documentación oficial de Railway mantiene `railway.json` como archivo de configuración admitido. Railway marca Config as Code como deprecado y dice que los archivos existentes seguirán funcionando para servicios heredados hasta el 1 de diciembre de 2026. Esa fecha se refiere a esos servicios; no la presento como un retiro universal de toda configuración. Railway recomienda Infrastructure as Code; revisa su documentación vigente antes de migrar.

## Servicio

- Root Directory: `/services/dental-vision` en la configuración del servicio.
- Builder: Dockerfile; archivo `Dockerfile.railway` (también declarado en `railway.json`).
- Ruta del archivo de configuración: `/services/dental-vision/railway.json`. Railway documenta que el archivo de configuración no sigue automáticamente el Root Directory.
- Health check: `/health`, timeout 300 segundos. El endpoint responde `200` cuando ONNX está cargado y `503` cuando no está disponible.
- Reinicio: `ON_FAILURE`, máximo 3 reintentos.
- Puerto: Railway provee `PORT`; el contenedor escucha en `0.0.0.0` y usa `8080` solo como valor local predeterminado.

## Variables del servicio

Configurar como variables del servicio, sin incluir secretos en Git:

```text
MODEL_BACKEND=onnx
MODEL_PATH=models/best.onnx
MODEL_MANIFEST_PATH=models/best.onnx.json
DENTAL_VISION_SERVICE_SECRET=<secreto aleatorio ASCII de al menos 32 bytes>
```

La descarga de pesos y la exportación ocurren durante el build. Ese proceso requiere acceso a los índices de paquetes y al artefacto fijado en `scripts/download_model.py`; el servicio no descarga pesos al arrancar. El build completo, el consumo de memoria y la latencia en Railway todavía requieren validación.

## Conexión desde Next.js

En el servidor Next.js, configura `DENTAL_VISION_API_URL` con la URL HTTPS del servicio terminada exactamente en `/predict`. Configura allí el mismo `DENTAL_VISION_SERVICE_SECRET`; no uses el prefijo `NEXT_PUBLIC_` ni envíes el secreto al navegador.

La ruta existente `/api/desarrollo/vision-poc` conserva la autenticación y la allowlist actual de dos imágenes públicas verificadas. Esta configuración no habilita imágenes arbitrarias.

## Verificación y rollback

1. Antes de cualquier despliegue, revisa el contexto filtrado y confirma que incluye `requirements-export.txt` y los tres scripts de `scripts/` que requiere el Dockerfile.
2. Valida localmente la imagen, el arranque, `/health`, el secreto y `/predict` con pruebas que no usen pesos reales. Registra memoria y latencia. El build requiere descargar dependencias y pesos; no lo ejecutes sin autorización.
3. En una futura evaluación autorizada, confirma en los logs que el build termina y que `/health` responde `200` con `backend: onnx`. Después verifica el flujo de Next.js con las dos muestras demo y sus respuestas de error. Esto no valida el uso clínico.
4. Ante un fallo, detén el uso de la versión candidata y vuelve a la imagen o al commit revisado mediante el procedimiento de rollback aprobado por el proyecto. Esta guía no indica borrar despliegues ni artefactos.

## Límites conocidos

- Esta configuración no se ha aplicado ni probado en Railway; no demuestra que el servicio funcione allí.
- El build descarga pesos y requiere red. El contenedor de runtime incluye el modelo ONNX derivado.
- Se fijan dependencias directas, pero no todo el árbol transitivo ni el digest de la imagen. Faltan la SBOM y la revisión completa de avisos.
- La publicación pública sigue bloqueada por la revisión AGPL, los derechos de pesos y datos, la fuente correspondiente y los avisos. El uso académico no es una exención automática.
