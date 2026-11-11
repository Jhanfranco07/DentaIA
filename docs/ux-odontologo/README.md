# Portal odontológico · Sprint 6

La mejora se concentra en `/profesional`, el espacio de trabajo de la cuenta con rol de odontólogo. La clínica activa determina el alcance de cada consulta.

## Diagnóstico y cambios

| Área | Comportamiento anterior | Mejora |
| --- | --- | --- |
| Inicio | El aviso técnico precedía a la selección de clínica. | La clínica encabeza el recorrido y hay accesos directos a solicitudes, historial y perfil. |
| Solicitudes | Filas repetitivas con fecha ISO y el mismo tratamiento visual para ambos estados. | Fecha legible en español peruano, hora preferida cuando existe y estados textuales diferenciados. La vista se identifica como demostración y de solo lectura. |
| Pacientes e historial | El estado vacío podía aparecer junto con una instrucción imposible de completar. | Se muestra una indicación pertinente al estado de la lista. La consulta sigue asociada al paciente autorizado y a la clínica activa. |
| Perfil | El enlace público se mezclaba con el selector de clínica. | Sección con acceso al directorio si hay un perfil vinculado y acceso a Mi cuenta. La ficha pública existente conserva el nombre, las especialidades y otros datos publicados. |
| Navegación | En móvil el foco regresaba al menú incluso al elegir una sección. | Al cerrar con Escape, el foco vuelve al botón. Al elegir una sección, pasa al destino. Los controles principales tienen una altura mínima de 44 px. |

La auditoría partió de [la revisión UX anterior](../ux/OPTIMIZACION_EXPERIENCIA.md) y del contrato del [espacio clínico](../../src/features/profesional/INTEGRACION_CLINICA.md). Se aplicó Frontend Design para conservar el azul oscuro, el verde azulado, las superficies claras y la tipografía de DentaIA. La consulta local de UI/UX Pro Max orientó el foco visible, la legibilidad, los estados textuales y el espaciado táctil. Se priorizó la tarea clínica sobre la propuesta automática de un portal corporativo.

## Alcance funcional

El perfil profesional y las membresías proceden del servicio existente. La lista muestra solicitudes de demostración asignadas con los estados solicitada y cancelada. La interfaz existente carece de filtros, búsqueda, edición profesional y transiciones de solicitudes. La consulta del historial y el detalle desplegable siguen siendo de lectura y dependen del consentimiento vigente. Los endpoints, roles, autorización, Auth, RLS, esquema y servicios de visión permanecen intactos.

## Archivos

- `src/features/profesional/ProfesionalClinico.tsx` y `profesional.module.css` contienen la jerarquía, secciones, mensajes y presentación del portal.
- `src/components/PortalShell.tsx`, `navegacion-portal.ts` y `portal-shell.module.css` contienen los cambios de navegación y foco.
- `scripts/qa-ux-odontologo.py` verifica el recorrido profesional con fixtures. `scripts/qa-ux.py` actualiza la referencia a la etiqueta del selector.

## Evidencias

Capturas completas de Chromium con una cuenta, clínica y solicitudes sintéticas.

| Ancho | Antes | Después |
| --- | --- | --- |
| 320 px | [Captura](evidencias/antes/profesional-320.png) | [Captura](evidencias/despues/profesional-320.png) |
| 390 px | [Captura](evidencias/antes/profesional-390.png) | [Captura](evidencias/despues/profesional-390.png) |
| 768 px | [Captura](evidencias/antes/profesional-768.png) | [Captura](evidencias/despues/profesional-768.png) |
| 1024 px | [Captura](evidencias/antes/profesional-1024.png) | [Captura](evidencias/despues/profesional-1024.png) |
| 1440 px | [Captura](evidencias/antes/profesional-1440.png) | [Captura](evidencias/despues/profesional-1440.png) |

La línea base corresponde a `fe52e7f` en Next dev y muestra su indicador. Las capturas posteriores corresponden al build local de producción. Los informes están en [antes](evidencias/antes/resultado.json) y [después](evidencias/despues/resultado.json).

## Validación

- `npm run typecheck` y `npm run build` completados.
- 454 pruebas existentes aprobadas, incluidas las integraciones locales simuladas.
- `npm audit` informó 0 vulnerabilidades.
- 12 comprobaciones del portal profesional en Chromium con movimiento reducido. Incluyen los cinco anchos, navegación por teclado, perfil vinculado, bloqueo sin sesión y con rol paciente, error de solicitudes y respuestas 200 y 403 del historial.

- 76 comprobaciones de regresión general en Chromium con el arnés existente, ejecutado en Next dev con el Chromium instalado por Playwright en Windows.

Para reproducir, compilar y arrancar Next en `127.0.0.1:3180` con `NEXT_PUBLIC_SUPABASE_URL=https://ux-fixtures.supabase.co` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture`. Con Python y Playwright/Chromium disponibles, ejecutar:

```sh
python scripts/qa-ux-odontologo.py --output docs/ux-odontologo/evidencias/despues
```

## Riesgos y límites

La navegación usa el contenedor compartido del portal. La cobertura comprueba el destino del foco en móvil y la sección activa en escritorio. Las pruebas usan sesión y respuestas HTTP sintéticas, incluida la denegación 403. Queda pendiente una prueba con una cuenta profesional autorizada y datos de prueba en un entorno remoto, además de revisar el historial con atenciones en un dispositivo táctil y con lector de pantalla. La edición de la ficha y la gestión de estados de solicitudes dependen de los flujos autorizados que el producto habilite.
