# DentaIA

**Plataforma web de orientación preventiva en salud bucal y búsqueda de profesionales odontológicos.** Proyecto académico del curso Proyecto Final de Carrera III de la Universidad San Ignacio de Loyola (USIL).

DentaIA integra información educativa, registro de rutinas, gestión de solicitudes, análisis orientativo de fotografías y un directorio odontológico en una experiencia web adaptable a dispositivos móviles y de escritorio. Los resultados automatizados son **educativos y no constituyen diagnósticos médicos ni reemplazan una evaluación odontológica**.

- **Aplicación:** https://dent-ai-five.vercel.app/
- **Código y trazabilidad:** https://github.com/Jhanfranco07/DentaIA
- **Evidencias del Avance 02:** [Anexo técnico y matriz de trazabilidad](docs/ANEXO_TECNICO_AVANCE_02.md).

## Funcionalidades implementadas

| Área | Funcionamiento |
| --- | --- |
| Acceso y perfiles | Registro, autenticación y vistas diferenciadas para paciente, odontólogo y administración, con permisos del lado del servidor y de la base de datos. |
| Panel del paciente | Acceso central a orientación, directorio, solicitudes, fotografías, rutinas y contenidos preventivos. |
| Directorio odontológico | Búsqueda, filtros, fichas de profesionales y referencias geográficas. La plataforma distingue datos de demostración de información de servicios reales. |
| Mis solicitudes | Registro, consulta de estado, búsqueda, filtros e historial; las solicitudes de demostración se distinguen de las citas reales. |
| Mis fotografías | Consentimiento, captura o selección, revisión y almacenamiento privado con autorización. |
| Análisis orientativo | Procesamiento de imágenes mediante el servicio Smile V17 y presentación de observaciones educativas sobre características visibles, sujetas a calidad de imagen y al contrato de respuesta. |
| Mis resultados | Consulta de resultados y presentación comprensible de observaciones de orientación. |
| Rutinas preventivas | Registro diario de actividades, avance e historial del paciente. |
| Buenas prácticas | Seis guías educativas, buscador y filtros, temporizador de cepillado y retos de autocuidado. |
| Denti | Asistente conversacional con orientación basada en guías, navegación hacia módulos y servicio generativo opcional cuando está configurado y autorizado; conserva respuestas guiadas como respaldo. |
| Portal odontológico | Funciones diferenciadas para el profesional y acceso a información autorizada. |
| Administración | Herramientas de gestión protegidas por controles de rol y autenticación reforzada. |
| Planes y pagos | Checkout y webhooks de Stripe en entorno de prueba, con registros de persistencia y políticas RLS. |

La asignación de rutinas y el seguimiento clínico mediante consentimiento disponen de componentes de interfaz, API y contratos SQL. Su **habilitación operativa está sujeta a banderas de configuración y controles de autorización**, según [la documentación técnica](docs/arquitectura/DI-207-ACTIVACION-QA-SEGUIMIENTO.md). La implementación de componentes y su activación en un entorno son conceptos diferentes.

## Arquitectura

- **Interfaz y servidor web:** Next.js 15, React 19 y TypeScript; despliegue de la aplicación en Vercel.
- **Autenticación, persistencia y almacenamiento:** Supabase Auth, PostgreSQL, Storage y políticas de seguridad a nivel de fila (RLS).
- **Visión artificial:** microservicio Python/FastAPI con Smile V17 y segmentación Roboflow, integrado mediante rutas controladas. Consulte [el servicio de visión](services/dental-vision/README.md). Este es el componente documentado en la versión actual; no se presenta el detector ONNX retirado como parte del servicio vigente.
- **Asistente:** orientación guiada y uso opcional de OpenAI, con verificaciones de identidad y restricciones de respuesta.
- **Pagos:** Stripe Checkout en modo de pruebas, con verificación de webhooks y persistencia.
- **Control de versiones y calidad:** GitHub y GitHub Actions.

La solución separa presentación, autenticación, lógica de negocio, persistencia, servicios especializados e integraciones. Consulte las [arquitecturas lógica y física](docs/arquitectura/README.md).

## Ejecución local

Requisitos: Node.js 22 o superior, npm y las variables correspondientes a los servicios que se utilizarán. El archivo `.env.example` contiene las referencias públicas y nombres de configuración; no se deben incluir secretos en el repositorio.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Para realizar verificaciones locales:

```bash
npm run typecheck
npm run test
npm run build
```

Las pruebas de base de datos y del backend de visión cuentan con procedimientos específicos dentro del repositorio. Consulte [desarrollo](docs/DESARROLLO.md), [pagos](docs/PAGOS_STRIPE.md) y [pipelines](docs/DEVSECOPS_PIPELINES.md).

## Calidad y DevSecOps

La integración automatizada utiliza `.github/workflows/devsecops.yml`, un **grafo integral de 35 trabajos**. Incluye instalación y compilación, pruebas unitarias y de integración, contratos y regresión, auditoría de dependencias, análisis estático, detección de secretos, controles del backend Python/FastAPI, pruebas PostgreSQL con identidades sintéticas y puertas de calidad bloqueantes. Los workflows individuales se conservan para ejecución manual de diagnóstico.

- [Visualización y resultados de DevSecOps](https://github.com/Jhanfranco07/DentaIA/actions/workflows/devsecops.yml)
- [Ejecución satisfactoria del 23 de noviembre de 2026, hora de Lima](https://github.com/Jhanfranco07/DentaIA/actions/runs/45326102779)
- [Arquitectura y alcance del pipeline](docs/DEVSECOPS_PIPELINES.md)

Los jobs verifican código, contratos, pruebas y disponibilidad según su alcance; **no equivalen por sí solos a validación clínica**, ni a un cobro real ni a una prueba manual completa de todos los recorridos.

## Protección de datos y alcance académico

Las operaciones sensibles requieren autenticación y permisos. Las fotografías cuentan con un flujo de consentimiento; las políticas RLS restringen los registros por propietario y rol. Los resultados educativos no identifican enfermedades ni sustituyen la atención profesional. Las transacciones de demostración se realizan en modo de prueba.

## Documentación y evidencias

- [Anexo técnico del Avance 02: trazabilidad, implementación y resultados](docs/ANEXO_TECNICO_AVANCE_02.md)
- [Arquitectura del sistema](docs/arquitectura/README.md)
- [DevSecOps y controles automatizados](docs/DEVSECOPS_PIPELINES.md)
- [Integración de pagos](docs/PAGOS_STRIPE.md)
- [Desarrollo e instrucciones de equipo](docs/DESARROLLO.md)
- [Experiencia educativa de referencia](docs/PREMIUM_EXPERIENCE.md) (documentación de un incremento anterior).

**Equipo académico:** desarrollo colaborativo de cuatro integrantes, con planificación en Jira y revisiones mediante GitHub.
