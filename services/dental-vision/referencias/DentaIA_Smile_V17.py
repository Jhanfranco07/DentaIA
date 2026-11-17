# DENTAIA SMILE V17 - Google Colab - una sola celda
# Segmentacion: Roboflow (1 solicitud por foto); color: OpenCV (sin OpenAI ni GPU)
# Escala de amarillo experimental, no clinica.
from google.colab import files, userdata
from IPython.display import display
from PIL import Image, ImageOps
from io import BytesIO
from pathlib import Path
from datetime import datetime
import urllib.request, urllib.parse, base64, json
import cv2
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

MODELO = 'teeth-4coz7/1'
API_KEY = userdata.get('ROBOFLOW_API_KEY')
if not API_KEY:
    raise RuntimeError('Configura ROBOFLOW_API_KEY en Secretos de Colab.')
URL = f'https://serverless.roboflow.com/{MODELO}'
BASE = Path('/content/DentaIA_Smile_V17')
BASE.mkdir(parents=True, exist_ok=True)

CFG = {
    'max_dimension': 1200,
    'l_min': 35.0, 'l_max': 98.0,
    'min_pixels': 80, 'min_usable_fraction': 0.35,
    # Conservadores: umbrales iniciales para pruebas, no validados.
    'b_low': 15.0, 'b_medium': 23.0, 'b_high': 31.0,
    'partial_delta_halves': 5.0,
    'partial_delta_pixel': 6.0,
    'partial_min_fraction': 0.04,
    'partial_max_fraction': 0.70,
    'partial_min_component': 35,
    'light_difference_warning': 12.0,
}
GREEN, YELLOW, ORANGE, RED, GRAY = (
    (30, 205, 80), (250, 220, 50), (255, 145, 0),
    (220, 75, 45), (145, 145, 145)
)

def segmentar_roboflow(imagen):
    buf = BytesIO()
    imagen.save(buf, format='JPEG', quality=95)
    params = urllib.parse.urlencode({
        'api_key': API_KEY, 'confidence': 50, 'overlap': 50
    })
    req = urllib.request.Request(
        URL + '?' + params,
        data=base64.b64encode(buf.getvalue()),
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode('utf-8'))

def extraer_dientes(rgb, respuesta):
    h, w = rgb.shape[:2]
    meta = respuesta.get('image') or {}
    sx = w / float(meta.get('width') or w)
    sy = h / float(meta.get('height') or h)
    dientes = []
    for pred in respuesta.get('predictions', []):
        if str(pred.get('class', '')).lower() not in ('tooth', 'teeth'):
            continue
        puntos = pred.get('points') or []
        if len(puntos) < 3:
            continue
        try:
            pts = np.array(
                [[float(p['x']) * sx, float(p['y']) * sy] for p in puntos],
                dtype=np.float32
            )
        except (ValueError, TypeError, KeyError):
            continue
        pts[:, 0] = np.clip(pts[:, 0], 0, w - 1)
        pts[:, 1] = np.clip(pts[:, 1], 0, h - 1)
        polygon = np.rint(pts).astype(np.int32)
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(mask, [polygon], 255)
        ys, xs = np.where(mask > 0)
        if len(xs) < 50:
            continue
        dientes.append({
            'polygon': polygon, 'mask': mask > 0,
            'x': float(np.median(xs)), 'y': float(np.median(ys)),
            'area': len(xs)
        })
    if len(dientes) >= 4:
        areas = np.array([d['area'] for d in dientes], dtype=float)
        yvals = np.array([d['y'] for d in dientes], dtype=float)
        med_area, med_y = np.median(areas), np.median(yvals)
        mad_y = np.median(np.abs(yvals - med_y))
        dientes = [d for d in dientes if (
            d['area'] <= 4 * med_area
            and abs(d['y'] - med_y) <= max(4 * mad_y, h * 0.12)
        )]
    dientes.sort(key=lambda d: d['x'])
    for i, d in enumerate(dientes, 1):
        d['id'] = i
    return dientes

def nivel_amarillo(b):
    if b >= CFG['b_high']:
        return 'Intenso', RED
    if b >= CFG['b_medium']:
        return 'Moderado', ORANGE
    if b >= CFG['b_low']:
        return 'Leve', YELLOW
    return 'Sin amarillo destacado', GREEN

def analizar_color(rgb, dientes):
    lab = cv2.cvtColor(rgb.astype(np.float32) / 255.0, cv2.COLOR_RGB2LAB)
    L, B = lab[:, :, 0], lab[:, :, 2]
    h, w = B.shape
    for d in dientes:
        mask = cv2.erode(
            d['mask'].astype(np.uint8) * 255,
            np.ones((3, 3), np.uint8), iterations=2
        ) > 0
        valid = mask & (L >= CFG['l_min']) & (L <= CFG['l_max'])
        count = int(valid.sum())
        evaluable = (
            count >= CFG['min_pixels']
            and count / max(int(mask.sum()), 1) >= CFG['min_usable_fraction']
        )
        d.update({
            'evaluable': bool(evaluable), 'b_median': None,
            'level': 'No evaluable', 'delta_b_halves': None,
            'delta_l_halves': None, 'light_warning': False,
            'partial': False, 'zone_fraction': 0.0,
            'zone': np.zeros((h, w), dtype=bool),
            'zone_level': None,
        })
        if not evaluable:
            continue
        bmed = float(np.median(B[valid]))
        d['b_median'] = bmed
        d['level'], _ = nivel_amarillo(bmed)
        ys, xs = np.where(valid)
        middle = (float(xs.min()) + float(xs.max())) / 2
        left = valid & (np.arange(w)[None, :] < middle)
        right = valid & (np.arange(w)[None, :] >= middle)
        if min(int(left.sum()), int(right.sum())) >= 40:
            d['delta_b_halves'] = abs(
                float(np.median(B[left])) - float(np.median(B[right]))
            )
            d['delta_l_halves'] = abs(
                float(np.median(L[left])) - float(np.median(L[right]))
            )
            d['light_warning'] = (
                d['delta_l_halves'] > CFG['light_difference_warning']
            )

        # Solo buscar manchas parciales si existe contraste apreciable
        # y no hay gran diferencia de iluminacion entre mitades.
        can_localize = (
            d['delta_b_halves'] is not None
            and d['delta_b_halves'] >= CFG['partial_delta_halves']
            and not d['light_warning']
        )
        if not can_localize:
            continue

        ref_b = float(np.percentile(B[valid], 25))
        threshold = max(CFG['b_low'], ref_b + CFG['partial_delta_pixel'])
        candidates = (valid & (B >= threshold)).astype(np.uint8) * 255
        candidates = cv2.morphologyEx(
            candidates, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)
        )
        candidates = cv2.morphologyEx(
            candidates, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)
        )
        candidates[~valid] = 0
        nlab, lab_img, stats, _ = cv2.connectedComponentsWithStats(
            candidates, connectivity=8
        )
        min_area = max(
            CFG['partial_min_component'],
            int(count * CFG['partial_min_fraction'])
        )
        zone = np.zeros((h, w), dtype=bool)
        for i in range(1, nlab):
            if int(stats[i, cv2.CC_STAT_AREA]) >= min_area:
                zone |= lab_img == i
        frac = float(zone.sum()) / count
        if CFG['partial_min_fraction'] <= frac <= CFG['partial_max_fraction']:
            d['partial'] = True
            d['zone'] = zone
            d['zone_fraction'] = frac
            d['zone_level'], _ = nivel_amarillo(float(np.median(B[zone])))
            # Si la mediana global no supera el nivel leve,
            # aun podemos reportar una zona localizada bajo este criterio.

def dibujar(rgb, dientes):
    output = rgb.copy()
    for d in dientes:
        if not d['partial']:
            continue
        zone = d['zone']
        color = nivel_amarillo(float(d['b_median']))[1]
        if d['zone_level'] == 'Intenso':
            color = RED
        elif d['zone_level'] == 'Moderado':
            color = ORANGE
        else:
            color = YELLOW
        output[zone] = (
            0.80 * output[zone].astype(float)
            + 0.20 * np.array(color, dtype=float)
        ).astype(np.uint8)
        contours, _ = cv2.findContours(
            zone.astype(np.uint8) * 255,
            cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        cv2.drawContours(output, contours, -1, color, 2)
    for d in dientes:
        if not d['evaluable']:
            color = GRAY
        elif d['partial']:
            color = (ORANGE if d['zone_level'] != 'Intenso' else RED)
        else:
            color = nivel_amarillo(float(d['b_median']))[1]
        cv2.polylines(output, [d['polygon']], True, color, 2)
        x, y = int(d['x']), int(d['y'])
        cv2.putText(output, str(d['id']), (x - 7, y + 5),
                    cv2.FONT_HERSHEY_SIMPLEX, .55, (0, 0, 0), 3, cv2.LINE_AA)
        cv2.putText(output, str(d['id']), (x - 7, y + 5),
                    cv2.FONT_HERSHEY_SIMPLEX, .55, (255, 255, 255), 1, cv2.LINE_AA)
    return output

def resumen(dientes):
    evaluables = [d for d in dientes if d['evaluable']]
    flagged = [d for d in evaluables if (
        d['partial'] or d['level'] != 'Sin amarillo destacado'
    )]
    local = [d for d in flagged if d['partial']]
    if not evaluables:
        return 'No se pudo evaluar la sonrisa', 'Intenta con mejor luz y enfoque.'
    if not flagged:
        return ('Sin amarillo destacado',
                'No se encontraron alertas de amarillo con estos parametros experimentales.')
    if len(flagged) == 1:
        title = 'Una region dental con amarillo destacado'
    elif len(flagged) / len(evaluables) >= .7:
        title = 'Varios dientes se ven amarillentos'
    else:
        title = 'Algunos dientes presentan tonos amarillentos'
    description = f'Se identificaron {len(flagged)} de {len(evaluables)} regiones evaluables.'
    if local:
        description += ' Zonas parciales en regiones: ' + ', '.join(
            str(d['id']) for d in local
        ) + '.'
    if any(d['light_warning'] for d in evaluables):
        description += ' Algunas regiones presentan iluminacion desigual.'
    return title, description

def procesar(nombre, contenido):
    img = ImageOps.exif_transpose(Image.open(BytesIO(contenido))).convert('RGB')
    img.thumbnail((CFG['max_dimension'], CFG['max_dimension']))
    rgb = np.asarray(img)
    folder = BASE / ('prueba_' + datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
    folder.mkdir()
    img.save(folder / 'foto_original.jpg', quality=95)
    print('\nProcesando:', nombre)
    pred = segmentar_roboflow(img)
    (folder / 'roboflow.json').write_text(
        json.dumps(pred, indent=2, ensure_ascii=False), encoding='utf-8'
    )
    dientes = extraer_dientes(rgb, pred)
    if not dientes:
        print('No se detectaron dientes. Prueba otra foto.')
        return None
    analizar_color(rgb, dientes)
    visual = dibujar(rgb, dientes)
    title, desc = resumen(dientes)
    print(title)
    print(desc)
    print('Aviso: niveles visuales experimentales, no una escala clinica de color.')
    fig, axes = plt.subplots(1, 2, figsize=(16, 7))
    axes[0].imshow(rgb)
    axes[0].set_title('Fotografia original')
    axes[1].imshow(visual)
    axes[1].set_title(title)
    for ax in axes:
        ax.axis('off')
    plt.tight_layout()
    plt.show()
    rows = [{
        'Region': d['id'], 'Estado': d['level'],
        'Zona_localizada': d['partial'], 'Nivel_zona': d['zone_level'],
        'Porcentaje_zona': round(d['zone_fraction'] * 100, 1),
        'b_mediana': None if d['b_median'] is None else round(d['b_median'], 2),
        'Contraste_mitades': None if d['delta_b_halves'] is None else round(d['delta_b_halves'], 2),
        'Aviso_luz': d['light_warning'],
    } for d in dientes]
    tabla = pd.DataFrame(rows)
    display(tabla)
    Image.fromarray(visual).save(folder / 'resultado_visual.png')
    tabla.to_csv(folder / 'resultados.csv', index=False, encoding='utf-8-sig')
    payload = {
        'version': 'V17', 'modelo': MODELO, 'titulo': title,
        'descripcion': desc, 'regiones': json.loads(tabla.to_json(orient='records')),
        'calibrado': False, 'diagnostico_clinico': False,
    }
    (folder / 'resultado.json').write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8'
    )
    print('Guardado en:', folder)
    return tabla

print('DENTAIA SMILE V17 - Subir una o varias fotografias')
print('Leyenda: verde = sin alerta, amarillo = leve, naranja = moderado, rojo = intenso, gris = no evaluable.')
print('Los niveles leve/moderado/intenso son orientativos y NO clinicos.')
subidos = files.upload()
resultados = {}
for nombre, contenido in subidos.items():
    try:
        resultados[nombre] = procesar(nombre, contenido)
    except Exception as exc:
        print(f'Error en {nombre}: {type(exc).__name__}: {exc}')
        print('Sin reintento automatico.')
print('Pruebas terminadas. OpenAI: 0. GPU: NO. Modelo V2: sin modificar.')
