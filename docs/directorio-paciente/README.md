# Directorio dentro del portal paciente

Ruta protegida: `/panel/odontologos`; fichas: `/panel/odontologos/[id]`. Reutiliza el mismo catálogo y la consulta Supabase que el directorio público; **no** duplica datos ni modifica las políticas.

Los 20 perfiles identificados en `CATALOGO_DEMO` son **ficticios** y no se atribuye a ellos una actividad clínica real, reseñas, distancias ficticias, verificación profesional ni relación laboral con los centros publicados. Los centros son referencias independientes.

Las ilustraciones son originales, de estilo profesional adulto, y se asignan exclusivamente a los 20 personajes de ejemplo. La presentación «Dra.»/«Dr.» es una decisión creativa del catálogo ficticio, no una inferencia de género de personas reales. Los perfiles reales no reciben avatares inventados.

El radar es decorativo; al pulsar «Usar mi ubicación» el navegador solicita permiso. Solo tras obtener coordenadas válidas se anima el marcador del dispositivo en el mapa y se ordenan ubicaciones por distancia geodésica (línea recta), sin almacenarlas en Supabase. La distancia no equivale a un recorrido por carretera.

Se mantiene el directorio público `/directorio`, mientras el portal paciente abre su propio módulo. `main` y `develop` deben sincronizarse únicamente después de validación de CI.

## Revisión visual premium — noviembre 2026

Se añade un hero editorial con los retratos visibles, localizador compacto, filtros rápidos, tarjetas con mayor jerarquía, información de proximidad y presentación de mapa propia del portal paciente. Se conserva el directorio público y la misma consulta Supabase. La ubicación requiere autorización del dispositivo y no se persiste.

Se incorpora una **nueva colección de veinte retratos ilustrados de adultos** en `public/directorio/avatares-ilustrados-premium.avif` (640×800, 4 columnas × 5 filas). Cada celda de 160×160 corresponde a su posición en `CATALOGO_DEMO`; nombres de mujer en índices pares, hombres en índices impares. No son retratos de odontólogos reales. El recurso anterior queda disponible para contingencia.
