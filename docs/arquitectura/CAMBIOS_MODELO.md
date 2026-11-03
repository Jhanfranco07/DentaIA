# Diferencias del modelo revisado

Fuente original conservada: `../evidencias/arquitectura/`. No se sobrescribió ninguna evidencia original.

| Cambio | Antes | Propuesta revisada | Justificación |
|---|---|---|---|
| Tablas | 29 | 29 | No se crean entidades innecesarias. |
| Columnas | 214 | 219 | Cinco campos derivados de reglas ya exigidas en el original. |
| clinical_encounters.correction_reason | Ausente | text NULL | Motivo obligatorio si replaces_id está presente. |
| clinical_entries.correction_reason | Ausente | text NULL | Misma justificación para correcciones de entradas. |
| analysis_jobs.lease_id | Ausente | uuid NULL | Identificar la reserva privada vigente del trabajador. |
| analysis_jobs.lease_expires_at | Ausente | timestamptz NULL | Recuperar un trabajo abandonado sin aceptar un resultado de una reserva vencida. |
| analysis_jobs.attempt_count | Ausente | integer NOT NULL DEFAULT 0 | Contabilizar adquisiciones/reintentos sin inventar ejecución. |
| professional_accounts.dentist_id | NOT NULL | NULL permitido + UNIQUE | La publicación del directorio no debe ser requisito para verificar identidad profesional. |
| analysis_results.label | NOT NULL | NULL permitido según calidad | Un resultado no evaluable no tiene clase ni score inventados. |
| Membresía | UNIQUE(clínica,profesional) | UNIQUE(clínica,profesional,inicio) + exclusión | Representar episodios sucesivos sin sobrescribir procedencia. |
| Reemplazos | FK simple | FK compuesta de origen + UNIQUE + anti-ciclo | No cambiar de paciente/contexto ni crear versiones bifurcadas. |
| FKs existentes | Solo texto, fk=null | Seis relaciones estructuradas, incluida la compuesta | Mantener concordancia con catálogo y DER. |
| Datos personales IA | RESTRICT genérico | CASCADE de autorización/job/resultado desde foto/propietario | Evitar una regresión del borrado personal existente. |
| Clave candidata de dental_photos | No existe | UNIQUE(id,user_id) solo en fase IA | Permite FK compuesta foto-propietario; no se atribuye al catálogo actual. |
| Métricas y dataset | Reglas en prosa | CHECK, exclusión y triggers preparados | Concurrencia/estructura comprobables cuando exista QA SQL. |

El JSON mantiene campos de descripción originales como antecedente, pero `primary_key`, `unique`, `candidate_keys_proposed`, `foreign_keys`, `checks`, `indexes_sql` y `phase` son las definiciones revisadas. Una clave candidata propuesta no es una restricción existente. Cada FK indica acción ON DELETE y tipos compatibles.

Los estados, límites de texto, nombres de bucket clínico y tipos de documento propuestos necesitan acuerdo del equipo. No se sustituyen los CHECK is_demo ni el consentimiento académico actuales.
