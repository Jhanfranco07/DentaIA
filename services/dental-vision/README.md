# DentaIA Smile V17

Servicio local FastAPI para la segmentación Roboflow `teeth-4coz7/1` y el
análisis visual CIELAB de Smile V17. No incluye el detector ONNX/PyTorch
retirado ni pesos locales.

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
$env:ROBOFLOW_API_KEY = "configurar-como-secreto-local"
.\.venv\Scripts\python -m uvicorn app.smile_api:app --host 127.0.0.1 --port 7862
```

El navegador no conoce la clave Roboflow: Next.js autentica al usuario y
reenvía la foto únicamente al endpoint local `/analyze`.
