# Fase 8 — inventario sintético para autorización separada

Fecha: 03/11/2026, America/Lima. Dental-IA `vwmdknzjyvmsdqpepykz`. **PROPUESTO, NO CREADO.** La autorización de las cuatro migraciones no autoriza este lote, sus roles, su confirmación manual, la activación de servicios ni sus escrituras.

## Cuentas nuevas: cinco

| Alias | Correo ficticio propuesto | Único rol final | Alcance |
|---|---|---|---|
| paciente_a | fase8-paciente-a@dentaia.test | paciente | Perfil/solicitudes propios, ficha clínica A y sus concesiones |
| paciente_b | fase8-paciente-b@dentaia.test | paciente | Perfil/solicitudes propios, ficha clínica B y sus concesiones |
| odontologo_a | fase8-odontologo-a@dentaia.test | odontologo | Contexto de Clínica A; pacientes e historial solo con concesión |
| odontologo_b | fase8-odontologo-b@dentaia.test | odontologo | Contexto de Clínica B; pacientes e historial solo con concesión |
| administrador_qa | fase8-admin@dentaia.test | superusuario | Administración con MFA/AAL2; sin ficha de paciente ni permiso clínico automático |

Cada cuenta usaría `app_metadata.dentaia={version:1,estado:"activo",roles:[<rol>]}` y un marcador **hermano**, `app_metadata.dentaia_development={dataset:"fase8-synthetic-v1",alias:<alias>}`. No colocar el marcador dentro del contrato dentaia de tres claves. Conservar provider/providers y demás metadatos. No asignar roles de PostgreSQL directamente a las cuentas de aplicación.

No reutilizar ni cambiar usuarios existentes. Abortaría una colisión de correo/marcador; no se convierte una cuenta existente en fixture. UUID de Auth se obtiene del SDK tras una creación autorizada, nunca se inventa ni se toma un UUID de un usuario actual.

La futura aprobación debe incluir, expresamente, la asignación inicial de estos roles por operador y la confirmación manual **solo de estas cuentas .test** si se desea login sin entrega de correo. Eso no desactiva confirmación global y no acredita registro por email. Contraseñas aleatorias en memoria y entrega por canal seguro; nunca documentos, Git o chat. El administrador requiere enrolamiento TOTP legítimo y verificación AAL2; no simularlo ni registrar QR/códigos/secretos.

El RPC administrativo canónico rechaza asignar odontologo mientras no exista el proceso profesional aprobado. No se cambiará ni eludirá desde la interfaz: el bootstrap de los dos profesionales **ficticios** requiere aprobación específica de operador, referencia académica y evidencia de provisionamiento; no equivale a acreditar profesionales reales. Revisar auditoría de creación Auth y registros de revisión/membresía antes de declarar ese bootstrap validado.

## Relaciones y cantidades previstas

| Recurso | Cantidad nueva | Asignación/contenido |
|---|---:|---|
| auth.users | 5 | Las cinco cuentas de arriba |
| public.profiles | 5 | Nombres ficticios identificados como FASE8 |
| public.dentists | 2 | Fichas odontológicas demo A/B, is_demo=true e is_active=false |
| clinical.clinics | 2 | FASE8 ACADEMICO Clínica A / Clínica B |
| clinical.professional_accounts | 2 | Odontólogo A → ficha A; odontólogo B → ficha B |
| clinical.professional_verifications | 2 | Evidencia QA explícita, referencia FASE8-DEMO; no licencia real |
| clinical.clinic_memberships | 2 | Odontólogo A → Clínica A; odontólogo B → Clínica B |
| clinical.patient_records | 2 | Paciente A/B; ninguna para el administrador |
| public.appointment_requests | 3 | A→odontólogo A requested; A→odontólogo B cancelled; B→odontólogo B requested |
| clinical.clinical_encounters | 3 | A en Clínica A, A en Clínica B, B en Clínica B |
| clinical.clinical_entries | 9 | Tres entradas ficticias por atención: antecedente, diagnóstico y tratamiento, sin datos reales |
| clinical.clinical_access_grants | 4 | G1–G4 definidos abajo |
| clinical.clinical_grant_resources | 5 | Recursos explícitos de las cuatro concesiones |
| clinical.clinical_documents | 0 | Sin archivos clínicos nuevos |
| public.patient_consents / dental_photos / Storage | 0 | No tocar ni usar la fotografía existente para estas pruebas |
| Auditoría | Según operaciones realmente ejecutadas | Conservar eventos; no fabricar un número anticipado de éxitos |

Las fichas nuevas del directorio se proponen **inactivas** para no introducirlas en el catálogo público que ya consume la aplicación desplegada. Esto implica que el formulario del paciente no puede crear solicitudes para ellas con la política actual, que exige destinatario activo. Las tres solicitudes iniciales se proponen como carga de fixture por operador autorizado; **eso no valida la creación desde el formulario ni su INSERT bajo RLS**. Para probar ese recorrido será necesaria una ventana aprobada de activación de las fichas o una decisión de aislamiento, sin relajar la política. No se activarán fichas durante este paso sin aprobación explícita.

Fechas relativas al reloj del servidor al ejecutar el lote; preferred_date futura. No copiar fechas fijas vencidas ni cambiar el reloj de Dental-IA. UUID de filas y relaciones en manifiesto de lote, con comparación antes de reintentar; nombres no son identificadores de limpieza.

## Concesiones y pruebas previstas

| Concesión | Propietario → contexto receptor | Alcance | Estado de prueba |
|---|---|---|---|
| G1 | Paciente A → Odontólogo A / Clínica A | Sus dos atenciones, de Clínica A y B | Vigente: cruce entre clínicas permitido únicamente por alcance explícito |
| G2 | Paciente A → Odontólogo B / Clínica B | Solo atención A en Clínica B | Vigente: la atención de Clínica A permanece fuera del alcance |
| G3 | Paciente B → Odontólogo A / Clínica A | Atención B en Clínica B | Crear con vigencia corta autorizada y esperar expiración real; no falsificar timestamps ni reloj |
| G4 | Paciente B → Odontólogo B / Clínica B | Atención B en Clínica B | Crear y revocar con JWT real del propietario |

Las concesiones se prueban por el flujo autorizado del paciente y sus JWT, no usando service_role como identidad. Purpose/policyVersion y ventana académica necesitan aprobación/configuración coherentes. Los eventos de auditoría se verificarán tras cada operación. El administrador no debe leer estas historias por tener superusuario.

Pruebas a ejecutar tras la autorización correspondiente: cinco logins; MFA/AAL2 del administrador; rechazo sin sesión y JWT inválido; aislamiento A/B; solicitudes solo del profesional/contexto asignado; ausencia de permiso implícito por autoría/directorio; concesión vigente/expirada/revocada; alcance entre clínicas; lectura posterior y auditoría. No provocar fallos artificiales de auditoría, carga o destrucción en el remoto compartido: esos escenarios se mantienen en el banco local.

## Orden propuesto y controles

1. Aprobar este inventario, roles iniciales, confirmación manual y estrategia académica; todavía NO autorizados.
2. Preparar y revisar el script de lote idempotente con guardas de proyecto, manifiesto de UUID y comparación de resultados. No usar un reset de QA sobre Dental-IA.
3. Crear las cinco cuentas y perfiles, sin editar las cinco cuentas actuales. Si falla una etapa, detener y conservar el manifiesto; no continuar con relaciones incompletas ni compensar borrando datos previos.
4. Provisionar clínicas, directorio demo, profesionales/verificaciones/membresías y pacientes sintéticos, con operador y trazabilidad. Mantener lectura clínica apagada hasta completar/revisar el aislamiento académico.
5. Configurar y probar explícitamente desarrollo remoto en Next.js local. El adaptador actual solo acepta loopback y SQL sigue enabled=false; no basta con cambiar NEXT_PUBLIC_SUPABASE_URL. Mantener NODE_ENV=production/Preview cerrados, validar ref exacta y marcador sintético, claves publicables y secreto de cursor solo servidor; no exponer claves privadas.
6. Probar los cuatro grants, historiales y permisos con sesiones reales. La activación/configuración necesita aprobación adicional si no está incluida en el alcance revisado.
7. Entregar guía por cuenta/función y resultados por entorno; contraseñas únicamente por canal seguro y nunca en la guía.

Limpieza: seleccionar exclusivamente UUID del manifiesto y marcador del lote. Revocar accesos/desactivar contextos propios; conservar auditoría y contenido append-only según retención. No TRUNCATE, borrado por LIKE, eliminación de usuarios actuales ni DROP CASCADE. Cualquier baja de las cuentas nuevas requiere revisar FK RESTRICT y aprobación: no prometer limpieza destructiva automática.

**Estado para Anelis y Angie:** esquema remoto instalado, backend clínico aún no habilitado para Next.js local. La conexión y los permisos finales de sus interfaces todavía deben probarse.
