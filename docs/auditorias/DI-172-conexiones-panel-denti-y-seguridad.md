# Integración de rutinas con panel y Denti — Alcance y seguridad

## Implementado
- `ResumenRutinaPanel` consulta con el cliente autenticado y las mismas políticas RLS que `Mis rutinas`; no emplea clave `service_role` ni datos ficticios.
- El panel muestra el avance del día y navega a `/paciente/rutinas`.
- En `Mis rutinas`, el paciente controla los avisos flotantes de Denti por cuenta y navegador.
- Denti respeta la preferencia y escucha cambios mientras la aplicación está abierta.
- Si falla Supabase no se inventan actividades, porcentajes ni felicitaciones.

## Alcances no cubiertos por esta versión
1. **Asignación por odontólogo**: exige autorización del profesional, verificación de acceso clínico vigente, consentimiento explícito del paciente y revocación. Las tablas `clinical.clinical_access_grants` y `clinical.clinic_memberships` existen, pero no se ha validado un alcance habilitante específico para escribir rutinas; no se dará acceso indiscriminado.
2. **Personalización clínica asistida por IA**: sin evaluación y validación odontológica no debe asignarse un tratamiento ni modificar un plan por resultados visuales.
3. **Notificaciones programadas**: los avisos actuales se muestran dentro del navegador y pueden revalidarse al volver a la página. No son push, correos ni recordatorios del sistema operativo.
4. **Historial a gran escala**: el historial aún se pagina en memoria y requiere una estrategia incremental/servidor si crece.
5. **Validación real integral**: requieren cuentas QA de paciente y profesional y pruebas contra un entorno aislado con RLS real.

## Próxima fase con puertas de seguridad
- Contrato de asignación: profesional verificado + contexto de clínica + acceso del paciente no revocado + actividades de catálogo publicado, sin contenido libre de tratamiento.
- Solicitud al paciente para aceptar o rechazar el seguimiento y opciones de revocación.
- Registro auditable de emisor, receptor, versión del plan, vigencia y eventos.
- Vista profesional de seguimiento solo cuando el paciente lo autorice de forma específica.
- Pruebas de acceso cruzado con dos pacientes, un odontólogo permitido, uno sin acceso, revocación y expiración; bloqueo por defecto.
- Sólo después de eso habilitar la función en producción.
