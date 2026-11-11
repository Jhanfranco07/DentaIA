# Integración Sprint 5 — 4 de noviembre de 2026

**Revisión técnica previa: preparada para publicar la rama y crear un PR Draft, con el alcance y los pendientes indicados abajo. Al cierre de esa revisión todavía no se había publicado, creado PR ni hecho commit. No se declara preparada para producción clínica.**

Worktree exclusivo: `DentaIA-integration-sprint5-demo`. Rama `integration/sprint5-demo`, HEAD `67a85d3873c59234261883ef6f414525741c82a9`. Se conservaron los merges existentes `57eb402` y `67a85d3`; no se repitieron. Los PR originales #19 y #20 permanecen abiertos en GitHub y sus ramas no se modificaron.

## Estado recibido y alcance

Había cambios sin commit en `Encabezado.tsx`, `Pie.tsx`, `Cuenta.tsx` y `PanelPaciente.tsx`, más el adaptador `clinica.ts`, su prueba, `ClinicaPanel.tsx`, el arnés `qa-sprint5-integracion.mjs` y las evidencias de integración sin seguimiento. Estos cambios incorporan enlaces al panel, protección por sesión y lecturas clínicas propias sin sustituir errores por datos simulados.

En esta continuación se añadieron el arnés Chromium `scripts/qa-sprint5-browser.py`, sus evidencias y este informe. No fue necesario cambiar código de la aplicación. Al inicio no había un proceso Next de este worktree que pudiera reutilizarse. Build, servidor productivo y servidor de desarrollo se ejecutaron secuencialmente; los procesos propios terminaron al cerrar cada arnés.

## Resultados

| Comprobación | Resultado y evidencia |
| --- | --- |
| TypeScript | Aprobado, `npm run typecheck`, salida 0; `validacion/TYPECHECK.log`. |
| Pruebas aisladas | 319/319, sin fallos, omitidas ni canceladas; `validacion/NODE.tap`. Se ejecutó la suite combinada porque las evidencias de ramas originales no cubrían el árbol integrado sin commit. |
| Build | Aprobado, `npm run build`, salida 0; `validacion/BUILD.log`. No hubo cambios de aplicación después del build. |
| Dependencias | `npm audit --json`, salida 0, cero vulnerabilidades; `validacion/AUDIT.json`. Sin instalación ni actualización de paquetes. |
| Producción local | 7/7 cierres HTTP 404 con bandera clínica forzada a true: seis rutas GET clínicas/profesionales y `/desarrollo/panel-admin`; `validacion/PRODUCCION.json`. No representa una nueva prueba HTTP de los dos métodos POST. Las guardas de ambiente y la API desactivada también están cubiertas por la suite aislada. |
| Chromium integrado | 21 escenarios únicos aprobados: 20 del recorrido completo y 1 repetición focalizada con selector corregido; `validacion/CHROMIUM_FIXTURES.json` y `validacion/CHROMIUM_RECHECK_PANEL.json`. Chrome 155.0.8059.40 basado en Chromium, navegador real con Auth/HTTP interceptados y red externa bloqueada. |
| API remota previa | Se reutilizan las primeras 20 comprobaciones aprobadas de `validacion/FUNCIONAL_REMOTO.json`, de 2026-11-04T21:43:36.814Z: cuatro logins, lecturas propias, aislamiento entre pacientes, AAL1/AAL2, alcance profesional y seis rutas HTTP. Son evidencia previa, no ejecución nueva ni prueba del estado remoto actual. |
| Seguridad de datos previa | Revisado `../arquitectura/integracion_fase8/SEGURIDAD_ACADEMICA_REAL.json`: 19 tablas con RLS, cinco actores originales cerrados y ausencia de SELECT clínico directo. Evidencia histórica de 2026-11-04T01:13:40.203Z, sin volver a consultar o modificar Supabase remoto. |
| Diff | `git diff --check` aprobado. |

Chromium cubrió: panel anónimo sin datos; login desde la interfaz y perfil propio; enlace cuenta → panel con resumen, solicitudes y clínica; separación del reporte demo; anchos 375/1024/1280; menú móvil, Escape y acceso por teclado a cuenta; rutas `/`, `/directorio`, `/solicitudes`, `/fotografias`, `/analisis/demo`, `/privacidad`; consentimiento visible sin carga/eliminación; denegación administrativa; cierre clínico con 401/403/404/503; reintento; logout; sesión inválida; ausencia de errores JavaScript y escrituras de negocio.

## Intentos y correcciones del arnés

Los seis fallos Chromium del arnés remoto anterior se preservan; no se borraron ni se contaron como aprobados. El nuevo arnés comprueba los recorridos pendientes con respuestas controladas.

El primer intento nuevo con Chromium headless shell 149 agotó la navegación a `/panel`, aunque Next respondió 200. Luego terminó por codificación `charmap` al imprimir una flecha. Se conservan su informe en `INTENTOS_CHROMIUM_FIXTURES.json`, el log `CHROMIUM_NEXT_INTENTO1.log` y `BLOQUEO_CHROMIUM_INICIAL.json`. No se atribuye ese timeout a un defecto confirmado de la aplicación.

Se corrigió stdout a UTF-8 y se usó Chrome instalado basado en Chromium, sin proxy. En ese recorrido pasaron 20 escenarios y uno detectó un selector ambiguo: existen dos encabezados “Mis solicitudes”. Se acotó al contenedor `#mis-solicitudes` y se repitió solamente ese escenario con `--recheck-panel`: aprobado, incluyendo el enlace cuenta → panel y las lecturas visibles. El historial conserva ambos fallos y su resolución. No se repitieron las 20 comprobaciones correctas.

## GitHub Actions

Consultas de solo lectura mediante el conector GitHub; detalle guardado en `validacion/GITHUB_ACTIONS.json`.

| Head consultado | CI | Tests | Security |
| --- | --- | --- | --- |
| PR #19, `3125b9f` | [success](https://github.com/Jhanfranco07/DentaIA/actions/runs/41841348566) | [success](https://github.com/Jhanfranco07/DentaIA/actions/runs/41841348545) | [success](https://github.com/Jhanfranco07/DentaIA/actions/runs/41841348790) |
| PR #20, `2f1527d` | [success](https://github.com/Jhanfranco07/DentaIA/actions/runs/41776533149) | [success](https://github.com/Jhanfranco07/DentaIA/actions/runs/41776532511) | [success](https://github.com/Jhanfranco07/DentaIA/actions/runs/41776532525) |

El conector no devolvió runs de evento `pull_request` para `67a85d3`. Esa consulta no enumera todos los eventos posibles. Los resultados de los PR originales no acreditan los cambios integrados sin commit. Los workflows locales de CI/Tests se activan en PR a `main` y pushes a `main`/`feature/**`; Security en PR a `main` y push a `main`. Publicar solamente `integration/sprint5-demo` no garantiza ejecutar estos workflows: deben revisarse al crear el Draft.

## Pendientes al cierre de la revisión técnica previa

No quedan fallos funcionales locales sin resolver en el alcance ejecutado. Es razonable publicar esta rama y crear el PR Draft para revisión, conservando estas limitaciones:

1. Crear el commit de integración con los cambios revisados. Sigue sin commit por decisión de esta continuación; no se ha ejecutado push.
2. Después de publicar y abrir el Draft, comprobar CI, Tests y Security sobre el SHA final de integración. Todavía no pueden darse por aprobados.
3. No se completó el recorrido Chromium contra Auth/Supabase reales. Se completó con fixtures y se reutilizó la evidencia remota previa de API. Una validación remota actualizada, especialmente expiración temporal de concesiones y de sesiones, requiere otra ejecución autorizada que no se hizo bajo la restricción de no modificar Supabase remoto. No se renovaron concesiones, iniciaron sesiones remotas ni cambiaron datos para conseguir resultados positivos.

Estos pendientes impiden afirmar validación end-to-end remota actual o preparación para producción; no impiden abrir un Draft con este alcance explícito. No se modificaron `main`, ramas originales, Jira, Vercel, Supabase remoto ni los dos documentos de la carpeta principal. No se eliminaron worktrees.

## Revisión para publicación autorizada

El usuario autorizó publicar exclusivamente `integration/sprint5-demo` y crear un PR Draft hacia `main`, sin fusionarlo ni modificar los PR originales #19 y #20. El estado y los enlaces de Actions del SHA publicado se registrarán en la descripción del nuevo PR para evitar un commit adicional que cambie ese SHA después de comprobarlo.

- Rama y merges comprobados: `67a85d3` conserva `57eb402` y los heads originales `3125b9f` de Jhan y `2f1527d` de Angie como ancestros. No se repiten merges, cherry-picks ni se alteran autorías o fechas originales.
- Los 27 archivos pendientes revisados corresponden a navegación, sesión, lectura clínica del panel, pruebas y documentación de integración. No se incorporan ramas ni módulos adicionales de Anelis o Stephan.
- Todas las huellas de `validacion/SNAPSHOT.json` coinciden con los archivos revisados. Se reutilizan los resultados locales válidos sin repetir procesos.
- Escaneo del cambio completo: 479 archivos, sin patrones de claves privadas, tokens GitHub, secretos Supabase, claves AWS, contraseñas en conexiones PostgreSQL ni JWT literales. Sin `.env`, volcados, credenciales cifradas, cachés o archivos temporales en el conjunto a publicar. Los `.log` y `.tap` de `docs/integracion/validacion` son evidencias intencionales, revisadas; no son archivos temporales accidentales.
- Chromium con Auth/Supabase reales continúa pendiente. Para completar la integración del equipo también faltan la revisión e incorporación separadas de Anelis y Stephan y la posterior validación del recorrido completo del equipo. Esta publicación es parcial y no habilita servicios clínicos en producción.

Las evidencias `AUDIT.json`, `BUILD.log`, `NODE.tap` y `TYPECHECK.log` se convirtieron de UTF-16 a UTF-8 para su lectura en GitHub; se quitaron espacios finales y l?neas vac?as finales de los dos logs de build/tipos. Se conservan los resultados y no se repitieron las pruebas.
