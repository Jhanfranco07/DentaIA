# Directorio dentro del portal paciente

Ruta protegida: `/panel/odontologos`; fichas: `/panel/odontologos/[id]`. Reutiliza el mismo catálogo y la consulta Supabase que el directorio público; **no** duplica datos ni modifica las políticas.

Los 20 perfiles identificados en `CATALOGO_DEMO` son **ficticios** y no se atribuye a ellos una actividad clínica real, reseñas, distancias ficticias, verificación profesional ni relación laboral con los centros publicados. Los centros son referencias independientes.

Las ilustraciones son originales, de estilo profesional adulto, y se asignan exclusivamente a los 20 personajes de ejemplo. La presentación «Dra.»/«Dr.» es una decisión creativa del catálogo ficticio, no una inferencia de género de personas reales. Los perfiles reales no reciben avatares inventados.

El radar es decorativo; al pulsar «Usar mi ubicación» el navegador solicita permiso. Solo tras obtener coordenadas válidas se anima el marcador del dispositivo en el mapa y se ordenan ubicaciones por distancia geodésica (línea recta), sin almacenarlas en Supabase. La distancia no equivale a un recorrido por carretera.

Se mantiene el directorio público `/directorio`, mientras el portal paciente abre su propio módulo. `main` y `develop` deben sincronizarse únicamente después de validación de CI.
