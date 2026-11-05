# Procedencia, avisos y estado de licencia

Revisión para evaluación académica local, 4 de noviembre de 2026. **Publicación del servicio y redistribución de modelos bloqueadas: cumplimiento completo pendiente.** Solo se prepara el push del código propio, configuración, avisos y recibos sin binarios ni fotografías. Esto no aprueba desplegar un servicio ni cambia la licencia de DentaIA o de módulos de otros integrantes.

## Artefactos

- Pesos originales: `Eeman1113/dental_study`, commit `f02596a0227b9eaf767b955cd67196236111a3d5`, `best.pt`, 80 923 921 bytes, SHA-256 `7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d`. El checkpoint declara AGPL-3.0 y arquitectura YOLO11m. El README del candidato también atribuye AGPL-3.0 a esos pesos. No consta una licencia separada que permita redistribuirlos como propietarios.
- Grafo derivado: exportación FP32 mediante Ultralytics 8.4.104, opset 17, entrada fija 640, CPU, sin cuantización. `models/best.onnx.json` contiene hash y tamaño del archivo efectivamente generado, hash de los pesos, commit y licencia. El build rechaza punteros LFS, integridad incorrecta, datos externos faltantes y pérdida de metadatos de licencia. Una exportación nueva puede cambiar de hash por metadatos y versiones de plataforma; no se fuerza el hash histórico de Windows a Linux.
- El manifiesto y el grafo deben venir juntos de un build confiable; sustituir ambos desde una fuente no confiable no constituye una verificación de autenticidad. La API no acepta modelos ni manifiestos de usuarios.
- Las fotografías públicas de evaluación proceden del split oclusal del candidato, atribuido a [Zenodo 14827784](https://zenodo.org/records/14827784), con CC BY 4.0 según sus metadatos. La atribución y hashes están en `evidence/samples.json`. No se redistribuyen fotos en el runtime ni en Git. No se verificó consentimiento individual ni el ZIP completo original.

## Obligaciones que deben resolverse antes de publicar

La referencia es el [texto AGPL-3.0 distribuido por Ultralytics 8.4.104](https://github.com/ultralytics/ultralytics/blob/v8.4.104/LICENSE), conservado sin modificar en `third_party/AGPL-3.0.txt`. [Ultralytics](https://www.ultralytics.com/license) declara que su licencia comprende los modelos entrenados y exige revisar el alcance de la obra derivada. ONNX Runtime tiene su propia licencia MIT; esta licencia no sustituye la de los pesos.

1. Conservar avisos de autoría, licencia y ausencia de garantía en las copias/artefactos distribuidos (AGPL §§4–6). Incluir el texto de licencia y señalar modificaciones pertinentes.
2. Determinar y proporcionar el código fuente correspondiente exigible al distribuir binarios y versiones derivadas: código, configuración y scripts necesarios para construir, exportar e instalar la versión distribuida. Un enlace a `best.pt` o un contenedor sin fuentes no demuestra cumplimiento.
3. Revisar la obligación de ofrecer el código fuente correspondiente a usuarios que interactúen por red con una versión modificada (AGPL §13). Un secreto de servicio o acceso restringido no elimina por sí solo esa obligación.
4. Resolver el alcance sobre este microservicio, los pesos y una futura integración Next.js. Separar por HTTP o quitar PyTorch del runtime no demuestra que la aplicación mayor quede fuera del alcance de licencia.
5. Verificar derechos y condiciones de redistribución del candidato, conservar atribución de datos y completar los avisos de dependencias de la imagen efectiva. El README declara MIT para su código, pero no se encontró un archivo LICENSE en el candidato inspeccionado; no se copió su pipeline.

No se ha aprobado ni aplicado una relicencia de la aplicación principal. No se ha comprado una licencia comercial, contactado al autor ni publicado artefactos. Los avisos y el texto incluidos son preparación; **no certifican cumplimiento completo**.

## Evaluación privada preparada

El flujo local Docker publica el puerto solo en `127.0.0.1`, exige un secreto efímero y usa únicamente muestras públicas. No publica imágenes Docker en registries. Esto limita la exposición técnica y no se presenta como una exención general de AGPL.

La plantilla Render queda inactiva como `.example`. Render Free ofrece un Web Service accesible por Internet y no un servicio privado de red; la API key protege `/predict`, pero no convierte la infraestructura en privada. No aplicar la plantilla hasta resolver licencias y Linux. Si se exige aislamiento de red privado sin servicios pagos, mantener la evaluación local en Docker/loopback; no elegir automáticamente un plan Render de pago.
