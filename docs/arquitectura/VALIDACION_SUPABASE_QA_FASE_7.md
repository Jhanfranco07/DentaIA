# Fase 7 — Supabase QA, validación integral y entrega de backend

Fecha: 03/11/2026, America/Lima. Responsable: Jhan Franco. DI-36 permanece en Sprint 6; no se modificó Jira. Rama `docs/auditoria-arquitectura-integral`. **La infraestructura compartida no está disponible y el sistema no está validado para uso clínico.**

## Estado inicial y PR #19

HEAD inicial `55d0683192c7754e690689652246541261f95550`, árbol limpio, staging vacío. Se ejecutó fetch; main `1bcb84956e755b4089494af43f983fd0d2e5bfad`. PR [#19](https://github.com/Jhanfranco07/DentaIA/pull/19) abierto, Draft, base main, mergeable=true. `git merge-tree --write-tree --name-only origin/main HEAD` no encontró conflictos, sin fusionar ramas. No hay cambios locales iniciales sin publicar.

Se leyeron CONSOLIDACION_BACKEND_MVP, VALIDACION_SQL_RLS, IMPLEMENTACION_SERVICIOS_CLINICOS, VALIDACION_HTTP_JWT, VERSIONADO_E_INTEGRACION_GITHUB, CONTRATOS_API y sus scripts/DTO/SQL reales. El manifiesto preserva las fuentes previas; los informes F1–6 no se reutilizan como resultados nuevos.

Los checks existentes para el HEAD inicial siguen exitosos: [CI](https://github.com/Jhanfranco07/DentaIA/actions/runs/41718008171), [Tests](https://github.com/Jhanfranco07/DentaIA/actions/runs/41718008280), [Security](https://github.com/Jhanfranco07/DentaIA/actions/runs/41718008031). Son ejecuciones de F6, no pruebas nuevas de QA remoto.

## Ocho commits administrativos heredados

[AUDITORIA_INICIAL.json](qa_fase7/AUDITORIA_INICIAL.json) enumera SHA completos, autores, asuntos y archivos por commit: f6221d9, 3576c13, 12d54fb, 9d4409a, fa841a7, e6f6835, 8b36f87 y c992a14. Todos de Jhan Franco, presentes también en origin/feature/superusuario-admin; no están en main. No se encontró PR administrativo mediante búsqueda de esa rama, incluidos cerrados. La ausencia corresponde a esa consulta, no prueba de que no haya PR con otra rama.

DI-148 aporta contrato de roles; DI-149 componentes aislados; DI-150 lector de asignaciones y autorización servidor/AAL2; DI-151 lectura privada, escritura transaccional Auth/auditoría, migración y pruebas. El backend clínico importa únicamente `leerAsignacionAdministrativa` de `src/features/autorizacion/autorizacion.ts`; no hereda privilegios administrativos ni exige AAL2 clínico por analogía. El paquete MVP incluye la migración administrativa canónica; no modifica su código.

Propuesta: revisar primero un PR administrativo de la rama existente, con merge commit; después actualizar/revisar PR19 preservando ancestros comunes. Git reconocerá los mismos ocho SHA y no repetirá sus cambios; evitar cherry-pick, squash o rebase que dupliquen identidad. Hay dos commits DI-151 con asunto repetido pero SHA distintos: son cambios históricos consecutivos, no duplicados que puedan eliminarse sin revisión. Alternativa: rama de integración temporal autorizada que fusione ambas líneas y ejecute regresión, sin cambiar ramas del equipo ni main. La revisión administrativa sigue pendiente aun sin conflicto textual.

## Docker y reconstrucción local

Docker Engine 29.9.2 Linux, contexto desktop-linux; CLI existente 3.0.0, PostgreSQL 17.11. Cinco servicios oficiales: Database, Auth, REST, Storage y Kong. No se instalaron componentes nuevos. Antes de reconstruir se comprobaron los nombres y el comentario `DENTAIA_PHASE5_SYNTHETIC_ONLY` de la base controlada; F2/F3 y postgres se conservaron.

`preparar.py --recrear-qa-propia --fase7` reconstruyó exclusivamente dentaia_arch_qa_fase5 desde esquema Auth local vacío y baseline de cinco tablas públicas sin filas remotas. [Fuentes y hashes aplicados](qa_fase7/MIGRACIONES_DESDE_CERO.json): DI-151, 01–04, 08–10 e incremental servicios comunes; no 05–07 de IA.

Modelo efectivo: **19 tablas / 142 columnas / 118 restricciones / 54 índices / RLS en todas / cero tablas IA**, coincide con F5 sin ajustes para forzar cifras. Constraints, relaciones, RPC, privilegios y carreras se verifican en [REGRESION_SQL.json](qa_fase7/REGRESION_SQL.json). Este banco usa SQL con claims sintéticos, no JWT firmados; las pruebas HTTP se registran aparte.

Los harness incorporan `--fase7` exclusivamente para guardar informes nuevos en qa_fase7, conservando los anteriores. Sin el flag mantienen el comportamiento previo. No hay cambios en src, workflows, DI-150/151 o interfaces del equipo.

## QA remoto: BLOQUEADO

Organización verificada: Jhan Franco (`mrhdeaoscwglprdztrif`), Free. Inventario encontró Dental-IA y otro proyecto activos, más uno inactivo; ninguno es QA de DentaIA. El responsable autorizó crear DentaIA-QA, us-east-1, solo Free y datos sintéticos, después de cotización **US$0/mes**.

Supabase rechazó la creación por **límite de dos proyectos Free activos del propietario**. Se volvió a listar proyectos: no existe DentaIA-QA, no hay referencia QA. No se aceptó plan de pago, ni se pausaron/eliminaron recursos. No se aplicó ninguna migración ni prueba remota; Dental-IA `vwmdknzjyvmsdqpepykz` permanece expresamente prohibido. [Registro sin información personal](qa_fase7/QA_REMOTO.json).

Para continuar: el responsable debe decidir qué proyecto ajeno a Dental-IA puede pausar, o proponer una organización/cupo Free autorizado. No reutilizar otro proyecto como QA ni asumir que otra organización evade el límite por propietario. Un upgrade requiere consentimiento adicional; no está autorizado. Revalidar costo, cupo, nombre, referencia distinta del principal, esquema vacío y cuentas/Storage sin datos reales antes de escribir.

## Propuesta de aislamiento remoto — NO implementada

Las fuentes actuales bloquean SQL fuera de nombres QA locales; HTTP solo acepta http loopback y NODE_ENV distinto de production; los DTO/RPC declaran environment qa_local. No se retiraron esas guardas ni se abrió Vercel Preview. Tener proyecto remoto no bastaría para ejecutar estos archivos sin revisión.

1. Preparar paquete NUEVO de migraciones QA, generado con CLI, conservando hashes y fuentes históricas intactas. Baseline público vacío + DI-151 + 01–04 + 08–10 + incremental + políticas originales Storage. Auth/Storage gestionados se inspeccionan y NO se clonan desde Docker ni Dental-IA.
2. Preflight por Management API: nombre DentaIA-QA, organización autorizada, ref exacta obtenida tras creación y distinta del principal; abortar si hay tablas/cuentas/objetos ajenos. Guardar solo metadatos del chequeo. Cada ejecución requiere esa referencia explícita; nunca fallback a variables de producción.
3. Guardas SQL de la variante nueva: base postgres, marcador privado QA de referencia exacta, operador de migración autorizado, schemas propios vacíos y ejecución transaccional por migración; verificar privilegios managed de postgres/roles/owners/lectura mínima Auth. No usar superuser/BYPASSRLS ni conceder Auth a clientes para sortear errores. Detener ante incompatibilidad.
4. Adaptador futuro: modo explícito local o qa_remote, ref QA allowlist fuera de producción, https://<ref-exacta>.supabase.co sin rutas/credenciales/redirects; credencial publicable únicamente. Rechazo incondicional NODE_ENV=production y entorno Vercel incluso Preview; variable QA sola no habilita producción. TTL/cursor/session/DTO y auditoría conservados. Evaluar etiqueta environment qa_remote versionada, sin etiquetar remoto como qa_local.
5. Agregar negativos para ref principal, ref no aprobada, HTTP remoto, URL con usuario/path/query, clave privilegiada, flags incompletos, production/Preview, JWT alterado/revocado y fuga de campos. Aprobar antes de implementar. Esta fase NO incorpora un allowlist vacío que aparente estar operativo.

[PLAN_MIGRACIONES_QA.json](qa_fase7/PLAN_MIGRACIONES_QA.json) contiene orden y hashes, estado preparado/no desplegado y bloqueos. Las fuentes actuales NO son un db push listo para hosted.

## Auth, RLS, RPC, auditoría y Storage

Se utilizan seis identidades locales sintéticas: pacientes A/B, odontólogos A/B, paciente sin contexto profesional y superusuario. Dos clínicas, recursos y concesiones ficticios. `regresion_http_f4.mjs` crea/reutiliza solo cuentas con marcador qa_http_phase=4; contraseñas aleatorias en memoria, ni tokens ni secretos persistidos. Fixtures de preparar_sql.py y servicios_clinicos/pruebas reconstruyen los contextos. La comprobación de cuentas ajenas aborta antes de modificarlas.

RPC públicos: grant_clinical_access, revoke_clinical_access, get_authorized_clinical_history, get_clinical_workspace. Wrappers INVOKER; ejecutor privado NOLOGIN/NOBYPASSRLS; identidad actual releída, sesión real, clínica/membresía/verificación y concesión por acción. Superusuario no obtiene acceso clínico automático. Auditoría falla cerrada; revocación propia sigue permitida aunque lectura/concesión están apagadas, excepción de seguridad deliberada.

Storage usa dental-photos privado, JPG/PNG/WebP, 8 MiB, políticas originales por propietario y consentimiento academic_photo_storage. No equivale a consentimiento clínico. Pruebas con PNG de un píxel, sin fotografías reales; operaciones sobre cuentas QA propias solamente. Metadatos y algoritmo de eliminación original se reutilizan.

Los resultados nuevos por entorno se incorporan en la tabla final; escenarios remotos, suspensión real Auth hospedada, entrega de correo y recorrido visual de las interfaces del equipo permanecen NO EJECUTADOS. El cambio de estado/membresía sintético no se confunde con suspensión administrativa remota.

## Recuperación, disponibilidad y Fase 8

No hay rollback destructivo automatizado remoto. Ante fallo: cerrar transporte, mantener configuración clínica disabled, preservar auditoría y consultar migración fallida; no compensar con DROP CASCADE/RLS off. Snapshot QA antes de cada lote y restauración ensayada; recrear solo proyecto QA sintético requiere autorización explícita. Storage no comparte transacción con PostgreSQL.

Anelis puede adaptar un proveedor opt-in a los contratos tipados, probar estados vacíos/errores/mocks y, con Docker local, peticiones reales de contexto/solicitudes/pacientes/historial. Angie puede adaptar identidad, concesiones/revocación y reutilizar SDK personal bajo RLS. No tienen todavía backend alojado compartido; no se exige Docker como si fuera una alternativa remota. No se modificaron sus interfaces.

Fase 8 propuesta: (1) resolver cupo Free sin afectar Dental-IA; (2) crear/verificar QA independiente; (3) revisar y ensayar variante managed y migraciones desde cero, grants/owners y rollback; (4) aprobar aislamiento HTTP remoto y probar negativos; (5) cuentas sintéticas/provisión profesional bajo operador, JWT/RLS/Storage/auditoría/concurrencia reales; (6) integración acordada de providers/UI de ambas autoras; (7) mantener PR19 Draft hasta resolver administración y evidencias. No desplegar clínica en producción.

Pendientes transversales: verificación profesional operativa; versión/texto/vigencia del consentimiento clínico; retención/bajas; selección segura de destinatarios; descarga clínica reautorizada/auditada; observabilidad durable; procedimientos de soporte. IA: futuro, excluido. No declarar DI-36 ni las historias del equipo Listo.

## Resultados nuevos de Fase 7, por entorno

| Comprobación | Entorno / método | Resultado nuevo | Evidencia |
|---|---|---|---|
| Paquete desde cero y modelo físico | Docker, PostgreSQL y esquema Auth oficial vacío | 19/142/118/54, RLS true, IA 0 | [Migraciones](qa_fase7/MIGRACIONES_DESDE_CERO.json) |
| RLS/RPC, permisos y concurrencia | SQL con claims sintéticos; conexiones reales authenticator donde corresponde | 78 aprobadas, 0 fallidas | [SQL](qa_fase7/REGRESION_SQL.json) |
| Firma, expiración, logout, grants/historial/cursor y auditoría | GoTrue/PostgREST/Next locales, JWT ES256 reales | 59 aprobadas, 0 fallidas | [HTTP/JWT](qa_fase7/REGRESION_HTTP_F4.json) |
| Datos MVP, cinco GET workspace, perfiles/solicitudes/fotos, MFA y roles | Seis cuentas locales, Auth real, SQL y Storage; fixtures sintéticos persistidos | 45 aprobadas, 0 fallidas, ejecución integral nueva | [MVP](qa_fase7/HTTP_MVP.json) |
| MIME, tamaño, propietario Storage | API Storage local, JWT paciente real | 3 aprobadas: 415/413/403 | [Storage](qa_fase7/STORAGE_LIMITES.json) |
| Cierre productivo | Build Next local NODE_ENV=production, flag true | 8/8 HTTP404 y no-store | [Cierre](qa_fase7/PRODUCCION_CERRADA.json) |
| Suite Node | Dobles unitarios/fixtures, no prueba de hosted | 269/269, 0 fallidas | [Comprobaciones](qa_fase7/COMPROBACIONES_FINALES.json) |
| TypeScript, build, audit y diff-check | PC local | Exit 0; audit 0 vulnerabilidades | [Comprobaciones](qa_fase7/COMPROBACIONES_FINALES.json) |
| Auth/RLS/RPC/Storage/HTTP remoto | Supabase QA hospedado | BLOQUEADO: proyecto no creado; 0 pruebas | [Bloqueo](qa_fase7/QA_REMOTO.json) |
| UI real de Anelis/Angie, correo, suspensión Auth hosted | No ejecutado | PENDIENTE; no inferir desde mocks/compilación | Guía frontend |

No sumar estas baterías como casos únicos: hay regresiones y escenarios superpuestos. Los 45 casos MVP son una nueva ejecución completa con 45 aprobadas, distinta del cierre acumulado de F5. Los nueve escenarios administrativos usan RPC canónico con MFA/AAL2 real local; los adaptadores Next DI-151 HTTPS de lectura/escritura permanecieron apagados. No se afirma su flujo HTTP habilitado. El warning de Node sobre MODULE_TYPELESS_PACKAGE_JSON no produjo fallo; no se cambió package.json para silenciarlo.

[MFA_LOCAL_RESTAURACION.json](qa_fase7/MFA_LOCAL_RESTAURACION.json) confirma config original restaurada, infraestructura saludable y F2/F3 conservadas. [QA_CERRADO.json](qa_fase7/QA_CERRADO.json): lectura/concesión clínica HTTP y SQL desactivadas, JWT3600, tres atenciones previas por base, cero usuarios ajenos. La revocación autenticada propia conserva su excepción deliberada. Los 59 JWT incluyen expiración auténtica y logout; no se simularon sus firmas.

### Clasificación de entrega

- **Validado localmente:** modelo, cuatro RPC, ocho métodos HTTP, RLS, Auth/JWT, auditoría, Storage privado, MFA/RPC administrativo y regresión indicada.
- **Validado en Supabase QA:** ninguno; no hay referencia QA creada.
- **Preparado, pero no desplegado:** orden/hashes del paquete y propuesta de guardas managed/remotas; requiere convertirla en migraciones nuevas revisadas.
- **Pendiente de integración:** providers y estados de las interfaces DI-145/146, sin modificar componentes de sus autoras.
- **Bloqueado:** proyecto QA Free por cupo; backend compartido y verificación hospedada.
- **Futuro:** IA y uso clínico productivo, fuera de esta fase.

Se generó [GUIA_INTEGRACION_FRONTEND_QA.md](GUIA_INTEGRACION_FRONTEND_QA.md) con contratos, ejemplos sintéticos por endpoint, variables sin credenciales, estados UI y procedimientos. No se solucionó el bloqueo de infraestructura pausando proyectos ni debilitando seguridad.
