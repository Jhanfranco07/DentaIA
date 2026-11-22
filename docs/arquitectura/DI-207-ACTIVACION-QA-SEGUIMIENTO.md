# DI-207 — Activación controlada de rutinas asignadas (NO HABILITADA)

## Estado del trabajo
La implementación está preparada en un PR con esquema SQL candidato, funciones transaccionales, API privada y vistas paciente/odontólogo. **No se ha aplicado ninguna migración a Supabase remoto** y la interfaz queda apagada por defecto.

La rama de Supabase de QA requiere confirmación de coste. No se creará ni cobrará sin aprobación del titular.

## Archivos SQL candidatos (orden de ejecución)
1. `docs/sql/DI-207-propuesta-esquema-rutinas.sql` — tablas, claves, auditoría y RLS.
2. `docs/sql/DI-207-operaciones-transaccionales.sql` — inserciones/cambios en una transacción, auditadas y limitadas a `service_role`.
3. `docs/sql/DI-207-consultas-autorizadas.sql` — consultas filtradas por paciente y por membresía de odontólogo.

Son archivos **de revisión**, no migraciones listas para aplicar. Una vez validado todo en QA, generarlos con `supabase migration new`, incorporar a una migración versionada y comprobar `supabase migration list`.

## Puertas de seguridad obligatorias
- Comprobar que `anon` y `authenticated` no tienen `INSERT/UPDATE/DELETE` en ninguna tabla nueva.
- Verificar que `PUBLIC`, `anon` y `authenticated` no tienen `EXECUTE` sobre las dos funciones `SECURITY DEFINER`.
- Asegurar `search_path` fijo, RLS activo, ausencia de políticas de escritura y `service_role` solo en el servidor.
- Simular la verificación de identidad con JWT válidos y no mediante un ID inventado en el cuerpo.
- Confirmar que el profesional pertenece a una membresía activa y su cuenta clínica está en estado `verified`.
- Comprobar que los pacientes sin expediente clínico autorizado no pueden recibir invitaciones arbitrarias.
- Probar aceptación, rechazo, revocación y vencimiento, incluyendo operaciones simultáneas.
- Probar propuestas con IDs de actividades ajenos al catálogo, duplicados, planes ocultos o caducados.
- Probar que al revocar un permiso se interrumpe **inmediatamente** la consulta profesional del progreso.
- Verificar que la historia sigue siendo correcta tras cambiar o revocar una propuesta.

## Matriz QA mínima
| Caso | Actor | Resultado exigido |
| --- | --- | --- |
| Invitar con membresía válida y autorización clínica previa | Odontólogo A | Solo invitación pendiente |
| Invitar paciente sin relación clínica | Odontólogo A | 403 |
| Aprobar invitación ajena | Paciente B | 403 |
| Aprobar invitación propia | Paciente A | Consentimiento aprobado; no activa aún ningún plan |
| Proponer antes de aprobación | Odontólogo A | 403 |
| Proponer desde otra membresía | Odontólogo B | 403 |
| Proponer actividades de otro plan o duplicadas | Odontólogo A | 403/400 |
| Aceptar propuesta propia | Paciente A | Plan activo solo con actividades elegidas |
| Consultar paciente ajeno | Odontólogo B | 403; sin IDs o progreso |
| Revocar autorización | Paciente A | Acceso a progreso retirado; propuesta desactivada |
| Sesión vencida/suspendida | Cualquier actor | 401/403 |
| Dos aceptaciones concurrentes | Paciente A | Una sola propuesta activa, historial consistente |

## Entorno y flags
No configurar las banderas hasta que las migraciones estén probadas en la base de QA y el servidor se conecte exclusivamente a QA:

- `DENTAIA_SEGUIMIENTO_RUTINAS_HABILITADO=true` (servidor)
- `NEXT_PUBLIC_DENTAIA_SEGUIMIENTO_RUTINAS=true` (interfaz)

Ambas son `false` por omisión. El despliegue con el código, sin banderas, no añade accesos clínicos.

## Límites actuales
- No existe aún un QA Supabase aislado aprobado para las pruebas RLS reales.
- Las pruebas con Vitest de SQL son **estructurales**, no sustituyen ejecución PostgreSQL.
- El historial de planes despublicados necesita un contrato de conservación histórica: no ocultar versiones necesarias para interpretar marcas antiguas.
- La activación exige validación visual y E2E paciente/odontólogo/denegado y revisión de consumo del servicio.
- La personalización educativa no equivale a diagnóstico ni prescribe tratamientos.
