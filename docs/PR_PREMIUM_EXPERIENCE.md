# feat: DentaIA Premium Experience — análisis, reportes y orientación odontológica

El recorrido educativo ahora guía al paciente desde una referencia verificada por contenido hasta recomendaciones, reporte A4 y una decisión opcional de explorar odontólogos o finalizar conservando su reporte. Se rediseñan inicio, navegación, animaciones y estados responsive; el directorio existente añade filtros por especialidad y mantiene el profesional elegido al iniciar sesión para solicitar atención.

**Pendiente de aceptación:** faltan las tres fotografías clínicas con licencia y procedencia verificables. Las fuentes permitidas no acreditaron permisos suficientes y Wikimedia está bloqueada por la política de red. Las muestras son tarjetas editoriales con un aviso explícito; se retiraron las ilustraciones anteriores y no se inventan regiones anatómicas. Los tres PDF están generados y revisados visualmente, pero contienen esas referencias editoriales. Este PR debe revisarse con ese límite y no fusionarse como si el requisito fotográfico estuviera completado.

Validación: instalación congelada, TypeScript, build de producción, 87/87 pruebas, auditoría sin vulnerabilidades y diff sin errores. Chromium contra producción local: 15/15 escenarios en 1440/768/390 px, teclado, movimiento reducido/normal, ampliación, tres descargas PDF idénticas a la vista previa, omitir y retorno al reporte. Incluye regresión de sesión, perfil, solicitudes e historial, consentimiento, almacenamiento privado y borrado parcial mediante proveedor simulado; no valida RLS ni persistencia remota reales.

[Documentación y capturas](PREMIUM_EXPERIENCE.md) · [Fuentes pendientes](FOTOGRAFIAS_DEMO.md) · [Resultados de navegador](evidencias/premium/resultado-recorrido.json) · [Tres PDF y renders](../output/pdf/premium/).

No cambia el esquema ni las políticas, no se modifica producción y no hay inferencia clínica. Autor de los commits: Jhan Franco. La conexión de Anelis solo debe utilizarse para publicar después de verificar su cuenta y permisos de escritura. No fusionar automáticamente.
