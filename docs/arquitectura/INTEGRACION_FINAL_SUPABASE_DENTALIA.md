# Fase 8 — entorno académico compartido: resultado vigente

Actualización verificada el 03/11/2026, America/Lima. Responsable Jhan Franco, DI-36. **Backend académico remoto operativo desde Next.js local para el lote autorizado; no apto para uso clínico real.** Esta sección sustituye los estados de preparación histórica conservados más abajo.

## Ejecución real autorizada

- Dental-IA `vwmdknzjyvmsdqpepykz`, ACTIVE_HEALTHY. Diecinueve tablas con RLS; las cuatro migraciones originales no se repitieron ni alteraron.
- Cinco cuentas creadas con Auth Admin, passwords distintos y confirmación individual. Roles en app_metadata.dentaia; marcador dentaia_development.dataset=fase8-synthetic-v1. No se insertaron usuarios manualmente en Auth ni se usó user_metadata para autorizar.
- Cinco perfiles, dos dentistas demo **inactivos**, dos clínicas ficticias, dos profesionales y membresías, verificaciones expresamente ficticias, dos fichas de paciente, tres solicitudes, tres atenciones, nueve entradas, tres exámenes sin archivo y cuatro concesiones: dos vigentes, una expirada y una revocada. [Inventario real](integracion_fase8/LOTE_ACADEMICO_REAL.json).
- Passwords y TOTP QA guardados con DPAPI fuera de Git y ACL usuario/SYSTEM, con descifrado comprobado. No se guardaron tokens. Entrega privada al equipo pendiente: [guía](GUIA_FINAL_EQUIPO_DENTAIA.md).
- El paciente B ejecutó la revocación inicial con JWT real: RPC/HTTP200. El operador sembró las concesiones y solicitudes; no se afirma creación de solicitudes mediante formulario ni alta HTTP201 de concesiones.
- Conteos y digest de los IDs originales en Auth, profiles, dentists, appointment_requests, patient_consents, dental_photos y Storage permanecen idénticos. No se modificaron los cinco usuarios originales ni sus registros/binarios.

## Activación adicional autorizada separadamente

El responsable aprobó el SQL `20261104010040_di36_activacion_sintetica_fase8.sql`, SHA-256 **df245dfdc87021632aef53581db995cef7e440fc89e85bd25c1575391a013700**. Aplicado con éxito, nombre di36_activacion_sintetica_fase8, versión remota **20261104010757**. [Archivo exacto](integracion_fase8/activacion/20261104010040_di36_activacion_sintetica_fase8.sql) y [registro](integracion_fase8/ACTIVACION_EJECUTADA.json).

Modifica únicamente clinical_service.configuration(), SECURITY INVOKER y privada; no añade GRANT, políticas ni privilegios. Habilitación condicional para cinco Auth UUID y recursos del inventario. Falla cerrado ante nuevas membresías, atenciones, entradas, documentos disponibles o relaciones fuera del lote. Continúan las comprobaciones de identidad fresca, rol, profesional/membresía, concesión, alcance y auditoría.

Sin actor permanece false. Las cinco cuentas anteriores conservan la clínica cerrada según comprobación SQL de configuración (claims de prueba, **no sus JWT ni sus logins**). El nuevo administrador obtuvo HTTP403 al consultar un historial: no hereda acceso clínico. Anon/authenticated no ejecutan la configuración ni seleccionan clinical_encounters; 19/19 tablas con RLS. [Evidencia](integracion_fase8/SEGURIDAD_ACADEMICA_REAL.json).

Next requiere target académico explícito, ref/HTTPS exactos, allowlist/marcador fresco de Auth, clave publishable, secret de cursor servidor, host local y origen concordante. Development por sí solo no autoriza. Producción y Vercel/Preview siguen cerrados aun con flag=true. La base no identifica el origen HTTP del cliente Supabase: los cinco JWT QA también pueden invocar directamente RPC, conservando autorización y alcance sintético. La allowlist no es un firewall de red.

## Resultados efectivamente ejecutados

| Verificación | Entorno/evidencia | Resultado |
|---|---|---|
| Cinco logins, roles y firmas JWT | Dental-IA Auth real, sin imprimir tokens | APROBADA |
| Perfiles/solicitudes propias y RLS cruzado | Dos JWT reales; lectura/update ajenos cero filas | APROBADA |
| TOTP del nuevo administrador | Enrolamiento, desafío y verificación oficiales | Un factor verificado, AAL2 |
| SDK/RLS/MFA/directorio inactivo | CUENTAS_RLS_MFA_REALES.json | **12/12** |
| Ocho métodos BFF | HTTP_ACADEMICO_REAL.json, Next local hacia remoto | **35/35 comprobaciones** |
| Historial propio y compartido | Paciente A dos atenciones/B una; profesionales A dos/B una de A | HTTP200 |
| Expiración/revocación/permisos cruzados | Pacientes y profesionales con JWT reales | HTTP403 |
| POST grant existente/revoke repetido | Idempotencia, sin quinta concesión | HTTP200/replayed=true |
| Reutilizar clave ajena | Recursos propios del segundo paciente | HTTP409 |
| Entrada/sesión/firma/origen inválidos | Next local hacia Dental-IA | HTTP400/401/401/404 |
| DI-150 intacto | Admin AAL1 403/AAL2 200; paciente 403 | APROBADA |
| Auditoría persistida | requestId de respuestas protegidas exitosas | APROBADA |
| Configuración SQL acotada | Copia local nueva, claims SQL, siempre ROLLBACK | **7/7** |
| Suite Node aislada | Fixtures/dobles; no red ni credenciales | **284/284** |
| TypeScript/build/npm audit/diff | Local | Exit0, cero vulnerabilidades |
| Ocho rutas en build production | Next start local, flag=true | **8/8 HTTP404/no-store** |
| Secretos en cambios/bundles | Comparación literal y patrones | Sin coincidencias detectadas |
| Interfaces de las integrantes | Sin modificar ni recorrer visualmente | NO EJECUTADA |
| Fallo artificial de auditoría remota | Sin añadir triggers ni dañar datos | NO EJECUTADA; cobertura excepcional local anterior |
| Nueva fotografía remota | Se preservó el archivo original; consentimientos propios vacíos | NO EJECUTADA |

La primera prueba SQL de activación detectó una concesión local a un tercer profesional y cerró el acceso correctamente. El caso positivo se probó en una **copia local nueva**: normalización de fixtures y pruebas revertidas; no se desactivaron RLS ni triggers ni se cambió el banco anterior. Estos ensayos no se presentan como JWT remoto.

Advisors remoto: tres INFO de tablas administrativas con RLS sin políticas (cierre deliberado) y advertencia preexistente de protección contra contraseñas filtradas desactivada. [Recomendación de Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No se cambió configuración Auth ni plan. Cero vulnerabilidades npm no elimina esa advertencia.

## Archivos y controles

- src/features/clinica-http/ambiente.ts y pruebas: modo académico verificable, cerrado por defecto.
- servidor.ts: cliente publishable por petición, getClaims/getUser, marcador y allowlist; sin SDK Admin/service_role.
- http.ts: etiqueta BFF academic_remote; proyección explícita del DTO conservada.
- Tipos documentales y scripts de operador/validación en scripts/. No se importan en src. Provisión con flags explícitos, ref fija, claves guardadas antes de crear y UUID persistidos para evitar duplicados.
- .env.development.local preparado e ignorado; solo publishable, flags, allowlist y secret de cursor. Lecturas/escrituras administrativas apagadas en el entorno compartido; DI-151 intacto.
- Harness anteriores añaden --fase8 para separar evidencias. Se conservan los 38 originales congelados. Sin cambios en interfaces ajenas, Jira, Vercel ni ramas de las integrantes.

## Git y pendientes

Rama docs/auditoria-arquitectura-integral; [PR19](https://github.com/Jhanfranco07/DentaIA/pull/19) Draft, sin merge. Se conserva la identidad Git de Jhan y los ocho ancestros administrativos: f6221d9, 3576c13, 12d54fb, 9d4409a, fa841a7, e6f6835, 8b36f87 y c992a14.

Referencia publicada anterior: 49985c57e6869a968024256f92a3ac59e0b93ec2. Utilizar el nuevo commit informado al publicar y sus checks. Merge-tree de HEAD anterior con origin/main no detectó conflictos; divergen 15/8 commits y eso no equivale a validación visual de la combinación. No se integró ni sobrescribió ninguna rama personal.

Las concesiones vivas vencen 24 horas después de la siembra: renovar mediante acción legítima del paciente, sin extender fechas por SQL. Ampliar el inventario o la seguridad remota exige nueva revisión y autorización.

Limpieza selectiva **preparada como procedimiento, no ejecutada**: cerrar primero el modo académico mediante propuesta revisada; revocar concesiones propias y desactivar exclusivamente membresías/fichas del manifiesto. Conservar grants/auditoría append-only conforme a retención. Verificar referencias antes de cada operación. No borrar por prefijo/email, no reiniciar tablas ni restaurar el respaldo completo encima de escrituras nuevas. Eliminar usuarios Auth requiere autorización específica y no invalida por sí solo todo JWT anterior.

Pendientes: entrega privada de credenciales e integración visual; excepciones remotas no autorizadas; verificación profesional, consentimiento/retención reales, destinatarios y descarga clínica auditada para producción. El acceso AAL2 funciona; no se probaron nuevas escrituras de roles en esta fase ni se sustituye la evidencia DI-151. No se declara terminada una historia Jira ni aptitud clínica.

---

# Antecedentes históricos previos a las autorizaciones

Las referencias posteriores a «sin cuentas», «sin migraciones» o «pendiente de aprobación» describen puntos de control anteriores. Se conservan como trazabilidad; el estado vigente es el documentado arriba.

# Fase 8 — integración incremental de Dental-IA

**Estado vigente, posterior a la autorización:** las cuatro migraciones se aplicaron correctamente en Dental-IA y se validaron 19 tablas/RLS/relaciones/ACL y conservación del contenido anterior. [Resultado remoto real](integracion_fase8/RESULTADO_MIGRACIONES_REMOTAS.md). Las secciones de preparación y auditoría previa que siguen documentan el estado anterior; ya no son el estado de ejecución. La clínica sigue cerrada y no se crearon cuentas/datos. [Inventario separado pendiente](integracion_fase8/INVENTARIO_SINTETICO_PARA_APROBACION.md).

**Actualización de recuperación:** se creó y verificó una copia adicional portable AES-256-GCM, descifrada en Linux sin DPAPI y restaurada offline. [Resultado y custodia](integracion_fase8/RESPALDO_PORTABLE.md). La recuperación ya no depende exclusivamente del perfil Windows; aún falta trasladar bundle/clave a ubicaciones externas separadas. No se aplicaron migraciones ni se crearon cuentas.

Fecha de trabajo: **03/11/2026, America/Lima**. Responsable: Jhan Franco. DI-36 continúa en Sprint 6. Esta fase permanece en el punto de revisión/aprobación; no se declara habilitado el backend compartido ni autorizado el uso clínico.

## 1. Estado inicial y autorización vigente

Rama `docs/auditoria-arquitectura-integral`, HEAD inicial `49985c57e6869a968024256f92a3ac59e0b93ec2`, árbol limpio y staging vacío antes del trabajo. Fetch realizado; main observado `1bcb84956e755b4089494af43f983fd0d2e5bfad`. [PR19](https://github.com/Jhanfranco07/DentaIA/pull/19) abierto, Draft, base main, mergeable=true. No se fusionó ni se activó auto-merge.

Se revisaron CONSOLIDACION_BACKEND_MVP, VALIDACION_SUPABASE_QA_FASE_7, GUIA_INTEGRACION_FRONTEND_QA, CONTRATOS_API y VERSIONADO_E_INTEGRACION_GITHUB, además del SQL y los harness efectivos. Las prohibiciones de F7 se conservan como historia: la nueva instrucción autoriza inspeccionar y preparar integración con Dental-IA, pero **no autoriza DDL/DML remoto antes de la aprobación concreta de la sección 7**. No se creará otro proyecto ni se contratarán recursos de pago.

Docker Desktop 29.9.2, PostgreSQL 17.11 y CLI existente 3.0.0; Node22 y dependencias bloqueadas del proyecto. Cinco servicios locales originales saludables. No se instalaron herramientas o imágenes adicionales. Se comprobó configuración por nombres/presencia de variables, sin imprimir valores. `.env.local` y `.env.backup.local` están ignorados; ninguna credencial se versiona.

## 2. Inspección remota ejecutada: exclusivamente lectura

Proyecto **Dental-IA**, referencia **vwmdknzjyvmsdqpepykz**, organización **mrhdeaoscwglprdztrif / Jhan Franco**, us-east-1, ACTIVE_HEALTHY. PostgreSQL remoto 17.11. No hay proyecto QA independiente ni se lo simula mediante un nombre.

[CATALOGO_REMOTO_ANTES.json](integracion_fase8/CATALOGO_REMOTO_ANTES.json), [ACL y extensiones](integracion_fase8/ACL_Y_EXTENSIONES_REMOTAS.json), [tipos efectivos](integracion_fase8/TIPOS_COLUMNAS_REMOTAS.json), [consulta reproducible](integracion_fase8/inspeccion_remota.sql) y [control](integracion_fase8/CONTROL_DESTINO.json). Son metadatos y agregados; no incluyen filas, correos, JWT, códigos MFA, rutas de archivos de usuarios ni secretos.

| Recurso remoto | Estado observado |
|---|---|
| public.profiles | 3 columnas, 2 registros, RLS activo |
| public.dentists | 13 columnas, 4 registros, RLS activo |
| public.appointment_requests | 11 columnas, 5 registros, RLS activo |
| public.patient_consents | 7 columnas, 5 registros, RLS activo |
| public.dental_photos | 9 columnas, 1 registro, RLS activo |
| Auth | 5 usuarios, 4 confirmados, 0 anónimos, 0 bloqueados en la lectura inicial |
| MFA | 1 factor verificado; no se consultó el secreto ni se inició una sesión |
| Storage | dental-photos privado, 1 objeto; JPG/PNG/WebP, máximo 8 MiB |
| clinical / clinical_service / dentaia_admin | No existen en esta auditoría |
| Cinco RPC nuevos previstos | No existen remotamente |

Las cantidades son snapshots de lectura y pueden cambiar por el uso normal de la aplicación. La fotografía se trata como privada aunque sea de demostración. No se borraron ni editaron usuarios, perfiles, solicitudes, consentimientos o archivos.

Historial remoto de migraciones: `20261025150315 dentaia_mvp_independent_modules` y `20261025150507 allow_photo_owner_cleanup_after_consent_revocation`. La migración DI-151 de Git no figura aplicada; el esquema administrativo tampoco existe. No se inventan ni reparan entradas históricas.

Auth settings público devolvió HTTP200: email habilitado, signup habilitado y `mailer_autoconfirm=false`. No se desactivó confirmación de correo, MFA ni DI-150. No se ejecutó login remoto, suspensión de cuentas o cambio de roles en esta fase. El advisor informó el warning preexistente [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); no se cambió configuración ni plan para corregirlo.

## 3. Comparación y alcance incremental

[Matriz completa: 186 filas](integracion_fase8/MATRIZ_CAMBIOS.md) y [JSON](integracion_fase8/MATRIZ_CAMBIOS.json), generados por comparar_modelos.py. **Las cinco tablas y sus 43 columnas originales se conservan**; se proponen 14 tablas nuevas y 99 columnas, sin tablas IA.

| Objeto | Estado remoto | Cambio requerido | Riesgo | Acción propuesta |
|---|---|---|---|---|
| Cinco tablas públicas | Existentes | Ninguno en columnas/filas | Medio | No recrear ni copiar baseline vacío |
| Tres tablas dentaia_admin | Ausentes | Crear | Alto | DI-151 canónico, auditoría y aprobaciones; sin cambiar usuarios |
| Once tablas clinical | Ausentes | Crear | Alto | Identidad/contextos, contenido, grants y auditoría; RLS |
| clinical_service y rol ejecutor | Ausentes | Crear helpers/rol | Alto | Privados, NOLOGIN/NOBYPASSRLS y permisos mínimos |
| Cinco RPC públicos | Ausentes | Crear | Alto | Uno administrativo para servidor; cuatro clínicos autenticados |
| Políticas originales public/storage | Existentes | Mantener | Medio | No reemplazar ni ampliar permisos de clientes |
| Dos políticas técnicas public | Nuevas | Añadir | Alto | SELECT mínimo de perfiles y solicitudes para ejecutor privado |
| Índice parcial de solicitudes | Ausente | Crear | Medio | No UNIQUE; lock_timeout 2 s |
| btree_gist | Ausente | Crear extensión | Medio | Integridad de membresías; revisar capacidades managed |

La precisión real `numeric(10,2)` del precio del directorio se conserva. No se modifica el esquema para imponer un modelo documental divergente. Los permisos existentes de service_role se reproducen **solo en la copia de simulación**, no se añaden remotamente como solución a errores.

## 4. Migraciones exactas propuestas, no aplicadas

[PAQUETE_PROPUESTO.json](integracion_fase8/PAQUETE_PROPUESTO.json) contiene SHA-256 de cada archivo y de sus fuentes históricas. Los nombres fueron generados por Supabase CLI en un workspace temporal, no inventados. Archivos fuera de supabase/migrations: **no autodesplegar, no db push**.

1. [20261103235358_di36_dentalia_01_administracion.sql](integracion_fase8/migraciones/20261103235358_di36_dentalia_01_administracion.sql): tres tablas administrativas y RPC canónico con aprobación, MFA, revisión, idempotencia y auditoría; no asigna roles ni habilita escrituras Next.
2. [20261103235408_di36_dentalia_02_modelo_clinico.sql](integracion_fase8/migraciones/20261103235408_di36_dentalia_02_modelo_clinico.sql): once tablas clínicas, restricciones, índices y triggers de integridad.
3. [20261103235409_di36_dentalia_03_rpc_clinicos.sql](integracion_fase8/migraciones/20261103235409_di36_dentalia_03_rpc_clinicos.sql): rol técnico, autorización de identidad/sesión, grants/revocación/historial y política técnica de procedencia en profiles.
4. [20261103235411_di36_dentalia_04_workspace.sql](integracion_fase8/migraciones/20261103235411_di36_dentalia_04_workspace.sql): workspace paciente/profesional, solicitudes/pacientes autorizados, vocabulario de auditoría e índice parcial/política técnica de solicitudes.

Cada archivo ejecuta una transacción, exige operador postgres y comprueba destino operativo, dependencias y huella del esquema. `lock_timeout=2s`, `statement_timeout=60s`; abortar ante bloqueo o deriva, sin ampliar tiempos automáticamente. La cuarta migración exige la huella posterior a la tercera, porque esta añade una política/ACL técnica prevista. Las guardas también permiten la base **local marcada** de simulación, sin autorizar otras bases.

Los GUC de destino/aprobación son guardas contra errores operativos: **no prueban criptográficamente la referencia remota**. Antes de aplicar se debe verificar nombre/ref por el conector y volver a comparar el catálogo completo. La huella incluye tipos formateados, defaults, nulabilidad, ACL, restricciones, índices y políticas; no sustituye una copia recuperable de datos. No se quitan guardas de los SQL históricos: se preparan variantes nuevas con trazabilidad.

Los archivos contienen CREATE de funciones con cuerpos que podrían realizar escrituras futuras autorizadas; **la aplicación del paquete no ejecuta esos cuerpos**, no cambia app_metadata, no crea cuentas y no concede datos clínicos a administradores. La configuración clínica SQL queda `enabled=false` y los flags Next permanecen apagados por defecto. La revocación propia autenticada conserva su excepción deliberada incluso con lectura/concesión apagadas.

## 5. Simulación y errores encontrados

Base aislada `dentaia_arch_qa_fase8`, comentario `DENTAIA_PHASE8_SYNTHETIC_ONLY`. Se reconstruyó el esquema remoto leído, incluido numeric(10,2), RLS y ACL, y se añadieron exclusivamente filas ficticias con los mismos recuentos de las cinco tablas. No se copió información personal para simular las migraciones.

[SIMULACION_MIGRACIONES.json](integracion_fase8/SIMULACION_MIGRACIONES.json): los cuatro archivos exactos se aplicaron localmente y se compararon hashes/conteos del contenido público después de **cada commit SQL**. Las filas previas permanecieron idénticas. Resultado: 19 tablas / 142 columnas / 118 restricciones / 54 índices / RLS activo / IA 0, servicios cerrados, ACL de RPC y ejecutor privado comprobados. La simulación utiliza postgres local privilegiado; no se presenta como prueba definitiva de todos los privilegios del postgres gestionado remoto.

Se conservaron [INTENTOS_SIMULACION.json](integracion_fase8/INTENTOS_SIMULACION.json). Hubo dos fallos previos: la huella inicial no contemplaba la política técnica creada antes del paso 4, y la copia no reproducía ACL de service_role. Se corrigieron las guardas por paso y la copia representativa, sin modificar Dental-IA ni aflojar políticas de cliente. La observación preliminar de tres migraciones está etiquetada como preliminar, no como ensayo completo.

El paquete definitivo pasó **78/78 pruebas SQL/RPC/concurrencia** en esa misma base; [REGRESION_PAQUETE_SQL.json](integracion_fase8/REGRESION_PAQUETE_SQL.json). Son claims SQL sintéticos y conexiones authenticator reales según el caso, no JWT firmados. Al finalizar se restituyó configuración clínica cerrada.

## 6. Respaldo y recuperación: resultados y límites

El responsable autorizó expresamente leer PostgreSQL y Storage, guardar copias fuera del repositorio y restaurarlas en un PostgreSQL local aislado. **Esa autorización no incluye migraciones remotas.** Ver [RESPALDO_VERIFICADO.json](integracion_fase8/RESPALDO_VERIFICADO.json) y [RESPALDO_STORAGE.json](integracion_fase8/RESPALDO_STORAGE.json) para el estado realmente observado.

Herramientas revisables: backup_privado.mjs, backup_storage.mjs y proteger-backup.ps1. Se valida host/usuario de conexión directa o Session pooler contra la referencia, puerto5432 y TLS; credenciales libpq por stdin/memoria, nunca por argv o logs. El archivo `.env.backup.local` permanece ignorado. No se usa una clave API como contraseña PostgreSQL.

El dump custom incluye esquema, datos y ACL de la base completa; se toma con snapshot PostgreSQL repeatable-read/read-only. El resumen agregado del mismo snapshot permite comparar contenido después de restaurar sin imprimir filas. Roles/globales sin contraseñas se archivan cifrados; la restauración privada recrea roles auxiliares y sus atributos/membresías necesarios. No se aplican globales ciegamente a roles gestionados de un proyecto remoto.

Los archivos se guardan en `%LOCALAPPDATA%/DentaIA/respaldos/fase8/`, fuera de Git, cifrados por **DPAPI CurrentUser** y con ACL limitada al usuario Windows y SYSTEM. Cada copia tiene manifiesto privado y SHA-256 del ciphertext; solo se versionan agregados sin datos personales. **Es necesario conservar este perfil Windows para descifrar**. No se ha verificado una copia off-site recuperable desde otra computadora; debe acordarse una segunda copia cifrada y su custodia antes de depender de ella como estrategia permanente.

La prueba de recuperación utiliza otro contenedor de la imagen oficial ya existente, sin red, sin puertos y con datos en tmpfs. pg_restore debe terminar con exit0; se comparan conteos y digest de 11 tablas públicas/Auth/Storage contra el snapshot. No se levantan Auth/API sobre esa copia ni se prueban logins con datos restaurados. El contenedor privado se elimina tras la verificación; el respaldo cifrado se conserva. No se alteraron ni eliminaron volúmenes del stack original.

Se registraron fallos de preparación: contraseña inicialmente rechazada; un intento interrumpido por reinicio del banco JWT; y restauración incompleta hasta incluir roles auxiliares pgsodium/pgbouncer y atributos internos necesarios para event triggers. Los reintentos de restauración reutilizan el dump cifrado existente; no se considera recuperable hasta que la herramienta confirme exit0 y comparación de contenido. No ocultar esos intentos ni confundir un dump descargado con una restauración verificada.

### Storage requiere recuperación separada

El respaldo PostgreSQL **no incluye el binario**. La copia independiente descargó 1 archivo de 436300 bytes mediante credencial de operador solo servidor, preservó el mapa bucket/ruta/metadatos dentro del archivo cifrado, comprobó estabilidad del inventario antes/después y verificó SHA-256 tras descifrar todos los bytes. Ninguna ruta, fotografía, token o identidad aparece en los informes públicos.

Para recuperación alojada: preparar destino autorizado, conservar Auth UUID y referencias de negocio, recrear bucket privado con límites/políticas revisados, recuperar los bytes por el **API de Storage** en sus rutas originales y reconciliar versiones/metadatos del motor Storage. No sobrescribir a ciegas storage.objects con un snapshot antiguo después de un upload que genere nuevas versiones. La metadata dental_photos apunta al bucket/ruta, pero el motor Storage tiene su propio ciclo de versiones. Comparar tamaño/hash, acceso propio/ajeno y vínculos finales antes de abrir tráfico.

Se verificó descarga, cifrado/descifrado y recuperación de bytes; **no se ejecutó un upload de restauración por API ni una recuperación S3 alojada completa**. No hay transacción compartida entre PostgreSQL/Storage. Esta limitación debe ser aceptada o ensayada en un destino aislado antes de operaciones que puedan afectar archivos; este paquete no modifica Storage.

Referencias oficiales consultadas: [Backups y limitaciones Free/Storage](https://supabase.com/docs/guides/platform/backups), [recuperación a instancia aislada](https://supabase.com/docs/guides/self-hosting/restore-from-platform). La guía CLI de esta máquina se verificó con --help; no se usaron flags de versiones anteriores sin comprobarlos.

## 7. Punto de control obligatorio, aún sin superar

Estado verificado del respaldo: dump **420450 bytes**, pg_restore exit0 y contenido coincidente en **11 tablas**, **24 membresías** recreadas en la copia offline; globales sin contraseñas archivados. Binario Storage **436300 bytes** cifrado/descifrado y hash coincidente. Carpeta privada de recuperación: `%LOCALAPPDATA%/DentaIA/respaldos/fase8/2026-11-04T00-09-59-697Z/` (nombre UTC; ejecución del 03/11 en America/Lima). No se publican dump, binario ni mapa de rutas. Lectura remota final: cinco tablas públicas, cinco usuarios, una foto/objeto, RLS activo, cero esquemas nuevos y cero secretos Vault.

Antes de DDL/DML remoto se debe entregar y revisar:

- Destino Dental-IA/ref exacta y los cuatro archivos/SHA de PAQUETE_PROPUESTO.json.
- Inventario afectado: 14 tablas nuevas, helpers/rol y cinco RPC, dos políticas técnicas e índice en tablas existentes; cero ALTER de columnas originales, cero borrado de filas, cero cambios Storage/Auth al aplicar.
- Respaldo PostgreSQL realmente restaurado y binarios cifrados verificables; aceptar expresamente las limitaciones de recuperación descritas, sin asumir PITR en Free.
- Simulación final, controles de privilegios, lectura del catálogo fresco y ventana sin cambios de esquema; evaluar suspensión de escrituras de la aplicación durante la comparación final, sin detenerla automáticamente.
- Riesgos: locks breves, btree_gist/capacidades managed, nuevos privilegios técnicos, dependencia administrativa y activación clínica todavía pendiente.
- Recuperación: transacción fallida revierte ese archivo; detener dependientes. Si hay commits previos, conservar esquemas cerrados y evidencia; no DROP CASCADE ni restauración total sobre datos nuevos sin autorización. Corrección hacia delante tras ensayo. Mantener RPC/transportes cerrados durante diagnóstico.

**No se aplicó ninguna migración ni fixture remoto.** Se requiere aprobación final específica del responsable. No se solicita una autorización genérica para cambios desconocidos. Crear tablas vacías no habilita automáticamente endpoints, cuentas o historiales.

## 8. Servicios, permisos y desarrollo compartido

Los ocho métodos y cuatro RPC clínicos conservan contratos efectivos de CONTRATOS_API y backend_mvp/CONTRATOS_CLIENTE.ts. Anelis no obtiene permisos por existir en dentists; Angie no recibe patient_records por tener profiles. Profesional requiere rol efectivo, verificación y membresía; paciente requiere ficha activa. Ningún administrador accede automáticamente a contenido clínico.

| Método y ruta | Local Docker | Dental-IA remoto | Vercel producción/Preview |
|---|---|---|---|
| GET /api/professional/me | Validado | RPC/esquema ausentes; no habilitado | Bloqueado |
| GET /api/professional/requests | Validado | No habilitado | Bloqueado |
| GET /api/professional/patients | Validado | No habilitado | Bloqueado |
| GET /api/clinical/patients/me | Validado | No habilitado | Bloqueado |
| GET /api/clinical/access-grants | Validado | No habilitado | Bloqueado |
| POST /api/clinical/access-grants | Validado | No habilitado | Bloqueado |
| POST /api/clinical/access-grants/:id/revoke | Validado | No habilitado | Bloqueado |
| GET /api/clinical/patients/:patientId/history | Validado | No habilitado | Bloqueado |

El bloqueo NODE_ENV=production y URL loopback continúa intacto. El BFF local actualmente no acepta Dental-IA como URL clínica. No se declara que bastará editar .env para abrir un backend compartido.

Diseño de activación a revisar **dentro de esta misma Fase 8**, después de aprobar esquema: modo de desarrollo académico explícito, host/ref Dental-IA exactos y HTTPS, solo NODE_ENV=development y sin Vercel; flags separados y secret de cursor solo servidor. RPC cerrados por defecto, provisión de datos/roles solo sintéticos marcados en app_metadata por operador y etiqueta de entorno coherente, sin presentar remoto como qa_local. Pruebas negativas para producción, Preview, URL equivocada, credencial privilegiada y flags incompletos antes de aceptar ese cambio. No se ha implementado ni habilitado esta configuración remota.

El dataset remoto requeriría **otra aprobación concreta de DML/Auth**: dos pacientes y dos profesionales ficticios, dos clínicas y solicitudes/grants/atenciones sintéticas. Se reutilizan las fixtures locales como contrato, no como script remoto listo para ejecutar. UUID de manifiesto de lote y namespace de app_metadata para seleccionar solo registros propios; nunca limpiar por nombre/correo o TRUNCATE. Auditoría clínica y grants conservan política append-only: una limpieza puede requerir revocar/desactivar y conservar trazas en lugar de borrar. No prometer eliminación selectiva de auditoría sin revisar retención. No se crean cuentas ni se modifican permisos actuales.

Pendientes para historia clínica real: procedimiento de verificación profesional, consentimiento clínico aprobado, retención/bajas, destinatarios elegibles, descarga clínica auditada y observabilidad durable. No se habilitan historiales reales por concluir una fecha académica.

## 9. Git, equipo y resultado

Los ocho commits DI-148–151 permanecen en su rama remota y como ancestros de esta rama. Búsqueda actual de PR de feature/superusuario-admin, incluidos cerrados: sin resultado. Recomendar revisión administrativa primero y merge commit, luego revisión PR19 con ancestros comunes; no cherry-pick/squash que duplique los mismos aportes. Merge-tree con main no detectó conflictos; no sustituye revisión funcional. No fue necesaria otra rama de integración para preparar esta entrega; no se modificaron ramas de las integrantes.

Se conservaron las fuentes históricas y los informes F1–7. Los únicos cambios a harness previos incorporan --fase8 para escribir evidencias nuevas en integracion_fase8; no cambian controles de producto. No hay cambios en src, modelos remotos, workflows, Vercel, Jira o interfaces de compañeras. No se publica ni fusiona esta preparación antes de la revisión pedida por el responsable.

La [guía final del equipo](GUIA_FINAL_EQUIPO_DENTAIA.md) distingue qué se puede consumir hoy y qué exige aprobación. Esta fase **no está completada para desarrollo compartido remoto**: la preparación y la validación local no equivalen a infraestructura habilitada. No se crea una Fase 9 para ocultar pendientes; estos controles siguen formando parte de Fase 8.

## 10. Verificaciones nuevas de esta fase

| Comprobación | Entorno y método | Resultado |
|---|---|---|
| SQL incremental exacto y conservación de datos previos | Copia local del esquema remoto, filas ficticias | 4 migraciones aplicadas; 12 comprobaciones de simulación aprobadas |
| SQL/RPC/RLS/concurrencia | Misma copia incremental; claims sintéticos y conexiones authenticator | 78/78, configuración cerrada al terminar |
| Auth/JWT/HTTP y expiración/logout | GoTrue/PostgREST/Next locales, firma ES256 real | 59/59 |
| Integración MVP/MFA/roles/Storage | Seis cuentas y datos locales ficticios, servicios reales locales | 45/45 |
| Restricciones Storage | API local y JWT paciente | 3/3; MIME415, tamaño413, carpeta ajena403 |
| Cierre de ocho rutas | Build local NODE_ENV=production y flag true | 8/8 HTTP404/no-store |
| Suite Node | Fixtures/dobles unitarios | 269/269, cero fallidas |
| TypeScript/build/npm audit/diff | Local | Exit0; cero vulnerabilidades |
| Respaldo PostgreSQL | Lectura remota; recuperación aislada offline | Dump completo cifrado y restauración verificada, sin DDL/DML remoto |
| Respaldo binario Storage | Descarga remota autorizada; recuperación de bytes local | 1 archivo íntegro, sin upload ni cambios remotos |
| Esquema/Auth/RLS actuales | Metadatos/HTTP settings de Dental-IA, solo lectura | Inspeccionados; no equivale a pruebas funcionales de los RPC nuevos |
| Nuevos RPC/HTTP y dataset en Dental-IA | Pendiente de aprobación y activación | NO EJECUTADOS; no disponibles remotamente |

Los 59/45/3 ensayos HTTP usan el banco local oficial preexistente, no la copia SQL ni Dental-IA. El paquete incremental exacto tiene su banco SQL separado. No sumar baterías superpuestas ni atribuir mocks a remoto. Los adaptadores Next administrativos HTTPS permanecieron apagados; la batería administrativa verificó DI-150 y RPC con MFA real local, no habilitación de escritura HTTP administrativa.

Evidencias de esta fase en [integracion_fase8](integracion_fase8/README.md), con [comprobaciones finales](integracion_fase8/COMPROBACIONES_FINALES.json). Los resultados F1–7 se conservan como antecedentes. Se restauraron configuración Auth y bancos locales, sin afectar los tres registros previos de F2/F3. El warning MODULE_TYPELESS_PACKAGE_JSON de Node es preexistente y no falló las pruebas; no se cambió package.json para silenciarlo.
