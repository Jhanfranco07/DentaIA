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

## Revision de cumplimiento para Railway (2026-11-11)

### Hechos comprobados en este checkout

- `Dockerfile.railway` copia `models/best.onnx`, su manifiesto, `LICENSE_REVIEW.md` y `third_party/AGPL-3.0.txt` dentro de la imagen. Esto conserva avisos, pero no incorpora una oferta accesible de codigo fuente correspondiente ni el inventario completo de avisos de dependencias.
- El ONNX actual deriva del checkpoint `Eeman1113/dental_study` en el commit indicado arriba: el descargador fija esa URL/commit y `models/best.onnx.json` contiene hashes, tamano, parametros de exportacion y clases. **El manifiesto actualmente presente no contiene `repository`, commit ni `license`**; `scripts/export_onnx.py` agrega esos campos al regenerarlo y `scripts/validate_artifacts.py` los exige. No se debe tratar el manifiesto actual por si solo como evidencia de licencia/procedencia.
- El README del repositorio original atribuye AGPL-3.0 a los pesos YOLO11 y MIT a su codigo, pero el checkout auditado no incluye una licencia del autor que confirme permisos especificos de redistribucion. La licencia del checkpoint y el alcance de la licencia sobre el ONNX siguen siendo asuntos pendientes.
- `requirements-onnx.txt` fija versiones de FastAPI, Starlette, Pydantic, Uvicorn, Pillow, NumPy, OpenCV headless y ONNX Runtime. Es solo una lista directa: no fija el arbol transitivo ni identifica todas las bibliotecas nativas incluidas por las ruedas, la imagen base de Python o Debian. No hay SBOM ni paquete de avisos completo en el servicio.

### Obligaciones y alcance: confirmado frente a pendiente

- **Texto de licencia:** `third_party/AGPL-3.0.txt` contiene el texto AGPL-3.0. Si se transmite una copia del contenedor/objeto binario a un destinatario, AGPL §§4-6 requieren conservar avisos y licencia y cumplir las condiciones de entrega de la fuente correspondiente aplicables a esa forma de distribucion. El contenedor incorpora el ONNX; no se ha verificado que la plataforma reciba una copia en el sentido juridico pertinente ni quien seria el destinatario.
- **Servicio accesible por red:** AGPL §13 exige ofrecer a todos los usuarios que interactuan remotamente con una version modificada la oportunidad de obtener, sin cargo, la fuente correspondiente de esa version. El propio texto confirma esta obligacion para una obra cubierta modificada. Aplicar exactamente esa obligacion al servicio DentaIA, al ONNX derivado y a una aplicacion mayor requiere determinar primero el alcance de cobertura; Ultralytics sostiene que los modelos entrenados y los proyectos derivados quedan cubiertos, pero esa posicion del licenciante no resuelve por si sola el analisis juridico.
- **Contenido de la fuente:** la fuente correspondiente puede incluir las fuentes preferidas para modificar la obra, scripts de build/instalacion y configuraciones necesarias. Que incluya el checkpoint original, datos de entrenamiento, otras partes del repositorio DentaIA o codigo de terceros depende del alcance y de las definiciones de la licencia; no se debe publicar material sin verificar los derechos. Un archivo de licencia o una atribucion aislada no reemplazan la fuente correspondiente.
- La separacion del frontend por HTTP y la ausencia de PyTorch/Ultralytics en la imagen de runtime no prueban que el backend o el sistema mayor queden fuera de AGPL. Esa calificacion, y si se requiere ofrecer un codigo fuente mas amplio, quedan pendientes de asesoria juridica/licenciante.

### Bloqueos antes de exponer el servicio publicamente

1. Obtener una determinacion documentada del alcance AGPL para pesos, ONNX, microservicio y sistema que lo consume, incluyendo una respuesta del titular o asesoria juridica. Confirmar tambien permisos sobre el checkpoint y los datos de entrenamiento; la atribucion CC BY del dataset por si sola no acredita consentimiento ni todos los derechos necesarios.
2. Preparar y publicar una copia revisada de la fuente correspondiente y una oferta visible/estable accesible desde el servicio para cada usuario remoto, o una alternativa de licencia/autorizacion que cubra el uso previsto. Aun no hay URL de fuente publica verificada; no agregar un enlace ficticio ni publicar el repositorio privado automaticamente.
3. Antes de entregar la imagen a terceros, generar un SBOM de la imagen final, revisar licencias y avisos de dependencias transitivas, ruedas binarias, bibliotecas nativas, Python, Debian e imagen base, y distribuir los avisos exigidos por cada licencia.
4. Corregir o regenerar el manifiesto del ONNX desde un proceso confiable y verificar que el archivo resultante registra origen, commit y licencia; hacerlo no cambia ni resuelve los derechos sobre el modelo.

**Estado: bloqueado para un Railway publico.** Esta revision identifica obligaciones probables y pendientes, no es una conclusion juridica ni una certificacion de cumplimiento. No se desplego ni se modifico la configuracion remota.

## Preparación técnica PR #51 (2026-11-12; no es aprobación de despliegue)

- `Dockerfile.railway` ahora define una etapa Linux de exportación desde el checkpoint fijado, valida tamaño/SHA-256 antes y después de exportar y comprueba ONNX, proveedores CPU, estructura, clases y procedencia antes de copiar al runtime el ONNX y su manifiesto. El manifiesto registra URL, repositorio, commit, ruta, hash/tamaño fuente, declaración de licencia, parámetros, clases, plataforma y versiones reales de dependencias. Los artefactos de pesos permanecen excluidos de Git.
- El runtime conserva `LICENSE_REVIEW.md` y `third_party/AGPL-3.0.txt`; esto no reemplaza la entrega del código fuente correspondiente ni una oferta a usuarios remotos conforme a AGPL §13 si aplica. La página/servicio todavía no tiene una URL comprobada de fuente correspondiente accesible para usuarios. Antes de activar acceso remoto se requiere una fuente revisada y publicada que cubra la versión servida, y una oferta/enlace visible y estable hacia ella.
- Permanece pendiente la determinación del alcance de AGPL sobre pesos, ONNX, microservicio y sistema consumidor, así como permiso de redistribución de los pesos y derechos/consentimiento de los datos. El README upstream y un manifiesto no resuelven esos puntos; el contacto con el autor continúa sin respuesta.
- No se ha generado SBOM ni revisado licencias/transitivos de la imagen final, ruedas binarias, bibliotecas nativas, Debian o imagen base. PyTorch 2.11.0 + torchvision 0.26.0 son el par de la matriz oficial y hay ruedas CPU manylinux CPython 3.11 publicadas, pero la importación/exportación Linux no se pudo ejecutar en este host. El build fija paquetes directos, no hashes transitivos ni digest de imagen; por tanto, es un procedimiento verificable, no una reproducción binaria exacta.

**Bloqueo mantenido:** no desplegar públicamente ni distribuir la imagen hasta resolver la revisión jurídica, los derechos de pesos/datos, la fuente correspondiente y los avisos/SBOM. Acceso restringido a evaluadores reduce quién puede entrar, pero no constituye excepción de licencia.
