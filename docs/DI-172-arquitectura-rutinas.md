# DI-172 — Arquitectura mínima de rutinas

## Alcance y contenido preventivo

El catálogo inicial será común para pacientes, determinista y educativo. Se organiza por mañana, durante el día y noche. Incluye cepillado suave con pasta fluorada mañana y noche, limpieza interdental diaria y cepillado nocturno. Los textos son hábitos generales; no interpretan hallazgos clínicos ni indican tratamientos.

La ruta del producto es `/paciente/rutinas` y vive dentro del grupo de layout `(paciente)`. El menú del portal enlaza a ella bajo “Mi cuidado dental”. La entrada requiere sesión válida y rol paciente según `app_metadata.dentaia`.

## Registro, fecha e historial

Cada marca corresponde a paciente, actividad versionada y fecha local `America/Lima`. Solo se permite marcar o desmarcar el día actual; el historial es de solo lectura. La restricción única paciente/actividad/fecha y `upsert` idempotente evitan duplicados. El desmarcado elimina únicamente la marca propia.

El progreso diario se calcula como marcas actuales / actividades del plan vigente para esa fecha. Los días del historial muestran sus marcas con el denominador del plan efectivo en esa fecha. Los planes publicados y sus actividades son inmutables; cada cambio del catálogo crea una versión con fecha de vigencia. Así los porcentajes históricos no se reinterpretan con el catálogo nuevo.

## Proveedores de planes

`ProveedorPlanesRutina` expone `obtenerPlan(fecha, catalogo)`, con `origen`, `version` y lista de actividades por claves estables del catálogo. El proveedor general actual selecciona la versión vigente de forma determinista. Una futura fuente individual deberá devolver el mismo contrato; el validador rechaza claves desconocidas o duplicadas. No hay conexión al modelo IA en DI-172.

## Permisos

El cliente vuelve a validar `auth.getUser()` y rol paciente antes de cada operación. PostgreSQL limita lectura/escritura con RLS a `auth.uid()`, al rol paciente activo y al día local actual para escrituras. Los pacientes solo reciben `SELECT` sobre catálogo, e `INSERT`/`DELETE` sobre sus marcas; no tienen privilegios de administración de planes.

## Pruebas

Usar IDs sintéticos y clientes mock para reglas puras/UI. Las políticas RLS requieren proyecto Supabase local o QA aislado con cuentas y JWT de prueba; los mocks no acreditan RLS real. No ejecutar estas verificaciones contra producción.
