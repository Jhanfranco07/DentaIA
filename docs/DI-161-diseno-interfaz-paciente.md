# DI-161 — Diseño de la interfaz del paciente

- **Historia:** DI-146 — Vista del paciente
- **Subtarea:** DI-161 — Diseñar la interfaz del paciente
- **Responsable:** Angie Jara
- **Fechas previstas:** 30/10/2026 – 31/10/2026
- **Rama:** `feature/vista-paciente`
- **Base:** requisitos de [DI-160](./DI-160-requisitos-vista-paciente.md)

## 1. Alcance

Diseño de la interfaz del panel personal del paciente y de su navegación hacia cuenta, fotografías y solicitudes, con estados accesibles. Esta subtarea **no consulta datos**: el resumen con información real y la integración de componentes corresponden a DI-162.

Quedan fuera de alcance: resultados odontológicos propios, historial clínico, funcionalidades del odontólogo y cualquier cambio en tablas, RLS o archivos compartidos.

## 2. Estructura implementada

| Elemento | Archivo | Descripción |
|---|---|---|
| Ruta `/panel` | `src/app/(modulos)/panel/page.tsx` | Página que monta el panel |
| Panel | `src/features/panel/PanelPaciente.tsx` | Cabecera y navegación a tres secciones |
| Estados | `src/features/panel/EstadoPanel.tsx` | Componente reutilizable de carga, vacío y error |
| Estilos | `src/features/panel/panel.module.css` | CSS Module propio del panel |

Todo está en carpetas nuevas. No se modificaron `Encabezado.tsx`, `navegacion.ts`, `globals.css`, el layout global ni el cliente de Supabase.

## 3. Secciones y navegación

| Sección | Destino | Módulo que lo implementa |
|---|---|---|
| Mi cuenta | `/cuenta` | Cuenta (`src/features/cuenta/`) |
| Mis fotografías | `/fotografias` | Fotografías (`src/app/(modulos)/fotografias/`) |
| Mis solicitudes | `/solicitudes` | Solicitudes (`src/features/solicitudes/`) |

El panel solo enlaza; no duplica registro, galería ni solicitudes. Cada módulo conserva su propia gestión de sesión y de acceso.

## 4. Estados accesibles

`EstadoPanel` define tres estados para usar en DI-162:

| Estado | Atributo ARIA | Uso previsto |
|---|---|---|
| Cargando | `role="status"` | Mientras se consultan datos propios |
| Vacío | `role="status"` | Sin fotografías o sin solicitudes |
| Error | `role="alert"` | Fallo de consulta, con mensaje comprensible y sin texto técnico |

Estos estados todavía **no se muestran en la página**, porque en esta etapa no hay consultas.

## 5. Accesibilidad y diseño responsive

Criterios aplicados y su verificación:

| Criterio | Resultado | Cómo se comprobó |
|---|---|---|
| Enlaces con nombre accesible distinto | Cumple | Consola: `Ir a mi cuenta: Mi cuenta`, `Ir a mis fotografías: Mis fotografías`, `Ir a mis solicitudes: Mis solicitudes` |
| Área táctil de al menos 44 px de alto | Cumple (44 px) | Consola, `getBoundingClientRect` |
| Navegación identificada | Implementado | `nav` con `aria-label` |
| Foco visible | Implementado en CSS | Por confirmar con la tecla Tab y captura |
| Una columna en móvil | Implementado en CSS (`max-width: 760px`) | Ver capturas |
| Tipado | Sin errores | `npm run typecheck` |

## 6. Evidencias

- Captura a 1440 px: `docs/evidencias/panel/panel-1440.png`
- Captura a 375 px: `docs/evidencias/panel/panel-375.png`
- Commit de la estructura inicial: `d98b804`

## 7. Pendientes y límites reales

- No se ha confirmado con Jhan la ruta `/panel` ni cómo se enlazará desde la navegación compartida.
- El feedback del profesor no se ha incorporado.
- La coordinación con Anelis sobre el contrato de información compartida no se ha realizado.
- El contraste de colores se tomó del directorio y no se ha medido en el panel.
- El resumen con datos reales, la integración de recomendaciones y los resultados quedan para DI-162 y DI-163.
- No se ha realizado validación con usuarios.

## 8. Criterios de aceptación de DI-161

1. El panel es navegable y enlaza a cuenta, fotografías y solicitudes.
2. Los enlaces son accesibles por teclado y lectores de pantalla.
3. El diseño se adapta a una columna en 375 px.
4. Existen componentes de estado reutilizables.
5. No se modificaron archivos compartidos ni de otros módulos.
6. Las evidencias (commit y capturas) están registradas y los límites quedan declarados.
