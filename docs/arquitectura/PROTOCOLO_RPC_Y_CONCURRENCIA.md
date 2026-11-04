# Contratos de transacción, permisos y concurrencia

**Fase 3:** existe una primera [implementación SQL local](IMPLEMENTACION_SERVICIOS_CLINICOS.md) de concesión/revocación/consulta, con ocho escenarios concurrentes comprobados. Este documento conserva el protocolo global y las operaciones todavía futuras: no hay endpoints Next, descarga auditada ni RPC de IA. El cursor HTTP firmado requiere el futuro adaptador; el SQL solo recibe una tupla sin autoridad sobre los permisos.

Diseño de servicios futuros, no funciones instaladas. No habilitar wrappers clínicos/IA antes de implementar y ensayar estas reglas. Los borradores actuales cierran acceso directo para evitar un despliegue parcialmente abierto.

## Identidad y contexto común

Next.js verifica sesión con el SDK de servidor y usa parámetros cerrados. PostgreSQL vuelve a comprobar cuenta habilitada y rol actual de app_metadata.dentaia, no user_metadata ni claims antiguos de rol. El contexto clínico (membership_id) es una selección que debe pertenecer a professional_accounts.user_id del actor, estar vigente y apuntar a clínica activa. También se exige última verificación aprobada y estado profesional verified. No reutilizar el guard exclusivo de superusuario como si autorizara odontólogos.

Para paciente se deriva patient_records por auth.users.id confirmado. Las funciones privadas no aceptan actor/paciente de terceros como autoridad. Si se usa JWT propio hacia Data API, auth.uid()/auth.jwt() proceden de verificación de PostgREST; si un futuro BFF usa una identidad de servicio, debe diseñar un contexto firmado/acotado y su verificación, no pasar libremente actorId desde JSON. No activar ambas vías sin contrato.

## Lectura de historial

1. Validar UUID, limit 1..50 propuesto y cursor firmado ligado a actor/paciente/membresía/filtros. El cursor no concede permisos.
2. Transacción corta: bloquear identidad vigente; paciente; cuenta profesional/clínica/membresía del lector; concesiones candidatas ordenadas por UUID. Compartir bloqueos con otros lectores y hacerlos incompatibles con revocar/suspender/reasignar.
3. Revalidar después de esperar los locks. El paciente propietario no necesita un permiso autoemitido; el profesional necesita rol, verificación, membresía y al menos un recurso seleccionado de concesión vigente.
4. La autorización depende del contexto receptor, no de que la membresía histórica de origen siga activa. No ocultar datos históricos legítimos porque el profesional de origen se retiró. El origen no se puede reasignar.
5. Seleccionar únicamente atenciones permitidas del paciente. Orden estable `(attended_at DESC,id DESC)`, no OFFSET inestable. Entradas/documentos se filtran por esas atenciones. Retornar las fechas, estados de ausencia y procedencia; no exponer rutas privadas de objetos.
6. Insertar auditoría mínima, preparar la proyección y confirmar la transacción. Next.js no emite/streaming de contenido antes del commit.
7. Denegación: insertar evento con paciente/recursos NULL cuando no estén autorizados y devolver resultado controlado. No lanzar una excepción que revierta el evento que se necesita conservar. Un fallo de auditoría sí falla cerrado y no retorna contenido; se registra error técnico saneado fuera del contenido, si ese canal está disponible.

Orden común propuesto: identidades UUID; paciente; profesional/clínica/membresía; concesiones UUID; recursos. Validar el mismo orden en escrituras. Timeouts/deadlocks se tratan como indisponibilidad/reintento seguro, no como permiso concedido.

## Concesión y revocación

Creación solo por paciente autenticado. Para no inventar otra tabla de idempotencia, el UUID Idempotency-Key de la creación se utiliza como `clinical_access_grants.id`. Bajo bloqueo exclusivo del paciente, una clave ya existente solo devuelve la concesión del mismo paciente y parámetros/recursos exactamente iguales; otro contenido o propietario produce 409 genérico. No se devuelve información de otra cuenta por colisión de claves.

Validar destinatario habilitado, propósito/versión aprobados, fecha de vencimiento y el conjunto no vacío de atenciones del mismo paciente. Bloquear recursos en orden, crear concesión, recursos y auditoría en una transacción. Las políticas/textos válidos deben configurarse por el equipo; una cadena cualquiera del cliente no acredita aprobación del consentimiento. No hay RPC operativo que acepte textos inventados.

Revocar deriva el propietario, bloquea paciente y concesión en modo exclusivo y marca revoked_at una sola vez con el reloj del servidor. Registrar resultado y commit antes de confirmar. No cambiar destinatario, fechas originales o scope ni borrar evidencia. Repetir la revocación devuelve el mismo estado sin reactivar. Una ampliación de recursos o nueva corrección requiere otra concesión explícita.

**Punto de linealización:** si la lectura obtiene el bloqueo válido y se confirma antes que la revocación, puede completar su respuesta. Si la revocación se confirma primero, nuevas lecturas no obtienen contenido. No se promete cortar una respuesta/descarga ya autorizada ni retirar bytes vistos. Cada página y nueva descarga revalida; no hay caché compartida. Una URL firmada funciona hasta expirar, por eso no satisface revocación instantánea.

## Descarga clínica

Resolver documento por ID bajo los mismos permisos; no aceptar bucket/path libres. Verificar pertenencia, disponibilidad, MIME/tamaño y almacenar auditoría antes de abrir el stream. Proxy Next.js con no-store; no persistir ni devolver URL pública. El blob puede faltar aunque haya metadatos: devolver estado explícito sin otro archivo de fallback. La seguridad del objeto requiere política de bucket privada propia; una FK no configura Storage.

## Solicitudes propias del profesional

Nuevo servicio propuesto valida profesional Auth, verificación y ficha dentists vinculada. Solo consulta `appointment_requests.dentist_id = professional_accounts.dentist_id`; no por user_id del paciente ni IDs suministrados para elegir otro profesional. La RLS actual del paciente se conserva. El servicio auditado proyecta datos mínimos de la solicitud; no concede historial. Como no existe clínica destino, no filtra inventando clinic_id. Si el equipo necesita reparto por sede, debe decidir una ampliación explícita antes de ofrecer esa función.

## IA y trabajo reservado

El propietario concede análisis para su foto: se comprueba el triple autorización/foto/usuario mediante FK compuesta y vigencia por servicio. Crear job con Idempotency-Key compara también modelo/autorización/foto; no devuelve un job de otro propietario. Reclamar usa lock de fila y SKIP LOCKED si se adopta cola PostgreSQL, fija lease_id privado, vencimiento y attempt_count. Un nuevo lease solo reemplaza otro vencido; una renovación no incrementa intentos.

El trabajador no recibe acceso administrativo general. Antes de leer bytes y antes de publicar resultado revalida foto, autorización y lease vigente. Completa mediante compare-and-set del lease_id esperado bajo lock, inserta como máximo un resultado y cambia estado a succeeded en una transacción. Los triggers diferidos exigen consistencia resultado/estado. Revocar impide nuevas entregas y cancela trabajos pendientes; no garantiza deshacer computación ya realizada. Un propietario que borra su foto provoca CASCADE del análisis privado, sin bloquear el flujo actual ni afectar datasets.

Los RPC de trabajador, identidad mínima, cancelación, reconciliación y validación de binarios siguen por implementar y probar antes de otorgar EXECUTE. El SQL no simula un servicio ya existente ni produce métricas.
