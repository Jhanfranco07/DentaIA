# DI-134 — Diseño del reporte preventivo explicable

**Proyecto:** DentaIA · **Actividad:** [DI-134](https://jhanfranco.atlassian.net/browse/DI-134) · **Integración posterior:** [DI-42](https://jhanfranco.atlassian.net/browse/DI-42)
**Entrega:** diseño técnico sin implementación · **Base revisada:** origin/main, SHA 305da97e229aa4f57f7383b09d7196c3c3432378 · **Fecha:** 23 de noviembre de 2026.

## 1. Objetivo, alcance y evidencia

Diseñar una vista de reporte preventivo explicable **dentro de /analisis**, sin ruta nueva. Debe separar observaciones derivadas de una fotografía efectivamente evaluada, información educativa predefinida y explicaciones opcionales; identificar su procedencia; explicar límites e incertidumbre; y orientar hacia el directorio odontológico. El resultado es orientativo, no un diagnóstico ni una validación clínica.

DI-134 entrega esta especificación. DI-42 podrá integrar el diseño aprobado en una entrega posterior. Este documento no autoriza código, PDF del análisis real, almacenamiento, intercambio de resultados, activación de Smile, cambios de autorización ni servicios nuevos.

La evidencia aquí es **lectura estática** del SHA indicado y consulta de Jira en modo lectura. No se ejecutaron servicios, fotografías, sesiones ni pruebas de integración. La presencia de código o de pruebas estáticas no acredita funcionamiento en producción.

## 2. Criterios reales y correcciones a la auditoría adjunta

[DI-134](https://jhanfranco.atlassian.net/browse/DI-134) pide mostrar solo hallazgos evaluados, límites e incertidumbre sin diagnóstico, con privacidad y evidencia verificable. [DI-42](https://jhanfranco.atlassian.net/browse/DI-42) exige distinguir resultados evaluados de ejemplos, no atribuir hallazgos a fotografías no evaluadas, explicar límites y facilitar directorio y consulta profesional. **No exigen persistencia, PDF, fotografía en PDF, historial ni acceso compartido.**

| Afirmación del informe de Claude | Verificación en origin/main | Corrección |
|---|---|---|
| /analisis/demo es un flujo público activo | [La ruta](<../../src/app/(public)/analisis/demo/page.tsx>) redirige a /analisis. [Demostracion.tsx](../../src/features/analisis/Demostracion.tsx) permanece en el repositorio, sin importación en rutas activas encontrada por búsqueda estática. | La demo antigua es referencia histórica, no flujo disponible. |
| /resultados vacío es vulnerabilidad crítica | [MisResultados.tsx](../../src/features/analisis/MisResultados.tsx) es un placeholder explícito; [la página](<../../src/app/(paciente)/resultados/page.tsx>) usa AccesoRol. | Es funcionalidad pendiente; no hay exposición crítica demostrada. |
| DI-42 debe añadir historial, consentimiento de almacenamiento y acceso compartido | El adaptador [smile-history-server.ts](../../src/features/analisis/smile-history-server.ts) existe, pero esos requisitos no figuran en DI-42. | Persistencia y compartición requieren una decisión y revisión de privacidad separadas. |
| DI-134 exige habilitar Smile en producción | [smile-preview.ts](../../src/features/analisis/smile-preview.ts) contiene puertas por entorno. | Diseñar indisponibilidad; no activar ni recomendar activación productiva. |
| PDF con fotografía e ID temporal son necesarios | [pdf.ts](../../src/features/analisis/pdf.ts) genera PDF de casos demo y no recibe SmileResult. | Sin PDF real ni UUID/reportId en este diseño. Exportación y foto quedan pendientes. |
| El evento del asistente no tiene receptor o prueba una fuga | [ResultadosVisuales.tsx](../../src/features/analisis/ResultadosVisuales.tsx) emite conteos; [AsistentePaciente.tsx](../../src/features/asistente/AsistentePaciente.tsx) los valida y recibe; [PortalShell.tsx](../../src/components/PortalShell.tsx) monta el asistente en paciente. | Existe receptor en código. No se verificó la ejecución integral ni se demostró fuga. |
| El layout paciente protege por sí solo /analisis | [La página](<../../src/app/(paciente)/analisis/page.tsx>) monta AnalisisDental; el layout monta PortalShell, sin AccesoRol en esa página. [La API Smile](../../src/app/api/desarrollo/dentaia-smile/route.ts) sí llama a authorizeVisionDemoRequest. | Diferenciar agrupación visual y autorización efectiva del servidor; probar acceso sin sesión en DI-42. |
| Hay que sustituir los contratos | [smile-contract.ts](../../src/features/analisis/smile-contract.ts) ya define los tipos y validadores necesarios. | Reutilizarlos y derivar únicamente la presentación. |

También se verificó en código: la API Smile devuelve 429 por límite y 503 por indisponibilidad; [AnalisisDental.tsx](../../src/features/analisis/AnalisisDental.tsx) no crea resultado si la respuesta falla. La [ruta de explicación](../../src/app/api/desarrollo/dentaia-smile/explain/route.ts) puede devolver plantilla determinista. La fase de detalle existe en AnalisisDental, pero no se observó una acción hacia ella en ResultadosVisuales. Son hechos estáticos, no pruebas de servicio.

## 3. Arquitectura actual y propuesta

| Capa | Estado leído | Propuesta para DI-42 |
|---|---|---|
| Entrada | /analisis, AnalisisDental y FotografiaPreparacionContexto mantienen File y estado React en memoria. | Mantener flujo y consentimiento de envío temporal; no serializar resultados. |
| Servidor | POST /api/desarrollo/dentaia-smile comprueba autorización, límite y puerta Smile antes de llamar al servicio si está habilitado. | No cambiar API ni controles; mostrar error sin reporte ante fallo. |
| Contrato | SmileAnalysisResponse validada por isSmileAnalysisResponse; explicación separada validada por isSmileExplanation. | Fuente única para observaciones; no inventar datos. |
| Presentación | ResultadosVisuales muestra tarjetas de tonalidad, estructura y explicación. | Evolucionar esas tarjetas a reporte visual dentro de la fase resultado, sin arquitectura paralela. |
| Orientación | Enlaces existentes a buenas prácticas y /panel/odontologos. | Hacer visibles los próximos pasos y consulta profesional. |

[Demostracion.tsx](../../src/features/analisis/Demostracion.tsx), [casos.ts](../../src/features/analisis/casos.ts) y [pdf.ts](../../src/features/analisis/pdf.ts) solo aportan patrones editoriales y de presentación; sus casos predefinidos no son análisis de usuarios. El adaptador de historial existe, pero no se invoca en este diseño.

## 4. Secciones visuales del reporte

1. **Encabezado:** «Reporte preventivo orientativo» y «No es un diagnóstico». La fecha/hora local de visualización es opcional, si el equipo la aprueba; no se presenta como fecha clínica.
2. **Procedencia:** diferenciar «Observaciones de esta fotografía», «Orientación educativa predefinida» y «Explicación opcional». Etiquetar fuente openai, template o mock cuando corresponda; mock nunca como análisis real.
3. **Calidad y cobertura:** estado evaluable, parcialmente evaluable o no evaluable; regiones evaluables/detectadas y advertencias de iluminación. Cobertura no es precisión diagnóstica.
4. **Tonalidad:** solo conteos de regiones con evaluable=true derivados de SmileResult. No llamarlas dientes afectados ni inferir enfermedades.
5. **Estructura visible:** solo cuando oral_analysis.status sea evaluated, contar detecciones toothLoss/dentalCrowding como *zonas posibles*. Si está unavailable o ausente, mostrar indisponibilidad y omitir cifras.
6. **Explicación y siguientes pasos:** SmileExplanation validada si existe, con atribución; si sigue pendiente, estado de espera. Mensajes generales identificados como educativos. Enlaces a [buenas prácticas](<../../src/app/(paciente)/buenas-practicas/page.tsx>) y [directorio del paciente](<../../src/app/(paciente)/panel/odontologos/page.tsx>), más «Analizar otra fotografía».

En móvil, tarjetas en una columna y orden de lectura igual al visual. Imagen/overlay solo como apoyo en pantalla durante el estado local; sin PDF ni almacenamiento.

## 5. Contrato compatible y procedencia de los datos

La fuente continúa siendo SmileAnalysisResponse: result: SmileResult, oral_analysis?: OralBasicAnalysis y overlay_url?: string. La explicación separada es SmileExplanation | null. Una proyección **conceptual** para la UI reúne resultado validado, oral opcional, explicación opcional y estado de espera. No se propone reemplazar tipos, API o validadores; TypeScript por sí solo no valida datos de red. No se incorpora reportId, imageRef ni objeto serializado que sugiera persistencia.

| Campo visible | Origen | Regla |
|---|---|---|
| Estado, regiones, iluminación, warnings y limitations | SmileResult validado | Mostrar solo observaciones respaldadas y omitir mediciones nulas. |
| Posibles zonas de estructura | OralBasicAnalysis con status=evaluated | Falta o unavailable no equivalen a cero hallazgos. |
| Resumen | SmileExplanation validada y su source | Atribuir IA, plantilla o simulación correctamente. |
| Consejos generales y advertencias | Texto editorial predefinido | Identificar como educación, no observación fotográfica. |
| Foto/overlay en pantalla | File y respuesta temporal | No exportar, guardar ni transmitir a canales nuevos. |

## 6. Estados, incertidumbre y fallos

| Estado | Mostrar | Evitar |
|---|---|---|
| evaluable | Observaciones de regiones evaluables, cobertura y limitaciones. | Diagnóstico, «salud confirmada», porcentaje de precisión. |
| partially_evaluable | Solo regiones evaluables y cobertura parcial. | Extrapolar a regiones no evaluables. |
| not_evaluable | «La fotografía no permite una observación suficiente» y acción de nueva foto. | Conteos de variación como hallazgos. |
| oral ausente/unavailable | «La observación de estructura no estuvo disponible». | Cero ausencias/cero apiñamientos como resultado medido. |
| Explicación pendiente/fallida | Estado de espera o plantilla con source=template si se produjo. | Atribuir texto de plantilla a IA. |
| 401/403, 429, 503, 504 o respuesta inválida | Mensaje de acceso, límite o indisponibilidad; reintento cuando corresponda. | Crear reporte o mostrar datos de un intento anterior como actuales. |

Mensajes modelo: «Las regiones detectadas son zonas de la imagen, no dientes diagnosticados»; «La luz, las sombras y el encuadre pueden modificar lo observado»; «Una fotografía no descarta enfermedades ni sustituye una evaluación odontológica». Las limitaciones devueltas por el backend deben conservarse con explicación comprensible. No se inventan causas ni recomendaciones clínicas individualizadas.

**Ejemplos ficticios, no observados:** (A) status=partially_evaluable, detected_regions=4, evaluable_regions=2: «Se pudieron revisar 2 de 4 regiones; las otras 2 no aportan observaciones». (B) status=not_evaluable y oral_analysis ausente: «No hay observaciones evaluables en esta fotografía». Ninguno acredita capacidad clínica o resultado real.

## 7. Accesibilidad, navegación y privacidad

**Accesibilidad.** h1/h2 en orden, secciones con aria-labelledby, estados de proceso/error anunciados sin releer todo el reporte, foco visible y recorrido lógico por teclado. Al pasar a resultado, llevar foco al título o estado; al volver, restaurarlo. Conteos y estados en texto, no solo color o overlay. Alt de imagen funcional sin afirmación diagnóstica. Validar 390 px, escritorio, zoom 200 %, contraste, lector de pantalla y ausencia de scroll horizontal. El aria-live actual de ResultadosVisuales es evidencia de implementación, no prueba de usabilidad.

**Privacidad.** Reutilizar el consentimiento de **envío temporal** de AnalisisDental; no tratarlo como permiso de almacenamiento. Mantener archivo y resultado en memoria, limpiar datos de intentos anteriores y liberar URL locales. No añadir logs, analytics, URL compartible, descarga, sessionStorage, localStorage, historial ni persistencia. La UI de /analisis carece de AccesoRol propio, aunque la API autoriza; DI-42 deberá probar la experiencia sin sesión antes de declarar acceso privado verificado. No tocar RLS ni backend.

## 8. Matriz de trazabilidad

| Criterio | Decisión de DI-134 | Verificación posterior |
|---|---|---|
| DI-134: solo hallazgos evaluados | Filtrar por evaluable; separar no evaluable y oral no disponible. | Tests de estados y respuesta inválida. |
| DI-134: límites e incertidumbre | Advertencias junto a cada observación. | Revisión editorial y de accesibilidad. |
| DI-134: privacidad explícita | Solo memoria; envío temporal no es almacenamiento. | Verificar ausencia de escritura y datos en logs/artefactos. |
| DI-134: evidencia técnica | Referencias a rutas, tipos y Jira. | PR de DI-42 con resultados reales diferenciados de mocks. |
| DI-42.1: evaluado frente a predefinido | Etiquetas de procedencia. | Tests con respuesta ficticia y contenido educativo. |
| DI-42.2: lenguaje comprensible | Estructura y mensajes de la sección 6. | Evaluación UX posterior, no atribuida aquí. |
| DI-42.3: no inventar hallazgos | Omitir cifras si falta oral o foto no evaluable. | Matriz de estados y errores. |
| DI-42.4: directorio y consulta | CTA a /panel/odontologos. | Navegación y acceso autenticado/sin sesión. |
| DI-42 DoD: integración y pruebas | Plan de sección 10. | Build, tests, móvil, teclado y PR de implementación. |

## 9. Pruebas previstas y riesgos de integración

Casos para DI-42: evaluable, parcialmente evaluable, no evaluable; oral ausente, unavailable y evaluated sin detecciones; explicación openai/template/mock/pendiente/inválida; 401/403/429/503/504 y JSON inválido; nueva foto y reintento sin datos previos; navegación al directorio; teclado, foco, lector de pantalla, 390 px y zoom; ausencia de PDF, escritura, historial y URL compartible. Los mocks acreditan presentación y contrato, no integración real.

| Riesgo/decisión | Tratamiento |
|---|---|
| Smile deshabilitado o servicios no disponibles | Estado seguro, sin recomendar activar producción. |
| Explicación opcional añade hechos no sustentados | Validar fuente, plantilla existente y revisión editorial. |
| Layout paciente sin AccesoRol específico en /analisis | Revisar/probar UI y API sin sesión en DI-42; no cambiar controles ahora. |
| Fase detalle sin CTA observado | Decidir si se enlaza o queda fuera del primer reporte. |
| PDF, foto exportada, retención, historial o compartición | Fuera del alcance. Requieren decisión formal de privacidad/producto y revisión propia. |
| Asistente | Emisor y receptor existen; no se cambia payload ni se afirma integración verificada. |

## 10. Plan técnico separado para DI-42

1. Acordar texto, presentación de cobertura/fecha y revisión de acceso de /analisis. Mantener PDF e historial fuera salvo decisión expresa.
2. Si hace falta, crear una función pura de proyección desde los tipos existentes; conservar API, validadores y consentimiento temporal.
3. Extender ResultadosVisuales y solo las transiciones mínimas de AnalisisDental. Etiquetar procedencia, manejar estados y limpiar datos de intentos anteriores.
4. Probar reglas puras con datos ficticios; después interacción, errores, accesibilidad y navegación. Distinguir pruebas estáticas, con mocks y con integración real. Ejecutar typecheck, build, pruebas pertinentes y Quality Gates.
5. Revisar diff de privacidad/autorización, documentar límites y abrir PR de implementación independiente.

**Criterio de salida de DI-42:** vista basada solo en respuesta validada, estados parciales/ausentes seguros, directorio accesible y evidencia de pruebas. Este documento no declara DI-134 ni DI-42 completadas en Jira.
