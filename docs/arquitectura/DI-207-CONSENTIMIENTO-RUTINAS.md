# DI-207 — Contrato para rutinas asignadas con consentimiento

## Situación comprobada (22/11/2026)
El sistema actual solo publica el plan general `general-preventive`, con tres actividades. `patient_routine_completions` conserva las marcas por paciente y día. El esquema `clinical` contiene membresías y autorizaciones, pero las concesiones existentes permiten únicamente `selected_encounters` para un propósito de historial clínico; no autorizan asignación ni seguimiento de rutinas.

## Estados separados
**Consentimiento para seguimiento:** pendiente → aprobado → revocado.

**Propuesta de plan:** propuesta → aceptada / rechazada, y aceptada → revocada. Una propuesta NO se activa por sí sola.

## Reglas obligatorias del backend
1. El paciente autenticado debe confirmar expresamente el seguimiento con un odontólogo verificado, en una membresía activa.
2. El profesional solo propone un plan si el consentimiento es específico, vigente y no revocado. No basta con poder consultar el historial.
3. El plan usa exclusivamente actividades publicadas del catálogo, con versión y vigencia verificadas; no puede incluir texto libre como tratamiento no validado.
4. La aceptación de una propuesta requiere una segunda decisión explícita del paciente. Rechazo y revocación funcionan inmediatamente.
5. Los datos, planes y avances son visibles al profesional solo si el paciente autorizó ese alcance y el servidor comprueba cada solicitud, incluso después de revocación, suspensión o vencimiento.
6. Registrar actor, paciente, membresía, decisión, versión del catálogo y fecha sin exponer información sensible en logs públicos.
7. Probar con dos pacientes y dos profesionales, incluyendo ataques de acceso por identificador (IDOR), sesión expirada y revocación concurrente.

## Integración requerida antes de activar
- Migración propia para consentimiento de rutinas, propuestas y auditoría, distinta de `clinical_access_grants`.
- RLS denegación por defecto para pacientes ajenos y profesionales no autorizados, y RPC/BFF de servidor que verifique el rol desde datos no editables por el usuario.
- Integración de los estados en `RutinasPaciente`, portal odontológico y proveedor de planes. Mantener el plan preventivo general si no existe ninguna asignación activa y aprobada.
- Validación de esquema y pruebas RLS en un Supabase aislado, con migración reversible, antes de aplicar en producción.

## Alcance de este PR
Solo contrato puro y pruebas negativas de autorización. **No se habilitan escrituras, no se concede acceso a odontólogos, no se modifica la base de datos y no se presenta como flujo integrado listo para producción.** La función `puedeOperarSeguimiento` NO es una barrera de seguridad suficiente en cliente; la decisión definitiva debe pertenecer al backend y RLS.
