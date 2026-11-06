# Modelo conceptual revisado

La cuenta Auth es la identidad común dentro de DentaIA. Puede tener perfil personal, una ficha de paciente y una cuenta profesional verificable, sin nuevas credenciales. Paciente estable significa estable por cuenta; la deduplicación de personas con varias cuentas y la interoperabilidad externa no están resueltas ni se inventan por email.

El profesional autenticado se vincula opcional y unívocamente a una ficha publicada dentists. Su verificación es una resolución independiente, no una concesión automática de rol. Las pertenencias a clínicas son episodios N:M con vigencia; una misma identidad puede ejercer en varias, sin reasignar una membresía a otra persona. El directorio público académico conserva su carácter de demostración.

Un paciente tiene atenciones de distintas clínicas dentro de DentaIA. Cada atención referencia la membresía de origen y separa fecha asistencial de fecha de registro. Antecedentes, diagnósticos y tratamientos son entradas profesionales, no salidas de IA. Documentos/exámenes conservan fecha y disponibilidad; su vigencia clínica la determina el profesional, no un booleano calculado por el sistema.

Las correcciones son versiones con motivo y origen estable. Conceder acceso a una atención seleccionada no comparte automáticamente futuras atenciones o correcciones. El paciente autoriza lectura a una membresía concreta con propósito y vencimiento. La tabla puente define los recursos; una concesión vacía no permite contenido. Revocación, expiración y suspensión del destinatario se comprueban en cada página o descarga. La clínica de origen puede ser distinta de la clínica del lector autorizado.

La auditoría registra accesos permitidos/denegados antes de entregar. No guarda el texto clínico; identificadores no comprobados de solicitudes rechazadas se registran como NULL, no como FK inventadas. Administrar roles no concede permiso clínico.

Una solicitud académica no es una cita confirmada ni una atención. La fotografía personal tiene consentimiento de almacenamiento; no equivale a documento clínico ni autorización para inferencia o entrenamiento. Las autorizaciones de análisis son por foto y propietario y tienen finalidad separada.

Dataset, versión de modelo y evaluación son investigación futura. Sus sujetos no se enlazan a Auth; las fotos personales no se reutilizan para entrenar. Un trabajo autorizado produce cero o un resultado orientativo y recomendaciones educativas explicadas. Cuando no puede evaluarse no se inventa clase. No hay entrenamiento ni validación clínica acreditados.

Ver el [DER completo](diagramas/04-der-general.mmd), los cuatro DER por dominio y el [diccionario](DICCIONARIO_DATOS.md). Identificadores administrativos sin FK se presentan como referencias lógicas, no relaciones físicas inventadas.
