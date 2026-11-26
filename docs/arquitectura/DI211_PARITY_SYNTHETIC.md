# DI-211 · Paridad técnica sintética con Colab

Resultado del 26 de noviembre de 2026: **paridad numérica exacta en los 300 candidatos** del checkpoint Best EMA para una única entrada sintética. La referencia independiente fue entregada por el responsable como `rfdetr_parity_reference.json`; SHA-256 `80d9acaa29d4e6cc490888ae74b8ba7769c65c71f4ad504ed64541ae45ef5215`. El checkpoint externo se verificó de nuevo: 127563327 bytes y SHA-256 `e45f9d6ee728123c37e6f3036aa541e464b2bc2110e4c6c03b684264f71c6007`. No se ejecutó ninguna celda antigua que usara `weights_only=False` ni se modificó el checkpoint.

## Entrada y comparación

- Imagen: `Image.new("RGB", (512, 512), (127, 127, 127))`; CPU, dos hilos, extracción `threshold=0.0`, umbral operativo congelado `score >= 0.35`.
- El proveedor integrado ejecutó `app.model.predict()` una sola vez con su carga estricta Best EMA. Un gancho temporal en `map_rows` capturó las 300 filas **antes** del filtrado contractual. El contenedor se ejecutó sin red, sin privilegios, con checkpoint montado en solo lectura, raíz de solo lectura, tmpfs efímero, límite de 1.5 GiB y 2 vCPU. No recibió credenciales.
- Se compararon las 300 filas **por posición**: `class_id` exacto, `confidence` y las cuatro coordenadas `xyxy`. Tolerancias fijadas antes de la comparación: diferencia absoluta máxima `1e-4` en confianza y `0.5` píxeles por coordenada, para permitir variación numérica entre versiones CPU. Resultado observado: **0 etiquetas distintas, diferencia máxima de confianza 0 y diferencia máxima de caja 0**; p95 también 0. No hubo filas inválidas ni elementos fuera de tolerancia.
- La referencia y el proveedor informaron 0 candidatos tras excluir el índice interno 6 y aplicar `score >= 0.35`; el contrato integrado devolvió `evaluated_no_detections` y 0 detecciones. La conclusión usa los 300 candidatos, no solamente el resultado vacío.

| Dependencia | Colab original | Proveedor integrado |
| --- | --- | --- |
| Python | 3.13.18 | 3.11.18 |
| RF-DETR | 1.12.1 | 1.12.1 |
| PyTorch CPU | 2.14.1+cpu | 2.15.0+cpu |
| torchvision CPU | 0.29.1+cpu | 0.29.2+cpu |
| NumPy | 2.4.6 | 2.4.6 |
| Pillow | 11.3.0 | 13.0.0 |
| supervision | 0.32.3 | 0.32.1 |
| transformers | 5.22.1 | 5.22.2 |

La identidad del checkpoint, entrada, configuración e índices coincide. La igualdad de todas las salidas numéricas en esta entrada, pese a las diferencias de versiones indicadas, acredita **paridad técnica de este caso sintético**. No acredita precisión clínica, comportamiento sobre fotografías reales, estabilidad ante otras entradas ni rendimiento en Railway.

## Evidencia y límites de seguridad

El JSON de referencia, los 300 candidatos integrados, el resumen de comparación y los dos scripts reproducibles están en `C:\Users\USER\DentaIA-ML-Artifacts\DI-211-runtime-qa\` con prefijo `di211-*parity*20261126`. La salida integrada se guardó byte por byte en UTF-16 debido a la redirección de Windows PowerShell; el script comparador la lee como UTF-16. El resumen registra SHA-256 de ambos JSON y las diferencias máximas. No se incorporaron pesos ni fotografías al repositorio.

El pico local de RSS fue 674720 KiB y el pico del cgroup 768184320 bytes dentro del límite de 1.5 GiB. Son mediciones de esta prueba, no una reserva certificada para Railway. La imagen usada sigue bloqueada por el gate de Trivy: [hallazgos y política](../security/DI211_RFDETR_IMAGE_GATE.md). La paridad no autoriza push, despliegue ni activación mientras el gate de seguridad falle.
