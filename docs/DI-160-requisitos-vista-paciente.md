# DI-160 — Requisitos de la vista del paciente

- **Historia:** DI-146 — Vista del paciente
- **Subtarea:** DI-160 — Analizar requisitos de la vista del paciente
- **Responsable:** Angie Jara
- **Fecha:** 30/10/2026
- **Rama:** `feature/vista-paciente`
- **Estado de este documento:** borrador para revisión. Las afirmaciones están respaldadas por archivos leídos; lo que no se pudo leer figura como **por verificar**.

## 1. Objetivo de DI-160

Definir los requisitos funcionales y no funcionales del panel personal del paciente a partir de lo que **realmente existe** en `main` (commit `183113b`), clasificarlos como existentes, parciales o pendientes, e inventariar los módulos reutilizables. Este análisis es la base de DI-161 (diseño de la interfaz) y DI-162 (componentes funcionales).

No se amplía el alcance de DI-146. No se declara terminada ninguna funcionalidad sin evidencia. El prototipo es académico, usa datos ficticios y no emite diagnósticos.

## 2. Diagnóstico del sistema actual

**Arquitectura.** Next.js con TypeScript y CSS Modules. El acceso a Supabase se hace desde componentes cliente (`"use client"`) con `getSupabaseBrowserClient` de `src/lib/supabase/browser.ts`; los tipos de las tablas están en `src/lib/supabase/database.types.ts`. La autorización real descansa en RLS de Supabase, no en el estado del navegador.

**Rutas del grupo `(modulos)`** (según `git ls-files`): `/cuenta`, `/directorio`, `/directorio/[id]`, `/fotografias` y `/solicitudes`. El layout `src/app/(modulos)/layout.tsx` solo envuelve el contenido en un contenedor; **no contiene menú de navegación**. No existe ninguna ruta ni carpeta de "panel del paciente".

**Sesión y perfil.** `src/features/cuenta/PerfilPaciente.tsx` recibe el usuario autenticado, lee su perfil con `leerPerfil`, permite crearlo o actualizar el nombre con `guardarPerfil` y valida el nombre con `validarNombre`. El correo se muestra pero no se modifica. Los metadatos de usuario solo se usan para proponer un nombre inicial, nunca para autorizar. Existen estados de carga, error, aviso de guardado y reintento.

**Fotografías.** `src/app/(modulos)/fotografias/page.tsx` implementa consentimiento explícito (`patient_consents`), subida privada al bucket `dental-photos` con ruta `user.id/consent.id/UUID.extension`, registro en `dental_photos`, visualización mediante descarga y URL temporal local, eliminación con `src/features/fotografias/eliminar.ts`, revocación de consentimiento y captura con cámara. Valida tipo JPG/PNG/WebP y tamaño de 1 byte a 8 MB. Tiene estados de carga, sin sesión (enlace a `/cuenta`), error, éxito y galería vacía. La propia pantalla indica que no se analizan fotografías ni se realizan diagnósticos.

**Solicitudes.** `src/features/solicitudes/solicitudes.ts` consulta `appointment_requests` filtrando por `user_id` y `is_demo = true`, ordenadas por fecha descendente, y cancela solo solicitudes propias en estado `requested`. Los únicos estados son `requested` y `cancelled`. `MisSolicitudes.tsx` muestra la lista con botón de cancelar (leído solo parcialmente).

**Resultados y recomendaciones.** Existe un recorrido de demostración en `src/features/analisis/` (`Demostracion.tsx`, `casos.ts`, `flujo.ts`, `pdf.ts`), enlazado desde fotografías hacia `/analisis/demo`. La documentación del repositorio indica que es una demostración sin análisis clínico real. **No se encontró persistencia de resultados por paciente** en los archivos revisados. Contenido de estos archivos: **por verificar**.

**Navegación.** `src/lib/navegacion.ts` solo contiene utilidades de enlaces internos hacia solicitudes (`enlaceSolicitud`, `retornoSolicitud`, `contextoReporte`). La guía del equipo afirma que la navegación entre módulos está en el layout del grupo, pero el layout leído no la incluye. Si existe en `src/components/Encabezado.tsx`: **por verificar**.

## 3. Requisitos funcionales

| ID | Requisito | Estado |
|---|---|---|
| RF-01 | El paciente visualiza su información personal (correo y nombre guardado). | Existente (`PerfilPaciente.tsx`) |
| RF-02 | El paciente puede crear o actualizar su nombre. | Existente |
| RF-03 | El paciente consulta sus fotografías privadas, las abre y las elimina. | Existente (`fotografias/page.tsx`) |
| RF-04 | El paciente gestiona su consentimiento (otorgar y revocar). | Existente |
| RF-05 | El paciente revisa sus solicitudes de demostración y puede cancelarlas. | Existente (`MisSolicitudes.tsx`, `solicitudes.ts`) |
| RF-06 | El paciente navega entre cuenta, fotografías y solicitudes desde un panel único. | Pendiente |
| RF-07 | El paciente ve un resumen de su actividad (cantidad de fotografías, estado del consentimiento, solicitudes). | Pendiente |
| RF-08 | El paciente accede a recomendaciones preventivas. | Parcial: demostración en `/analisis/demo`, sin vínculo con datos propios |
| RF-09 | El paciente consulta resultados odontológicos propios. | Pendiente. Depende de DI-42 y de definir contrato de datos. No hay persistencia identificada |
| RF-10 | Cada sección muestra estados de carga, vacío y error. | Parcial: existe en cada módulo; falta unificar en el panel |
| RF-11 | El paciente solo ve información autorizada; sin sesión se le dirige a `/cuenta`. | Existente en los módulos; el panel debe respetarlo |

## 4. Requisitos no funcionales

- **Seguridad y privacidad:** acceso mediante sesión y RLS; sin URLs públicas de fotografías; sin claves en el frontend; sin datos clínicos reales.
- **Accesibilidad:** etiquetas en formularios, `role="alert"` y `role="status"` para mensajes, foco visible, navegación por teclado, enlaces con nombre distinguible, áreas táctiles de al menos 44 px (criterio aplicado en el directorio).
- **Responsive:** utilizable desde 375 px de ancho.
- **Facilidad de navegación:** acceso a cada sección en un clic desde el panel y regreso claro.
- **Rendimiento:** consultas acotadas a datos propios; sin cargar imágenes hasta que el usuario lo pida (patrón actual de fotografías).
- **Manejo de errores:** mensajes comprensibles en español, sin texto técnico ni instrucciones de desarrollo (criterio aplicado en el directorio).
- **Reutilización:** el panel enlaza o compone lo existente y no duplica registro, galería ni solicitudes.

## 5. Matriz de funcionalidades y estado

| Funcionalidad | Archivo de respaldo | Estado |
|---|---|---|
| Sesión y perfil | `src/features/cuenta/PerfilPaciente.tsx` | Existente |
| Galería privada y consentimiento | `src/app/(modulos)/fotografias/page.tsx` | Existente |
| Eliminación de fotografías | `src/features/fotografias/eliminar.ts` | Existente |
| Solicitudes propias y cancelación | `src/features/solicitudes/solicitudes.ts` | Existente |
| Directorio y detalle | `src/features/directorio/` | Existente |
| Panel con navegación unificada | — | Pendiente |
| Resumen de actividad | — | Pendiente |
| Recomendaciones preventivas personales | `src/features/analisis/` (demo) | Parcial |
| Resultados odontológicos propios | — | Pendiente |

## 6. Reglas de acceso a la información personal

1. Todos los datos del panel se consultan con sesión activa; sin sesión se muestra una invitación a iniciar sesión en `/cuenta`.
2. Las consultas se filtran por el usuario autenticado (`user_id`) y RLS impide leer registros ajenos.
3. Las fotografías están en un bucket privado y solo se muestran mediante URL temporal local, revocada al terminar.
4. Las solicitudes mostradas son únicamente las propias y de demostración (`is_demo = true`).
5. El panel no modifica tablas, políticas RLS ni permisos.
6. No se muestran ni documentan credenciales, claves ni datos clínicos reales.

## 7. Componentes reutilizables

| Componente o utilidad | Ubicación | Uso en el panel |
|---|---|---|
| `PerfilPaciente` | `src/features/cuenta/PerfilPaciente.tsx` | Sección de perfil |
| Utilidades de perfil y validación | `src/features/cuenta/perfiles.ts`, `validaciones.ts` | Por verificar al integrar |
| Sesión | `src/features/cuenta/useSesion.ts` | Por verificar su contrato antes de usarlo |
| `MisSolicitudes` | `src/features/solicitudes/MisSolicitudes.tsx` | Sección de solicitudes |
| `obtenerMisSolicitudes` | `src/features/solicitudes/solicitudes.ts` | Resumen de solicitudes |
| Galería y consentimiento | `src/app/(modulos)/fotografias/page.tsx` | Hoy está dentro de la página; el panel debe enlazar, no copiar |
| `Encabezado`, `Pie`, `Reveal` | `src/components/` | Estructura compartida (solo lectura) |
| `getSupabaseBrowserClient` | `src/lib/supabase/browser.ts` | Cliente compartido (no modificar) |

## 8. Dependencias y riesgos técnicos

**Dependencias**
- Autenticación existente de `/cuenta` (Jhan).
- Servicios de Supabase: tablas `profiles`, `patient_consents`, `dental_photos`, `appointment_requests` y bucket `dental-photos`.
- DI-36 persistencia y autorización; DI-37 fotografías; DI-42 reporte educativo.
- Contrato de información compartida con Anelis (solicitudes).
- Futuras funcionalidades del odontólogo: fuera de alcance de DI-146.

**Riesgos**
- La galería está dentro de `page.tsx` y no es un componente importable; reutilizarla sin duplicar exige enlazar a `/fotografias` o coordinar una extracción con Stephan.
- Una ruta nueva para el panel y su navegación pueden requerir tocar archivos compartidos (`Encabezado.tsx`, `navegacion.ts`, layout). Debe acordarse con Jhan.
- No hay fuente de datos para resultados odontológicos propios; mostrarlos sin contrato sería inventar funcionalidad.
- Los datos y perfiles son ficticios y el análisis es demostrativo: el panel no debe sugerir diagnóstico.
- Jhan modificó recientemente `navegacion.ts`, `Encabezado.tsx` y `page.tsx`; hay riesgo de conflictos.
- El feedback del profesor no estaba disponible al redactar este documento y no se incorporó.

## 9. Criterios de aceptación

1. El documento está en `docs/DI-160-requisitos-vista-paciente.md` y es revisable.
2. Cada requisito está clasificado como existente, parcial o pendiente.
3. Cada afirmación sobre el código remite a un archivo real del repositorio.
4. No contiene credenciales ni datos clínicos personales.
5. No se modificó ningún archivo funcional ni de otros integrantes.
6. Los puntos marcados como "por verificar" se resuelven antes de la revisión del 05/11/2026.
7. La conformidad con el feedback del profesor queda pendiente hasta contar con su texto.

## 10. Conclusiones y recomendaciones para DI-161

- El paciente ya cuenta con perfil, fotografías y solicitudes funcionando por separado. Lo que falta es un **panel que los reúna** y una navegación común.
- DI-161 debe diseñar: encabezado del panel, navegación a cuenta, fotografías y solicitudes, tarjetas de resumen y estados de carga, vacío y error accesibles.
- Mantener fuera del alcance los resultados odontológicos propios hasta que DI-42 defina su contrato.
- Antes de crear la ruta del panel, acordar con Jhan dónde vive y cómo se integra en la navegación.
- Reutilizar lo existente mediante enlaces o componentes importables; no duplicar registro, galería ni solicitudes.
- Aplicar en el panel los criterios ya validados en el directorio: nombres accesibles, áreas táctiles de 44 px y mensajes de error sin texto técnico.
