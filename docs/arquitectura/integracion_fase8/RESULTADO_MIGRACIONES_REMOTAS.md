# Resultado real — cuatro migraciones en Dental-IA

Fecha: 03/11/2026, America/Lima. Proyecto **Dental-IA**, referencia **vwmdknzjyvmsdqpepykz**. Responsable: Jhan Franco, DI-36. Se ejecutó la autorización expresa más reciente, que confirmó el respaldo externo ya verificado y pidió no repetir la auditoría completa.

## Aplicación en orden

Se releyeron los cuatro archivos, se compararon sus SHA-256 aprobados y se confirmó el proyecto ACTIVE_HEALTHY. Se aplicaron mediante el conector Supabase, una operación por archivo, deteniendo dependencias si hubiera error. Las cuatro devolvieron success=true.

| Orden | Archivo local aprobado | Versión real del historial remoto | Resultado |
|---|---|---|---|
| 1 | 20261103235358_di36_dentalia_01_administracion.sql | 20261104004040 | Aplicada |
| 2 | 20261103235408_di36_dentalia_02_modelo_clinico.sql | 20261104004047 | Aplicada |
| 3 | 20261103235409_di36_dentalia_03_rpc_clinicos.sql | 20261104004054 | Aplicada |
| 4 | 20261103235411_di36_dentalia_04_workspace.sql | 20261104004101 | Aplicada |

Las versiones remotas son las que asignó apply_migration; no se inventaron ni repararon para igualarlas con los nombres de los archivos locales. El nombre/orden y los SHA exactos constan en [EJECUCION_MIGRACIONES_REMOTAS.json](EJECUCION_MIGRACIONES_REMOTAS.json). Las dos migraciones originales de octubre permanecen en el historial.

Los archivos no se modificaron. Se suministró únicamente el preámbulo operativo documentado para sus guardas: `SET dentaia.integration_target='vwmdknzjyvmsdqpepykz'` y `SET dentaia.integration_approval='fase8_final_approved'`. Cada SQL conserva BEGIN/COMMIT, validación de huella y timeouts aprobados. No se ejecutaron correcciones improvisadas ni un quinto SQL de migración.

## Comprobaciones remotas posteriores

| Verificación | Resultado observado |
|---|---|
| Tablas MVP | **19**: cinco públicas, tres administrativas y once clínicas |
| Columnas | **142** |
| Restricciones | **118** |
| Índices | **54** |
| Claves foráneas | **27**, todas con convalidated=true |
| RLS | Activo en las **19** tablas |
| Políticas originales | **16 conservadas**, public y Storage, sin diferencias |
| Tablas IA | **0** |
| Configuración clínica | **enabled=false**, propósito/política/vigencia sin activar |
| Clientes anon/authenticated | Sin SELECT/INSERT/UPDATE/DELETE directo en tablas clínicas/administrativas |
| Rol técnico | NOLOGIN, NOSUPERUSER, NOBYPASSRLS; no asumible por anon/authenticated/service_role/authenticator; sin CREATE en clinical_service al terminar |
| Bucket dental-photos | Privado; 8 MiB; JPG/PNG/WebP sin cambios |

Los cinco RPC públicos existen y son INVOKER: `dentaia_cambiar_roles_v1`, `grant_clinical_access`, `revoke_clinical_access`, `get_authorized_clinical_history` y `get_clinical_workspace`. Anon no ejecuta ninguno. El administrativo solo otorga EXECUTE a service_role del servidor y conserva sus controles internos AAL2/aprobación; los cuatro clínicos a authenticated, con autorización interna por sesión/contexto/recurso y configuración cerrada. No se dio permiso clínico automático al superusuario.

Esta comprobación es de catálogo, ACL, relaciones y configuración real. **No se ejecutaron todavía logins de las nuevas cuentas ni flujos positivos con JWT del dataset remoto**, porque esas cuentas/datos no están autorizados. No confundir la existencia de un RPC con validación funcional completa.

## Integridad de los datos anteriores

Se tomó una lectura inmediatamente anterior y otra posterior, con conteos y digest del contenido completo por tabla, sin imprimir filas ni información personal. Coincidieron exactamente:

| Recurso | Antes | Después | Contenido idéntico |
|---|---:|---:|---|
| profiles | 2 | 2 | Sí |
| dentists | 4 | 4 | Sí |
| appointment_requests | 5 | 5 | Sí |
| patient_consents | 5 | 5 | Sí |
| dental_photos | 1 | 1 | Sí |
| auth.users | 5 | 5 | Sí |
| storage.objects | 1 | 1 | Sí |

Las 14 tablas nuevas están vacías. No se crearon cuentas, clínicas, asignaciones, autorizaciones, historias, fotos o fixtures. No se cambiaron roles de usuarios actuales, confirmación de correo ni MFA. El respaldo externo se tomó como confirmación manual del responsable; no se registra una verificación nueva por el agente que no se haya ejecutado.

## Avisos de seguridad

[ADVISORS_POST_MIGRACION.json](ADVISORS_POST_MIGRACION.json): tres avisos **INFO** RLS Enabled No Policy en las tres tablas dentaia_admin. Son coherentes con el diseño cerrado: no hay acceso directo de clientes y el RPC privado opera con controles explícitos. No se añadieron políticas permisivas para silenciarlos.

Permanece el **WARN preexistente** de protección de contraseñas filtradas desactivada. No se modificó Auth ni el plan. Referencias: [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Estado del backend compartido y siguiente aprobación

**Esquema remoto instalado; backend clínico para Next.js local todavía NO habilitado.** La función configuration sigue apagada y el adaptador actual rechaza URL no loopback. Las rutas de producción/Preview conservan su bloqueo; no se modificó código funcional, configuración de Vercel ni despliegue. No se hicieron llamadas de escritura a GitHub/Jira, commits, push o merge de PR19.

Se preparó [INVENTARIO_SINTETICO_PARA_APROBACION.md](INVENTARIO_SINTETICO_PARA_APROBACION.md): dos pacientes, dos odontólogos, un administrador, dos clínicas y sus relaciones/solicitudes/concesiones/historias. Requiere **autorización separada**; no se ejecutó. Incluye las limitaciones del directorio inactivo, provisionamiento profesional académico, MFA del administrador, limpieza y activación explícita del entorno.

Después de aprobar el inventario se podrá preparar/revisar el lote y la configuración académica, ejecutar las pruebas reales de sesiones/permisos y verificar el consumo desde Next.js local con Anelis y Angie. No declarar completada esa integración ni uso clínico productivo por haber aplicado el esquema.
