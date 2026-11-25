# Integración local de DI-213 y DI-214

**25 de noviembre de 2026, Lima.** Rama `integration/di-213-di-214` en `C:\Users\USER\DentaIA-integracion-DI213-DI214`. La revisión manual conjunta y el pipeline remoto quedan pendientes.

| Referencia verificada en GitHub | SHA |
| --- | --- |
| `origin/main` después de `git fetch origin` | `5cf65e5c306c42567ef0ffe2aecc19bf832e99d4` |
| [PR #118](https://github.com/Jhanfranco07/DentaIA/pull/118) abierto a `main` | `5cbfe3368d2995010db211f428eb77a390645709` |
| [PR #120](https://github.com/Jhanfranco07/DentaIA/pull/120) abierto a `main` | `a51a53e3a63300b0f5f68876955c4d0b619e78ec` |
| Merge local de DI-213 | `675da52` |
| Merge local de DI-214 y versión de aplicación validada | `442143a39970aa5ced13234ed4c1f979a94c9756` |

El commit posterior de QA incorpora esta evidencia y los scripts de reproducción. `git rev-parse HEAD` devuelve el SHA completo de la rama. Los PR #116, #117 y #119 ya estaban integrados en la base verificada.

## Reconciliación

| Archivo compartido identificado por Git | Resultado |
| --- | --- |
| `src/features/clinica-http/http.ts` | Se unieron imports y nombres RPC. Se conservaron validaciones, DTO, control de sesión y cabeceras privadas. |
| `src/features/clinica-http/servidor.ts` | Se conservaron tres exportaciones, ambos RPC con JWT de usuario y los dos flujos de descarga con sus controles. |
| `src/features/profesional/ProfesionalClinico.tsx` | Git combinó el portal. El recorrido real confirmó ambos paneles en una misma sesión profesional. |

El workflow DevSecOps pertenece al diff de DI-213. DI-214 aporta los tipos del RPC Premium. Se conservaron íntegras las migraciones y las políticas de Storage de ambos PR.

## Infraestructura y pruebas reales

El stack `dentaia_di213_di214_qa` tiene una red Docker dedicada, PostgreSQL 17.12, Auth, PostgREST y Storage. Next usa `http://127.0.0.1:57521` para Supabase y responde en `http://localhost:57530`. Docker Desktop publica los puertos QA 57521 y 57522 en todas las interfaces del host pese a la opción aplicada a la red. Next escucha en loopback. Las cuentas, evaluaciones y fotografías son sintéticas.

Se aplicaron las migraciones históricas y el modelo, RPC y workspace DI-36 de Fase 8. El arnés omitió las guardas de destino de Fase 8 en la copia de ejecución local y configuró únicamente actores sintéticos para habilitar el recorrido. Después se aplicaron `20261125061658_di213_odontograma.sql` y `20261125102804_di214_premium_evaluation_history.sql`, en ese orden. Los scripts de migración versionados de ambos incrementos se mantuvieron intactos.

- **Odontograma.** Chromium móvil mostró 32 piezas FDI. La selección de pieza 16 por teclado, superficie oclusal, nota, corrección con versión histórica y asociación manual de Smile usaron el BFF real. PostgreSQL registró tres eventos clínicos, una corrección y una asociación en la primera ejecución. Una escritura fuera del encuentro y consultas de pacientes o profesionales fuera de alcance fueron denegadas. La revisión odontológica de estados, superficies y símbolos continúa pendiente.
- **Historial Premium.** Las sesiones Free y Premium devolvieron su estado efectivo. Siete evaluaciones vigentes conservaron fecha, proveedor, modelo y los seis estados del contrato. Chromium comparó resultados compatibles y Node verificó el rechazo de los incompatibles. El paciente gestionó consentimiento y alcance por evaluación. Las evaluaciones se sembraron mediante SQL y el resultado Smile es una fixture del contrato. Auth, PostgREST, las lecturas, permisos, descargas y auditoría operaron sobre los servicios reales.
- **Cruce.** Compartir una evaluación sin su foto concedió lectura del resultado y mantuvo la foto denegada. Retirar la evaluación bloqueó su descarga y preservó el odontograma y la fotografía Smile autorizada. Revocar la concesión clínica bloqueó ambas vistas y las descargas dependientes. Se restableció una concesión de QA para la validación manual. Ambos módulos conservaron los datos tras recargar y después de reiniciar Next.
- **Storage y revocación.** `dental-photos` y `smile-analysis-private` son privados. Sus políticas se limitan a `object.get_authenticated` y aplican predicados distintos. Se confirmaron bytes de descargas autenticadas, ausencia de URL firmada para el profesional, denegación tras revocación, expiración de una concesión de prueba y denegación al reemplazar el objeto con la misma ruta. Un digest alterado devolvió 404 con `private, no-store`; los bytes originales volvieron a habilitar la descarga al restaurar el digest. Cuatro solicitudes concurrentes de compartir conservaron un alcance.
- **RLS y roles.** Las cuatro tablas de ambos incrementos tienen RLS y carecen de ACL directa para `authenticated`. Los esquemas privados fueron rechazados con 406 por PostgREST. El catálogo confirmó `storage.allow_only_operation(text)` y su permiso `EXECUTE`, los wrappers públicos `SECURITY INVOKER`, las funciones internas `SECURITY DEFINER` y sus permisos. El ejecutor tiene `NOLOGIN`, carece de privilegios elevados y los cuatro roles API carecen de `MEMBER` y `SET`. Las membresías directas observadas corresponden a `postgres`.
- **Ingestión.** El RPC rechazó la escritura Premium con prueba inválida mientras Vault carecía de la clave. Se mantuvieron deshabilitados RF-DETR e ingestión HMAC. La prueba combinada cubrió concurrencia de concesiones, y la prueba anterior de DI-214 conserva la evidencia independiente de concurrencia e idempotencia de ingestión. La verificación combinada de ingestión queda diferida a la autorización de activación.

La ruta Premium respondió 401 sin sesión. Su evento de seguridad local contiene únicamente código, operación, ID de solicitud y estado. Las rutas Premium mantienen el contexto clínico fuera de la URL. Next dev sí registra la ruta parametrizada del odontograma con identificadores sintéticos. Queda pendiente verificar la política de logs del eventual entorno de liberación.

## Calidad y seguridad

| Control local | Resultado |
| --- | --- |
| TypeScript y build Next.js | Aprobados. El build informa advertencias preexistentes de Autoprefixer fuera del código integrado. |
| Node y Vitest | 588 casos Node entre las cuatro suites del pipeline y 120 Vitest. Cero fallos. Son conteos de ejecución por suite. |
| Playwright público aislado | 24/24 aprobados. Incluye MediaPipe y alternancia de cámaras con los dispositivos y dobles del arnés, y el odontograma con BFF sintético. |
| Chromium y servicios reales | Recorrido cruzado, recarga y reinicio aprobados. |
| Regresión Smile | Contratos y regresión Node, lectura real de un resultado sintético y descarga autorizada. |
| Semgrep 1.185.0 | 0 hallazgos en el código definido por las reglas. |
| Bandit 1.9.4 `-ll` | 0 hallazgos medios o altos. La métrica informa 1 de severidad baja fuera de ese umbral. |
| `npm audit` y `pip-audit` | Sin vulnerabilidades conocidas en las dependencias auditadas. |
| Gitleaks 8.30.1, actionlint 1.7.12, validador YAML y `git diff --check` | Aprobados localmente. |

Un build simultáneo con Playwright compartía `.next` y alteró sus manifiestos. Al ejecutar cada comprobación con su propio directorio de compilación, el build y la regresión pública pasaron. El resultado Smile sintético inicial se completó con el esquema y el identificador de modelo exigidos por su contrato. Los archivos de la app y sus controles permanecieron como en el merge reconciliado.

## Reproducción y revisión manual

Usar un stack nuevo con `project_id = "dentaia_di213_di214_qa"`, API 57521, DB 57522 y la carga automática de migraciones y semillas deshabilitada en la copia local de `supabase/config.toml`. Iniciar con el CLI fijado, con Auth, PostgREST y Storage disponibles. No vincular el stack a un proyecto hospedado.

En el worktree, usar `DI214_DB_CONTAINER=supabase_db_dentaia_di213_di214_qa` para `node scripts/qa-di214-migrations.mjs`. Configurar `DI214_LOCAL_PUBLIC_KEY` y `DI214_LOCAL_SERVICE_KEY` con las claves del stack y un `DI214_RUN` nuevo. Con `DI214_WRITE_APP_ENV=1`, `node scripts/qa-di214-supabase.mjs --combined` genera `.env.local` si está ausente. La salida de la fixture queda en `node_modules/.qa-di213-di214/fixture.json`. Iniciar Next en modo dev en loopback, puerto 57530, y ejecutar lo siguiente.

```powershell
node --env-file=.env.local scripts/qa-di213-di214-browser.mjs
# Tras reiniciar Next
node --env-file=.env.local scripts/qa-di213-di214-browser.mjs node_modules/.qa-di213-di214/fixture.json --after-restart
```

Para la validación manual, iniciar sesión desde `/desarrollo/acceso` con la cuenta odontólogo, abrir `/profesional` y elegir el paciente autorizado. Revisar el odontograma y consultar las evaluaciones compartidas. Con la cuenta paciente, abrir `/resultados`, consultar dos evaluaciones compatibles y retirar el alcance de una evaluación para observar el efecto en la siguiente consulta profesional.

## Sprint 7 y entrega

| Jira | Estado | Evidencia o pendiente |
| --- | --- | --- |
| DI-212, DI-244 | Listo | Regresión de captura y cámaras aprobada. |
| DI-213, DI-214 | En curso | Integración local verificada. Revisión manual conjunta, pipeline y liberación secuencial pendientes. |
| DI-245 | En curso | SVG verificado. Revisión de símbolos pendiente. |
| DI-246 | En curso | 32 FDI comprobadas. Revisión de superficies pendiente. |
| DI-247 | Listo | Selección de pieza y superficie, teclado y guardado verificados. |
| DI-248 | En curso | Estados, nota y revisión verificados. Revisión odontológica pendiente. |
| DI-249 | En curso | Procedencia Smile y revisión manual verificadas. Preview protegido pendiente. |
| DI-250 | En curso | Acceso clínico, aislamiento, revocación y auditoría verificados. Preview protegido pendiente. |
| DI-251 | En curso | Lectura y persistencia verificadas con datos sembrados. Escritura HMAC diferida. |
| DI-252 | En curso | Consentimientos, foto privada, identidad de objeto y digest comprobados. Preview protegido pendiente. |
| DI-253 | Listo | Fecha, proveedor, modelo y seis estados verificados. |
| DI-254 | En curso | ACL, RLS y esquemas verificados con PostgreSQL y PostgREST locales. Preview protegido pendiente. |
| DI-255 | Listo | Historial y persistencia longitudinal verificados. |
| DI-256 | Listo | Comparaciones compatibles y rechazo de incompatibles verificados. |
| DI-257 | En curso | Acceso autorizado con JWT real verificado. Preview protegido pendiente. |
| DI-258 | En curso | Revocación de alcances y descargas verificada. Preview protegido pendiente. |
| DI-259 | En curso | Pendiente la interfaz privada PDF de DI-42 y la prueba de permisos. |

El [workflow DevSecOps integral](https://github.com/Jhanfranco07/DentaIA/actions/workflows/devsecops.yml) soporta `workflow_dispatch`. Los pasos de entrega leen estados de Vercel/Railway y consultan el Preview. La ejecución combinada queda pendiente de publicación y validación manual. El job `entrega-publicacion` exige un estado Vercel `success` para el SHA exacto. Si la integración de Vercel no publica Preview para esa rama, la solución mínima es confirmar el alcance de Preview y acordar con Jhan la forma de validar esa versión sin cambiar los controles. Un Preview protegido sin URL accesible deja el smoke funcional pendiente. Los [resultados del PR #118](https://github.com/Jhanfranco07/DentaIA/actions/runs/45562702784) y del [PR #120](https://github.com/Jhanfranco07/DentaIA/actions/runs/45604796891) corresponden a sus SHA individuales.

Tras la aprobación manual, actualizar `origin/main`, revisar el diff y la ausencia de secretos y publicar la rama de integración. Ejecutar el workflow contra el SHA publicado y entregar a Jhan el estado por job. Jhan coordina las migraciones remotas y el merge de #118. Después se actualiza la rama original de #120, se reutiliza la reconciliación y se repiten los gates antes del merge de #120. RF-DETR e HMAC requieren su coordinación posterior.
