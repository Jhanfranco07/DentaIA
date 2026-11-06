# Seguridad y permisos

Matriz objetivo; cada celda debe contrastarse con el estado del módulo. Un permiso propuesto no se considera implementado. Los perfiles no son una jerarquía clínica y una cuenta puede tener funciones personales y profesionales independientes.

| Operación | Visitante | Paciente | Odontólogo | Superusuario |
|---|---|---|---|---|
| Inicio, privacidad, demo, directorio | Sí | Sí | Sí | Sí |
| Perfil básico | No | Propio | Propio | Propio |
| Crear/ver/cancelar solicitudes académicas | No | Propias | Propias como usuario, no de terceros por rol | Propias, no global por rol |
| Guardar/ver/borrar fotos personales | No | Propias; consentimiento para carga | Propias si usa flujo personal | Propias; sin bypass clínico |
| Ver resultados orientativos | Demo pública; no privados | Propios autorizados | Solo autorizados, separados del historial | Sin acceso clínico implícito |
| Conceder/revocar historial | No | Solo propio | No en nombre del paciente | No en nombre del paciente |
| Consultar historial clínico | No | Propio, mediante servicio propuesto | Membresía y permiso vigente para recursos concretos | No por ser administrador |
| Registrar/corregir clínica | No | No | Futuro, profesional habilitado y versión conservada | No por rol administrativo |
| Leer usuarios administrativos | No | No | No salvo rol administrativo independiente | AAL2 y habilitación privada |
| Cambiar roles | No | No | No por rol clínico | Transición exacta aprobada, sin cambios propios, recencia MFA y auditoría |
| Otorgar rol odontólogo | No | No | No | Bloqueado hasta verificación/vinculación profesional |
| Leer auditoría | No | Propia clínica según proyección propuesta | Sus eventos limitados según política | Solo administrativa mínima; clínica exige permiso específico de revisión aún por acordar |
| Entrenar/evaluar IA | No | No por ser paciente | No por ser odontólogo | Tampoco por rol general; operador de investigación separado y aprobado |

## RLS actual comprobada

profiles: SELECT/INSERT/UPDATE propio; UPDATE tiene USING y WITH CHECK. appointment_requests: lectura y creación propias, cancelación restringida requested→cancelled y profesional activo para crear. patient_consents: lectura/creación propia y revocación; dental_photos: propietario, consentimiento vigente al crear y eliminación por propietario incluso tras revocación. Directorio activo legible por anon/authenticated. Storage: bucket dental-photos, carpeta de propietario y consentimiento válido para subir; lectura/borrado propios. Los privilegios de columna se detallan en el inventario complementario para no confundir UPDATE de estado con actualización libre.

## Reglas clínicas propuestas

- Denegar todo acceso directo por defecto. patient_records: paciente solo su UUID; memberships: lectura mínima del propio profesional, no catálogo de pacientes. Encounters/entries/documents solo a través de la lectura autorizada con auditoría, evitando políticas circulares.
- Función de autorización comprueba cuenta habilitada, profesional verificado, membresía activa, clínica concreta, paciente, permiso no revocado y no vencido, recurso seleccionado y ausencia de suspensión. Un UUID conocido o una ficha de dentists no concede acceso.
- INSERT/UPDATE de concesiones solo mediante funciones que derivan paciente desde Auth y comprueban todos los recursos; no permitir ampliar scope desde cliente. Revocación no admite cambiar patient_id o destinatario.
- No hay condición global es_admin en políticas clínicas. Cuenta superusuario que también sea profesional cumple todas las restricciones como cualquier odontólogo.
- Auditoría antes de devolver contenido; consultas denegadas también, sin historial en logs. El profesional no actualiza/elimina el registro. Si no hay auditoría, no se entrega historial.
- Documentos privados se resuelven por ID validado, no por ruta libre recibida. Preferir proxy autenticado para revocación por petición; URL firmada corta solo cuando su ventana residual sea aceptada.

## Administración

Conservar getUser/getClaims del guard y app_metadata.dentaia leída de Auth vigente; no autorizar usando user_metadata ni el rol de un JWT antiguo sin consulta fresca. AAL2 y factor verificado no certifican reautenticación reciente; la escritura propuesta revisa sesión y AMR TOTP de cinco minutos. Ese umbral es decisión del código en rama, no acuerdo clínico universal.

La migración DI-151 escribe un namespace de raw_app_meta_data junto con auditoría dentro de PostgreSQL. Requiere aprobación arquitectónica explícita, revisión de privilegios del SECURITY DEFINER privado, search_path fijo, revocación de EXECUTE público y compatibilidad con Auth gestionado. Su wrapper público SECURITY INVOKER no autoriza por sí solo a cualquier cliente: se restringe a servicio. No aplicar ni modificar auth.users en esta etapa. No crear paralelamente otra tabla de roles canónicos.

Idempotencia por actor/solicitud; cambios obsoletos devuelven 409. Una respuesta perdida se reconcilia con misma clave y cuerpo; no se inventa rollback. Protección del último administrador, aprobación independiente y escritor único del namespace necesitan pruebas reales incluso si existen fixtures. La auditoría no se declara inviolable frente al dueño de PostgreSQL.

## Privacidad, archivos y ciclo de vida

El consentimiento actual solo cubre almacenamiento académico; no sirve como permiso clínico ni entrenamiento/IA. Las once tablas clínicas se prueban primero con datos sintéticos. No introducir diagnósticos reales por copiar fixtures. Separar datos públicos de contacto/salud. Revocación detiene nuevos accesos, no recupera copias ya vistas; comunicar límites al paciente. Definir conservación y eliminación conforme a revisión específica antes de usar datos reales; esta arquitectura no constituye dictamen legal.

Para IA usar datasets licenciados y particiones por sujeto sin vínculo con Auth. Archivos validan MIME, tamaño y decodificación; agregar análisis de contenido/antimalware y cuotas antes de aceptar documentos reales. No sobrescribir objetos con upsert sin políticas específicas. RLS, GRANT y API expuesta son controles diferentes: revisar los tres. Views nuevas deben ser security_invoker o permanecer privadas.

## Validación requerida por ambiente

Probar con identidades controladas: propietario/otro paciente, profesional autorizado/no autorizado, otra clínica, permiso revocado/expirado, sesión AAL1/AAL2, suspensión, carrera lectura–revocación, fallo de auditoría, descarga tras revocación y cambio de roles concurrente. Fixtures verifican lógica y contratos; pruebas de integración verifican permisos efectivos. Typecheck/build no prueban esos permisos. No usar cuentas ni datos clínicos ajenos.

Referencias primarias: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [MFA](https://supabase.com/docs/guides/auth/auth-mfa), [usuarios](https://supabase.com/docs/guides/auth/managing-user-data), [Storage](https://supabase.com/docs/guides/storage/security/access-control).
## Actualización de auditoría integral

## Reglas vinculantes del modelo corregido

Las cinco tablas actuales mantienen sus políticas observadas; no se añade lectura profesional directa a appointment_requests ni se amplía patient_consents. En clinical/ml el borrador aplica RLS y revoca acceso directo de PUBLIC, anon, authenticated y service_role. No hay políticas SELECT de contenido que permitan omitir auditoría: cada RPC necesita revisión y pruebas antes de conceder EXECUTE. Conocer un UUID, ser dueño de una cuenta sin ficha clínica o ser superusuario no permite historias ajenas.

El paciente controla solo su registro y concesiones. Odontólogo requiere rol fresco, verificación aprobada, membresía/clinica activas y recursos autorizados. La clínica histórica de origen no debe estar activa hoy para conservar procedencia. La recepción de una solicitud no concede acceso al historial. Supervisión administrativa no es supervisión clínica.

Revocación usa el protocolo de bloqueos descrito aparte; páginas/streams ya autorizados tienen la limitación temporal expresa. El objeto clínico no se entrega si falla la auditoría; una política RLS no prueba existencia ni inocuidad del binario.

La revisión de perfiles profesionales y recomendaciones debe atribuirse a responsables y evidencia real. El campo review_status no acredita por sí solo respaldo odontológico: la publicación de contenido requiere un acta/artefacto versionado de revisión por código/versión, o que el equipo acuerde otra trazabilidad antes de habilitarlo. No se inventa una cuenta médica revisora ni se usa Auth para deducir credenciales profesionales.

La retención RESTRICT clínica afecta futuras bajas de Auth. Resolver soporte, conservación y anonimización antes de datos reales; no fijar aquí plazos legales. La excepción de borrado del subárbol de análisis académico es expresa para preservar el comportamiento actual de fotos. Ver MODELO_FISICO.md y PROTOCOLO_RPC_Y_CONCURRENCIA.md.
