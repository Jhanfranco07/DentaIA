# Continuar desde otra computadora

Se detuvieron las construcciones y validaciones largas por petición del usuario. No se desplegó en Render ni Vercel, no se hicieron merges y no se modificaron Supabase, Jira ni otras ramas. La rama contiene únicamente el microservicio y documentación de evaluación.

## Estado guardado

- Imagen Linux ONNX construida localmente. Pesos originales reales descargados y verificados: SHA-256 `7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d`.
- Exportación Linux FP32, opset 17: 80 380 309 bytes, SHA-256 `2c9f66d4b7547dcab625539ceb7ad8870fb93e4171c4863e4c4a29a0cbace4d50`. ONNX checker, pesos embebidos, metadatos AGPL y sesión CPU verificados durante el build. El binario no se publica.
- Las 21 pruebas Linux terminaron antes de la cancelación: 19 con mocks/unidades y 2 integraciones reales con fotografías públicas, PyTorch y ONNX. Recibo: `evidence/linux/tests-linux.xml`.
- **Pendiente:** validación Linux integral del contenedor final mediante HTTP con 512 MiB, sin swap y 0.1 CPU; memoria máxima, carga, latencia y revisión de logs del runtime limitado. `validation.json` registra la interrupción y no debe interpretarse como compatibilidad aprobada.
- Las mediciones previas de 329 MiB/2.01 s son de Windows y no sustituyen las pendientes de Linux.
- Se conservan Dockerfiles, dependencias separadas, plantilla Render inactiva, scripts y revisión AGPL. No se incluyen pesos, imágenes Docker, fotografías ni secretos. No hay que trasladar `.env` ni el entorno `.venv` de esta computadora.

## Descargar en la laptop

En un directorio nuevo:

```powershell
git clone --branch feature/vision-artificial-poc --single-branch https://github.com/Jhanfranco07/DentaIA.git DentaIA-vision-poc
cd DentaIA-vision-poc
git status --short
git log -1 --oneline
cd services/dental-vision
```

Si ya existe un repositorio con cambios locales, conservarlos y usar un directorio nuevo para este clon. El push de código no lleva la caché Docker: la primera construcción en la laptop descargará dependencias y pesos públicos y puede tardar.

## Reanudar cuando haya recursos disponibles

Instalar/iniciar Docker Desktop con motor Linux y disponer de Python en el host. No ejecutar estos pasos hasta decidir reanudar las validaciones largas:

```powershell
docker version
python -u scripts/linux_validation.py
```

El script reproduce la exportación, ejecuta la suite Linux y mide el contenedor final limitado. Los resultados se guardan en `evidence/linux/`. Ver `LINUX_VALIDATION.md` para comandos separados, HTTP manual y campos exactos de Render.

No es necesario copiar pesos desde esta computadora. El Dockerfile descarga el objeto original fijado por commit, valida su hash y genera el grafo/manifiesto. Un nuevo build puede tener un hash ONNX distinto por metadatos: se valida contra el manifiesto generado en ese mismo build.

## Antes de publicar un servicio

Resolver `LICENSE_REVIEW.md` y completar la validación limitada. No aplicar todavía `render.evaluation.yaml.example`. El acceso por secreto y la exportación ONNX no eliminan AGPL. Render Free es un Web Service de Internet; la evaluación privada preparada es Docker local con puerto en loopback. No se contratan servicios de pago ni se modifica la aplicación principal.
