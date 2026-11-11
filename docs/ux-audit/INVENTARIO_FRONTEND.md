# Inventario frontend — Sprint 6

Base: `main` en `244643b4a6f2feb35674119e81e32a4a4bb84c70`. Next.js 15 App Router, React 19, TypeScript, CSS global + CSS Modules. Esta revisión es de código y documentación existente; no certifica comportamiento de navegador o flujos remotos.

| Área | Ruta / implementación | Estado observado |
| --- | --- | --- |
| Landing | `src/app/(public)/page.tsx`, `home.module.css` | Hero con imagen local optimizada, acciones hacia cuenta, directorio y profesional; contenido distingue alcance académico. |
| Login y registro | `src/app/cuenta/page.tsx`, `src/features/cuenta/Cuenta.tsx` | Formulario con modos, validación, Supabase Auth y mensajes de error. |
| Paciente | `src/app/(paciente)/panel`, `solicitudes`, `resultados`, `analisis` | Panel, solicitudes, preparación de fotografías y estados de resultados; el análisis automatizado no está disponible. |
| Fotografías | `src/app/(paciente)/fotografias/page.tsx` | Consentimiento, selección/cámara, vista previa, validación, almacenamiento privado y eliminación; requiere sesión y servicio. |
| Directorio | `src/app/(public)/directorio`, `src/features/directorio` | Lista, detalle, filtros, estados vacíos/error, reseñas y mapa MapLibre con teselas OSM. Datos demo se identifican; no hay 20 perfiles cargados por esta auditoría. |
| Profesional | `src/app/(odontologo)/profesional`, `src/features/profesional` | Vistas demo y clínica sujetas a permisos; solicitudes, pacientes e historial autorizado según configuración. |
| Administración | `src/app/(administracion)/administracion`, `src/features/administracion` | Panel, usuarios, ubicaciones, reseñas, vinculaciones y estados de acceso; las restricciones de entorno y MFA/AAL2 siguen vigentes. |
| Perfil | `src/features/cuenta/PerfilPaciente.tsx`, `Cuenta.tsx` | Perfil y navegación según rol. |

## Estructura compartida

- `src/app/layout.tsx` define idioma español y enlace de salto al contenido.
- Los grupos público, paciente y odontólogo tienen layouts propios. `PortalShell.tsx` y `navegacion-portal.ts` comparten navegación de portales; `Encabezado.tsx` y `Pie.tsx` sirven al público.
- `globals.css` contiene tokens iniciales, foco visible, breakpoints y reducción de movimiento. Los módulos CSS agregan estilos por área.
- `Identidad.tsx`, `TarjetaAccion.tsx` y `TarjetaMetrica.tsx` son piezas reutilizables.

## Límites funcionales

El mapa ya existe: la propuesta de Sprint 6 debe mejorar su uso con lista equivalente y datos verificados, no crear otro mapa. Los 20 perfiles odontológicos son una iniciativa futura; requieren fuente, consentimiento de publicación y rotulado demo antes de cargar registros. Ninguna vista de IA debe presentar contenido educativo o sintético como diagnóstico real.

