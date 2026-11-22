# Integración del inicio animado con los avances de main

Base integrada: `4994b13` (incluye PR #90 a #98).
Rama de trabajo: `feature/angie-entrada-diente`.

Se conserva el nuevo inicio editorial y el carrusel de campaña de main.
La entrada animada de DentaIA se renderiza antes de ese contenido, con fondo
`#0A2358`, anillo y revelado mediante la silueta del diente, sin botón.
El conflicto de `src/app/(public)/page.tsx` se resolvió conservando la página
actual de main e incorporando solamente la entrada.

## Comprobaciones realizadas

- Instalación con `npm ci` y compilación con `npm run build`: correctas.
- Suite Node de unitarias: 512 pruebas correctas.
- Vitest (configuración del proyecto): 106 pruebas correctas.
- Integración: 11; contratos: 16; regresión: 4; todas correctas.
- Motor y avisos de Denti, ejecutados mediante configuración temporal que
  incluye `src/features/asistente/**/*.test.ts`: 16 pruebas correctas.
- HTML prerenderizado: incluye la entrada antes de la nueva portada.

No se pudo iniciar Chromium en este entorno. Queda pendiente verificar en
navegador la transición, el carrusel, el directorio y Denti. Las comprobaciones
automatizadas no acreditan una prueba contra la base de datos o un proveedor
LLM reales. No se aplicaron migraciones a Supabase ni se modificaron secretos.
