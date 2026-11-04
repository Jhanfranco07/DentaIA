# Auditoría integral de arquitectura — 03/11/2026

Rama local `docs/auditoria-arquitectura-integral`, base c992a142. Sin commits, push, PR, merge, cambios funcionales o escrituras en Supabase/Jira. Se preserva el insumo original y DI-151.

**Dictamen:** modelo físico definitivo propuesto para revisión y QA sintético, **no aprobado para producción**. Se revisan las 29 tablas y 214 columnas originales; el modelo corregido tiene 29 tablas y 219 columnas. No se agrega ninguna entidad de negocio.

| ID | Severidad | Estado de la corrección | Hallazgo | Evidencia y decisión |
|---|---|---|---|---|
| H01 | Media | Corregido | Ubicación del paquete | La documentación estaba en docs/evidencias/arquitectura, no en la ruta indicada. Se conserva intacta y se crea esta copia auditada. [README.md](README.md) |
| H02 | Alta | Corregido en diseño | FK reales omitidas del JSON | Los 43 campos existentes tenían fk nulo aunque el catálogo incluye seis FK, una compuesta. Se modelan explícitamente sin inventar relaciones administrativas. [MODELO_DATOS.json](MODELO_DATOS.json) |
| H03 | Media | Corregido | Diccionario semántico insuficiente | Las descripciones repetían el nombre del campo. Se explican identidad, contexto, procedencia, disponibilidad, valores nulos y autorización. [DICCIONARIO_DATOS.md](DICCIONARIO_DATOS.md) |
| H04 | Alta | Corregido | DER general incompleto | El general omitía parte de administración, datasets y evaluación. Ahora representa 29 entidades de negocio y Auth como entidad externa. [diagramas/04-der-general.mmd](diagramas/04-der-general.mmd) |
| H05 | Media | Corregido | Cardinalidades divergentes | UNIQUE(job_id) implica como máximo un resultado; UNIQUE(replaces_id) implica cadena sin bifurcación. Se incluyen opcionalidades y FK/PK combinadas. [DIAGRAMAS.md](DIAGRAMAS.md) |
| H06 | Alta | Propuesta corregida | Publicación obligatoria del profesional | dentist_id NOT NULL forzaba una ficha pública antes de verificar. Se propone nullable y UNIQUE; no se cambia CHECK is_demo existente ni se crea un segundo perfil con nombre duplicado. [MODELO_LOGICO.md](MODELO_LOGICO.md) |
| H07 | Alta | Propuesta corregida | Episodios de membresía | UNIQUE(clinic_id,professional_id) impedía terminar y crear otra pertenencia a la misma clínica. Se propone UNIQUE con valid_from y exclusión de solapamiento activo. [borradores_sql/01_clinical_identidad.sql](borradores_sql/01_clinical_identidad.sql) |
| H08 | Crítica de diseño | Borrador preparado | Concesión con atención de otro paciente | Dos FK simples no garantizan el mismo paciente. Un trigger bloquea y compara ambos padres; los RPC siguen pendientes y cerrados. [borradores_sql/04_clinical_integridad.sql](borradores_sql/04_clinical_integridad.sql) |
| H09 | Alta | Propuesta corregida | Correcciones sin motivo ni origen invariante | Se añaden dos correction_reason, FK compuestas de origen, UNIQUE(replaces_id), detección de ciclos y registros append-only. [borradores_sql/02_clinical_contenido.sql](borradores_sql/02_clinical_contenido.sql) |
| H10 | Media | Corregido | Retención genérica falsa | No todas las tablas usan RESTRICT: se documentan CASCADE/NO ACTION reales y la ausencia deliberada de FK en dentaia_admin. [DICCIONARIO_DATOS.md](DICCIONARIO_DATOS.md) |
| H11 | Alta | Pendiente de trazabilidad | Administración y despliegue | La validación manual declarada se acepta como tal; el catálogo actual no contiene dentaia_admin y solo registra dos migraciones de octubre. No atribuir esa validación a un despliegue aquí no observado. [FUENTES_Y_EVIDENCIAS.md](FUENTES_Y_EVIDENCIAS.md) |
| H12 | Alta | Pendiente de integración | Verificación y rol profesional | status=verified no concede Auth odontologo. La concesión está bloqueada en DI-151 y requiere una ampliación revisada del protocolo, no un trigger que otorgue roles. [BRECHAS_Y_PLAN_IMPLEMENTACION.md](BRECHAS_Y_PLAN_IMPLEMENTACION.md) |
| H13 | Alta | Contrato propuesto | Solicitudes del profesional | La RLS actual solo permite al paciente sus solicitudes. Se propone lectura controlada por professional_accounts.user_id y dentist_id; no se modifica la política actual. No hay clínica destino. [CONTRATOS_API.md](CONTRATOS_API.md) |
| H14 | Alta | Borrador preparado | Documentos y rutas privadas | Se valida la ruta contra paciente clínico y atención; la descarga debe reautorizar y auditar por ID. No guardar URL pública/firmada ni aceptar rutas libres. [borradores_sql/04_clinical_integridad.sql](borradores_sql/04_clinical_integridad.sql) |
| H15 | Alta | Contrato propuesto | Idempotencia clínica sin almacenamiento definido | La clave UUID se mapea al id de la concesión y se vincula al paciente derivado; comparar todos los parámetros y recursos. No se reactiva un permiso por reintento. [PROTOCOLO_RPC_Y_CONCURRENCIA.md](PROTOCOLO_RPC_Y_CONCURRENCIA.md) |
| H16 | Crítica de diseño | Protocolo propuesto | Revocación concurrente ambigua | Se define orden de bloqueos, linealización y revalidación por página/descarga. Una lectura ya autorizada puede acabar; no se promete retirar bytes ya vistos. [PROTOCOLO_RPC_Y_CONCURRENCIA.md](PROTOCOLO_RPC_Y_CONCURRENCIA.md) |
| H17 | Crítica de diseño | Cerrado por defecto | Bypass de auditoría por SELECT | Los borradores activan RLS y revocan acceso directo incluso a service_role. No se conceden RPC clínicos o de IA hasta implementar y validar el servicio auditado. [POLITICAS_POR_TABLA.md](POLITICAS_POR_TABLA.md) |
| H18 | Alta | Propuesta corregida | IA impediría borrar fotografías existentes | FK RESTRICT hacia foto bloquearía el algoritmo actual. Se propone CASCADE solo del subárbol privado de análisis; datasets no se vinculan a fotos personales. [borradores_sql/06_ia_analisis.sql](borradores_sql/06_ia_analisis.sql) |
| H19 | Alta | Propuesta corregida | Lease descrito sin columnas | Se añaden lease_id, lease_expires_at y attempt_count. Se validan transiciones; el trabajador y su RPC mínimo siguen futuros. [MODELO_DATOS.json](MODELO_DATOS.json) |
| H20 | Alta | Propuesta corregida | Resultado no evaluable exigía clase | label pasa a nullable y un CHECK exige label/score nulos cuando no es evaluable. No se fabrica un diagnóstico. [borradores_sql/06_ia_analisis.sql](borradores_sql/06_ia_analisis.sql) |
| H21 | Alta | Propuesta corregida | Fuga de sujetos entre splits | Una comprobación de manifiesto no impide una carrera de inserciones. EXCLUDE con btree_gist impide distinto split por dataset/sujeto. No demuestra independencia entre datasets distintos. [borradores_sql/05_ia_investigacion.sql](borradores_sql/05_ia_investigacion.sql) |
| H22 | Alta | Borrador preparado | Matriz de confusión sin estructura | Se especifica matriz cuadrada, conteos enteros no negativos, suma sample_size y etiquetas en config.labels. Los valores científicos no se inventan. [borradores_sql/07_ia_integridad.sql](borradores_sql/07_ia_integridad.sql) |
| H23 | Alta | Borrador preparado | Modelo evaluated sin evaluación | El borrador exige precision, recall, f1 y matriz en una ejecución test; dataset/artefactos se congelan. Esto no demuestra validez clínica ni entrenamiento existente. [borradores_sql/07_ia_integridad.sql](borradores_sql/07_ia_integridad.sql) |
| H24 | Media | Corregido en contrato | Errores y recencia del GET de roles | La misma función SQL exige TOTP reciente también para consultar revisión y puede devolver 409. Se añaden esos límites y errores comunes 500/503. [CONTRATOS_API.md](CONTRATOS_API.md) |
| H25 | Media | Corregido y renderizado | Sintaxis Mermaid | El motor reprodujo error en la secuencia 10 por punto y coma. Se corrigen separadores en cinco secuencias y se renderizan los 17 diagramas. [DIAGRAMAS.md](DIAGRAMAS.md) |
| H26 | Media | Actualizado | Ref de panel paciente desactualizada | La rama remota avanzó a ac545b5d; se revisó su shell cliente. No se presume guard SSR ni integración en main. [FUENTES_Y_EVIDENCIAS.md](FUENTES_Y_EVIDENCIAS.md) |
| H27 | Alta | Decisión pendiente | Estados y límites nuevos | Los CHECK y límites textuales propuestos no son acuerdos del equipo. Se requiere aceptación del vocabulario, finalidad y conservación antes de producción. [DECISIONES_ARQUITECTURA.md](DECISIONES_ARQUITECTURA.md) |
| H28 | Alta | Decisión pendiente | Identidad estable no significa persona deduplicada | UNIQUE(user_id) estabiliza la cuenta, no resuelve una misma persona con dos cuentas ni interoperabilidad externa. No inferir identidad por correo/DNI no aprobados. [MODELO_CONCEPTUAL.md](MODELO_CONCEPTUAL.md) |
| H29 | Alta | Decisión pendiente | Retención y baja de Auth clínica | Las FK RESTRICT clínicas bloquearían borrados de identidad con historia. Hace falta política de conservación/anonimización y soporte, sin inventar plazos legales. [SEGURIDAD_Y_ROLES.md](SEGURIDAD_Y_ROLES.md) |
| H30 | Alta | No ejecutado | Falta ensayo SQL efectivo | Docker no tiene daemon disponible. El AST y el render no prueban integridad en ejecución, RLS efectiva, RPC ni carreras de PostgreSQL. [PRUEBAS_Y_LIMITACIONES.md](PRUEBAS_Y_LIMITACIONES.md) |
| H31 | Media | Contrato propuesto | Frontera entre DTO real y sintético | El proveedor de Anelis usa caso/entries/origen y escenario sintético; no debe recibir un JSON real con otros nombres sin adaptador ni aceptar escenario como autorización. Se versiona clinical.v1. [CONTRATOS_API.md](CONTRATOS_API.md) |

Una severidad crítica aquí identifica una garantía ausente del **diseño propuesto**, no una explotación acreditada de la aplicación actual. Ningún hallazgo se resuelve desactivando seguridad. Un borrador preparado no equivale a una migración probada.

## Resultado por dominio

| Dominio | Tablas | Columnas originales → revisadas | Dictamen |
|---|---:|---:|---|
| Existente public | 5 | 43 → 43 | Reutilizar, sin recrear ni alterar las políticas actuales. |
| Administración DI-151 | 3 | 22 → 22 | Conservar SQL y autoría; falta conciliar entorno de validación declarada y rollout observado. |
| Clínica | 11 | 75 → 77 | QA sintético condicionado a decisiones de verificación, contexto, permisos y retención. |
| IA | 10 | 74 → 77 | Diseño futuro; no hay modelo entrenado, inferencia o validación clínica acreditados. |

## Cómo revisar cada tabla

El diccionario enumera todos sus campos, PK, FK, UNIQUE, CHECK, defaults, índices, fase y conservación. MODELO_DATOS.json es la fuente común. Los siete borradores SQL traducen las 21 tablas nuevas y sus invariantes; las tablas existentes se inventarían, no se recrean en migraciones de negocio. La migración administrativa se referencia sin copiarla ni cambiarla.

Los criterios funcionales se contrastaron con los 171 registros Jira (incluidas descripciones), las referencias Git y catálogo remoto sin filas. La lista de pruebas reales/estáticas y limitaciones está en [PRUEBAS_Y_LIMITACIONES.md](PRUEBAS_Y_LIMITACIONES.md).
