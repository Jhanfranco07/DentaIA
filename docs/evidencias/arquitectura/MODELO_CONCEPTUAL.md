# Modelo conceptual

La identidad Auth es común. Una cuenta tiene cero o un perfil y puede representar un paciente y un profesional verificado sin duplicar credenciales. La ficha pública dentists sigue siendo la referencia del directorio; professional_accounts la vincula a Auth de manera verificada y opcional. Una clínica contiene muchas membresías y un profesional puede pertenecer a varias clínicas. Tener membresía no autoriza por sí mismo a consultar a un paciente.

Un paciente tiene una identidad estable entre clínicas y muchas atenciones. Cada atención conserva membresía de origen, fecha de atención y de registro. Los antecedentes, diagnósticos y tratamientos son entradas tipadas registradas por el profesional de origen; los exámenes son documentos asociados. Una corrección referencia la versión anterior. No se sobrescribe el pasado ni se concede validez automática a un examen.

El paciente concede acceso de lectura a una membresía concreta, con vigencia y atenciones seleccionadas. La tabla puente resuelve la relación N:M concesiones–atenciones. Una concesión vacía no permite nada. Revocación, expiración, suspensión profesional y cambio de clínica se comprueban en cada acceso. La procedencia de las atenciones puede ser una clínica distinta de la del lector autorizado: no es interoperabilidad externa.

Solicitud académica y atención clínica son conceptos distintos: requested/cancelled no confirma cita ni crea encuentro. La fotografía personal y el consentimiento académico existentes se conservan. Autorizar almacenamiento no autoriza consulta clínica, análisis ni entrenamiento.

Un modelo exploratorio tiene versiones reproducibles y se evalúa sobre versiones de datasets separadas por sujeto. Un trabajo de análisis produce como máximo un resultado, que puede justificar varias recomendaciones educativas. Esta cadena es futura; la demo actual usa casos reconocidos y reportes locales.

La administración no forma una jerarquía clínica. app_metadata.dentaia sigue siendo autoridad del rol administrativo en la rama actual; las tres tablas dentaia_admin son soporte de revisión, aprobación y auditoría, no otra tabla canónica de roles.

Las cardinalidades detalladas están en [diagramas](DIAGRAMAS.md) y [diccionario](DICCIONARIO_DATOS.md). La auditoría de accesos denegados permite paciente/actor NULL para no fabricar una relación cuando la identidad o el recurso no existen.
