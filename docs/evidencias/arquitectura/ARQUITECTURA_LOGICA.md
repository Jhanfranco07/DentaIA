# Arquitectura lógica

## Estado actual y objetivo

Se propone un monolito modular Next.js para presentación y servicios de negocio, conservando Supabase Auth, PostgreSQL y Storage. El servicio de visión es un límite futuro; no existe un backend Python/FastAPI, Docker o proveedor de inferencia actual demostrado en las ramas inspeccionadas. No se justifica añadir microservicios para el MVP sin necesidad medida.

| Capa | Actual comprobado | Responsabilidad objetivo |
|---|---|---|
| Presentación | App Router, React, CSS Modules; cliente Supabase en módulos personales | Pantallas por rol, mensajes, accesibilidad y estado; nunca autoridad de permisos |
| Aplicación | Funciones de cuenta, solicitudes, fotos; Route Handlers admin en rama | Casos de uso, validación, sesión y traducción de errores |
| Negocio | Reglas personales y contrato de roles; historial sintético en rama | Propiedad, membresía, concesión, procedencia, versiones y transiciones |
| Identidad | Auth; guard servidor admin getUser/getClaims | Un login común, rol vigente; MFA para administración; paciente no requiere AAL2 global por defecto |
| Acceso a datos | SDK navegador con RLS; adaptadores admin server-only | Puertos separados para personales, administrativos, clínicos e IA |
| Persistencia | Cinco tablas public | Conservarlas y ampliar por dominios según el modelo; no duplicar fuente de roles |
| Archivos | dental-photos privado, 8 MiB | Fotos propias; documentos clínicos separados; validación MIME y contenido |
| Integración | Supabase y GitHub/Vercel | API explícita; sin interoperabilidad externa clínica asumida |
| Visión futura | Demo de casos reconocidos, sin inferencia de imagen arbitraria | Modelo versionado, trabajos, calidad, evaluación y resultado orientativo |

## Dependencias y límites de módulos

- Identidad no depende de interfaz clínica. Administración reutiliza identidad y no obtiene permiso clínico por ser superusuario.
- Paciente utiliza cuenta, fotos, solicitudes y resultados educativos disponibles. El historial de solicitudes no se convierte en historia clínica.
- Profesional utiliza la misma identidad, ficha pública vinculada, membresía verificada y concesiones del paciente. El proveedor sintético actual se reemplaza detrás de un puerto: el parámetro de escenario del navegador nunca decide un permiso real.
- Clínica/historial encapsula consulta, permisos y auditoría en un servicio con acceso mínimo. Un módulo público no importa adaptadores privilegiados.
- Directorio solo publica información verificada para publicación o claramente sintética; no expone perfiles Auth privados.
- Fotografías valida y recupera fallos entre Storage y metadatos. Análisis no puede consumir una foto solo porque exista consentimiento de almacenamiento.
- IA no escribe diagnósticos profesionales ni entradas clínicas; produce recomendaciones educativas con incertidumbre y referencias de modelo.

## Flujos de información

El flujo personal existente es navegador → SDK → Auth/Data API/Storage con JWT y RLS. El administrativo de rama es navegador → endpoint → guard → adaptador mínimo de servidor. El flujo clínico propuesto es navegador → endpoint → servicio autorizado/auditoría → PostgreSQL; no devolver un caso completo y filtrarlo después en React. La fase de inferencia futura recibe un trabajo autorizado, accede a una sola imagen y devuelve un resultado versionado; no recibe un cliente administrativo general.

## Contratos comunes para coordinar

Identidad se refiere a auth.users.id; paciente clínico usa patient_records.id; profesional usa professional_accounts.id y membership_id. No intercambiar estos UUID aunque tengan el mismo tipo. Los DTO devuelven origen, versión y disponibilidad, con fechas de atención/registro separadas. El contexto de clínica enviado por la UI es una solicitud, validada contra la identidad en servidor. Todo error externo incluye request_id y código estable sin secretos.

No sustituir inmediatamente el transporte Bearer de DI-150 por cookies SSR. Si se requiere navegación SSR privada a /admin, definir cookies HttpOnly/Secure/SameSite, PKCE y CSRF mediante ADR, sin almacenar dos sesiones ni confiar en middleware como autorización final.

Ver [diagramas de lógica y componentes](DIAGRAMAS.md), [contratos](CONTRATOS_API.md) y [matriz de seguridad](SEGURIDAD_Y_ROLES.md).
