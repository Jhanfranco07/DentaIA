# DI-153 — Pruebas de permisos y funcionamiento

- Sprint 5, historia DI-144. Ejecución real: **04/11/2026 UTC**, Codex Cloud/Linux.
- Rama solicitada: `docs/auditoria-arquitectura-integral`.
- Base: **`e9fd2f3f05807ab2f10cab335f57bc817f30c51f`**, DI-152 publicada. El árbol estaba limpio al cambiar desde la rama anterior; HEAD local/remoto coincidían.
- Jira consultado antes de editar: [DI-153](https://jhanfranco.atlassian.net/browse/DI-153), descripción y criterios de aceptación. Estado consultado: **Por hacer**. DI-148 a DI-152 figuran Listo; sus estados no sustituyen la evidencia específica de DI-153.
- **Resultado: verificación local ampliada aprobada; aceptación integral pendiente. No corresponde pasar DI-153 a Listo.** Persisten criterios de integración y funcionamiento real incompatibles con habilitar escrituras en este encargo.

## 1. Alcance revisado y pruebas no duplicadas

Se revisaron la matriz DI-148; componentes y estados DI-149; identidad/roles/MFA y contrato de servidor DI-150; listado, cambios controlados, aprobaciones, revisión e idempotencia DI-151; y panel/adaptador/evidencias de DI-152. Se conserva el código de aplicación, los módulos clínicos, las interfaces del equipo, las migraciones y los archivos SQL existentes.

La línea base ejecutada antes de añadir pruebas fue **156/156** casos administrativos/de autorización, sin red. La revisión identificó esta cobertura ya existente:

| Cobertura existente | Archivos principales | Decisión |
| --- | --- | --- |
| Sesión ausente/inválida, rol del servidor, metadatos editables, AAL1/AAL2, firma/caducidad, retirada de rol/factor | `src/features/autorizacion/*.test.mjs`, `mfa-local.test.mjs` | Reutilizar; no reescribir la matriz. |
| Búsqueda, filtros globales, paginación, estados de perfiles/asignaciones y proyección sin información privada | `servicios.test.mjs`, `usuarios-reales.test.mjs`, `cliente*.test.mjs`, `api.test.mjs` | Reutilizar; no crear una segunda suite de filtros. |
| Entrada de cambios, autoelevación, aprobación, último administrador, revisión, errores e idempotencia | `cambios-roles.test.mjs`, `supabase/tests/di151-roles.sql` y prueba de concurrencia existente | Reutilizar las especificaciones y SQL, sin editar migraciones ni habilitar escrituras remotas. |
| Panel → API simulada, consulta, error/reintento, cambio simulado, actualización y pérdida de acceso | `scripts/qa-di152-panel.py`, 13 casos existentes | Ejecutar el arnés existente; añadir solo escenarios ausentes. |
| Adaptadores server-only, credenciales separadas y transporte acotado | `lecturas-supabase.test.mjs`, `escrituras-roles-supabase.test.mjs` | Reutilizar; completar el hueco del ensamblado final de servidor. |

No se vuelven a ejecutar scripts de provisión, enrolamiento, activación académica, escritura remota o creación de usuarios. No se solicita ni publica información privada del entorno.

## 2. Pruebas faltantes implementadas

### Ensamblado de servidor — 3 casos nuevos

`src/features/administracion/bloqueos-di153.test.mjs` carga el ensamblado **real de código** `servidor-cambios-roles.ts`, con resolución TS/alias y `server-only` en un proceso aislado. Supabase Auth/fetch es un doble explícito y no existe conexión remota:

1. Origen ajeno: 403 `ORIGEN_NO_ADMITIDO` antes de consumir el cuerpo. Origen concordante y escritura apagada: 503 `ESCRITURAS_DESACTIVADAS`.
2. Valores no exactos de activación (`false`, `TRUE`, `1`, vacío): 503, aun con una credencial sintética no utilizable en el fixture.
3. GET de revisión: no sortea el bloqueo del ensamblado de escritura ni expone contexto/credenciales.

Se comprueba que **no se llama al RPC ni a otro transporte distinto del Auth simulado**, sin desactivar guards ni probar un alta real. Las pruebas del puerto o del adaptador por separado no acreditaban este cableado final; no se duplican sus casos generales.

### Navegador — 7 casos nuevos sobre los 13 anteriores

Se hace portable a Linux el arnés existente `scripts/qa-di152-panel.py`: proceso Next propio, salida explícita, ejecutable Chromium configurable y limpieza limitada a su grupo de procesos. Ya no escribe automáticamente sobre evidencias históricas de DI-152. Playwright y Chromium se utilizan como herramientas instaladas del entorno; no se añaden dependencias al proyecto.

`--di153` añade:

- Carga retenida: no aparece tabla antes de resolver la lectura.
- Respuesta antigua de búsqueda: no repone perfiles después de un resultado vacío más reciente.
- Evento `SIGNED_OUT` ficticio: retira cuentas y navegación. **No es un logout remoto.**
- Autorización 200 tardía: no monta el panel tras perder la sesión ficticia.
- Formulario con UUID inválido/sin consentimiento: no envía POST; alta de odontólogo no disponible.
- Respuesta 200 de otra clave: no anuncia éxito, conserva intención y reintenta exactamente la misma clave/cuerpo.
- 403 de autorización en un POST: retira el panel sin respuesta privada.

El arnés intercepta las API y bloquea HTTPS externa. Usa sesión y datos generados en memoria; los escenarios de cambio y lectura posterior del panel son **simulados**, aunque el navegador y React sean reales. Los guards de servidor se prueban separadamente en Node; interceptar un 403 en navegador no acredita autorización de Supabase.

### PostgreSQL local — ejecutar la batería existente

Se incorpora `scripts/qa-di153-postgres.py` como ejecutor Linux de las mismas pruebas SQL y concurrencia que ya se ejecutaban desde PowerShell. No introduce otra implementación de las reglas ni modifica SQL.

El ejecutor requiere `--confirmar-base-desechable`, no admite URL/credenciales/SQL externos y fija Docker al socket **local**. Crea PostgreSQL 17 en un contenedor propio, sin red, puertos o carpetas del host; almacenamiento temporal y etiqueta aleatoria verificada antes de eliminarlo. Se fuerza `plpgsql.check_asserts=on`. Reutiliza exactamente:

- `supabase/tests/fixtures-auth-local.sql`;
- `supabase/migrations/20261103012414_di151_roles_auditoria_atomica.sql` (solo lectura y aplicación dentro de la base desechable);
- `supabase/tests/di151-roles.sql`;
- `supabase/tests/di151-concurrencia-preparar.sql`.

Las cuatro comprobaciones reportadas son: batería SQL existente completa; un commit y un conflicto de revisión entre conexiones; idempotencia concurrente con una sola auditoría; y retirada concurrente con conservación del invariante de administradores. La batería SQL existente incluye cambio/lectura posterior, permisos, último administrador y rollback/auditoría. Los hashes antes/después de los archivos SQL coinciden.

**Es PostgreSQL real local con esquema Auth de fixture, no Supabase Auth ni la base compartida.** El contenedor se retiró y no se habilitó la escritura administrativa de la aplicación. Esto no acredita equivalencia del esquema/configuración remotos ni el flujo panel → Supabase completo.

## 3. Comandos y resultados verificables

Para reproducir, usar Node **22.23.4** en PATH, Docker local con imagen `postgres:17` disponible, Python/Playwright **1.62.0** y Chromium **154.0.8037.57** instalado. No se descarga ni instala nada desde los arneses Python. El Docker local necesita la imagen previamente descargada por el canal de red permitido. El informe fija su digest, no solo la etiqueta mutable.

```bash
# Suite aislada: sin red ni credenciales, misma convención que Jira/CI.
node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"

# Evitar concurrencia: next build regenera .next/types.
npm run build
npm run typecheck

python3 scripts/qa-di152-panel.py --di153 --chromium /usr/bin/chromium --output /tmp/di153-browser
python3 scripts/qa-di153-postgres.py --confirmar-base-desechable --output /tmp/di153-postgres.json

git diff --check
```

| Ejecución | Resultado real | Evidencia |
| --- | --- | --- |
| Línea base administrativa/autorización, Node 24.19.0 | 156 aprobadas, 0 fallidas, 0 omitidas | [BASE_ADMIN_NODE24.tap](evidencias/DI-153/BASE_ADMIN_NODE24.tap) |
| Suite aislada completa, Node 22.23.4 | **301 aprobadas, 0 fallidas, 0 omitidas**; incluye las 3 nuevas | [NODE22.tap](evidencias/DI-153/NODE22.tap) |
| Build Next.js 15.5.28, Node 22.23.4 | Exit 0 | [BUILD_NODE22.log](evidencias/DI-153/BUILD_NODE22.log) |
| TypeScript después del build | Exit 0 | [TYPECHECK.log](evidencias/DI-153/TYPECHECK.log) |
| Navegador con HTTP/Auth ficticios | **20 aprobadas, 0 fallidas**, incluidos 13 casos previos y 7 nuevos | [NAVEGADOR_FIXTURES.json](evidencias/DI-153/NAVEGADOR_FIXTURES.json) |
| PostgreSQL 17.11 desechable | **4 comprobaciones aprobadas, 0 fallidas**; aserciones SQL habilitadas y contenedor retirado | [POSTGRES_LOCAL.json](evidencias/DI-153/POSTGRES_LOCAL.json) |
| Diff | Sin errores | `git diff --check` antes del commit |
| Configuración local | Lecturas/escrituras apagadas, sin credenciales administrativas dedicadas | [PREFLIGHT.json](evidencias/DI-153/PREFLIGHT.json) |

No sumar estas baterías como si todas fueran unitarias del mismo tipo. El build incluye rutas clínicas existentes; **no se modificó su código**, sus interfaces o migraciones. La suite completa ejecutó sus pruebas aisladas existentes por regresión.

Los logs de build y TypeScript solo normalizan retornos de carro, espacios y líneas vacías finales para poder versionarlos sin errores de whitespace; se conserva su contenido de resultados.

Se conservan intentos no exitosos:

- Primer intento de navegador: **18 aprobadas y 2 fallidas del arnés**. Las esperas asumían una única solicitud y no esperaban el montaje previo a los eventos. Se corrigió la sincronización, liberando todas las respuestas retenidas de Strict Mode (dos en carga), sin modificar el producto ni relajar las aserciones de privacidad. Segundo intento: 20/20. [Historial](evidencias/DI-153/INTENTOS_NAVEGADOR.json).
- Primer TypeScript: exit 2, TS6053 por tipos generados mientras `next build` regeneraba `.next`. Se repitió **secuencialmente** tras el build y aprobó. No se presenta el intento anterior como éxito ni como defecto del producto. [Primer intento](evidencias/DI-153/TYPECHECK_PRIMER_INTENTO.log).

El [manifiesto](evidencias/DI-153/MANIFIESTO.json) contiene base, comandos, versiones, resultados, hashes del código QA y separación explícita de lo remoto. El commit de esta entrega se enlaza a Jira después de publicarlo; no se inserta un hash autorreferencial en este documento.

## 4. Cobertura contra los criterios de Jira

| Criterio DI-153 | Evidencia disponible | Estado de aceptación |
| --- | --- | --- |
| 1. Unitarias: roles, entradas, asignación, autoelevación, último administrador; componentes y estados | Suite previa reutilizada + 3 casos de ensamblado; SQL local existente; arnés de 20 casos UI | Cubierto localmente en las capas indicadas; no certifica infraestructura productiva. |
| 2. Panel → servicio/API → persistencia, lectura posterior y consistencia tras rechazo | Cliente/API/guard con dobles; panel con HTTP ficticio; persistencia y rollback SQL reales **por separado** en contenedor | **Parcial. Falta integración completa con Supabase dedicado**, incluidas operaciones permitidas y lectura posterior real. |
| 3. Login/acceso de superusuario, consulta, cambio, error recuperable, logout; otros perfiles rechazados | Guard/AAL2 existentes, navegador con sesión precargada y evento SIGNED_OUT simulado, error/reintento | **Parcial. No se ejecutó login, MFA, cambio permitido o logout remotos en esta ejecución.** |
| 4. Solicitudes directas, URL/payload manipulados, autoelevación, último administrador y cambio de rol en sesión | Node/API/ensamblado y SQL local; pérdida de autorización y respuestas tardías en navegador | Cubierto localmente; **efectividad remota de revocación/sesiones pendiente**. |
| 5. Diferenciar aisladas y reales; no usar pacientes reales | Cada batería declara su capa; fixtures sintéticos, contenedor sin red; cero operaciones Supabase | Satisfecho para esta entrega. |
| 6. Escenarios, archivos, comandos, resultados y commits enlazados | Este documento, artefactos versionados y comentario Jira con commit publicado | Evidencia local documentada; no convierte los bloqueos anteriores en aprobados. |

DI-148 a DI-152 figuran Listo y `e9fd2f3` documenta lecturas y rechazos remotos del 03/11 en `docs/evidencias/DI-152/`. Esa evidencia se revisó como **histórica**, no como una nueva ejecución ni como un cambio remoto aplicado. DI-152 explicita que las escrituras estaban desactivadas; no permite afirmar que DI-153 ya verificó su criterio de cambio permitido.

## 5. Bloqueos y pendientes

El preflight se limita a booleanos, sin publicar valores: no hay credenciales dedicadas de lectura/escritura y ambas banderas están apagadas. No se proporcionó aquí una sesión de administrador de prueba autorizada. La clave publicable no sustituye esa sesión ni la autorización AAL2. No se inventan contraseñas, semillas TOTP o credenciales operativas ni se buscan en archivos privados ajenos.

Además, la instrucción de esta tarea **prohíbe habilitar escrituras y cambiar Supabase remoto**. Por tanto, no se ejecutan cambios reales de roles, creación de cuentas/aprobaciones, provisión, enrolamiento, revocación de factores ni migraciones remotas. Tampoco se cambian flags en archivos o configuración compartida.

Para terminar DI-153 se necesita una sesión y un entorno dedicado con cuentas sintéticas autorizadas y un alcance separado que permita sus cambios controlados. Allí faltan verificar login/MFA real, todos los perfiles denegados, cambio permitido con aprobación y auditoría, persistencia/lectura posterior, sesión cerrada/caducada y retirada de rol/factor durante la sesión. El esquema fixture local no sustituye esas verificaciones. Mantener esos casos **pendientes/bloqueados**, sin contarlos como aprobados u omitidos de la suite Node.

**Decisión Jira: no pasar a Listo ni cambiar los criterios para acomodar las restricciones.** Registrar evidencia y pendientes mediante comentario; conservar el estado existente mientras no se cumpla la condición de cierre solicitada. No se altera DI-148–152 ni se fusiona PR #19.

## 6. Archivos y publicación

- Nuevo: `src/features/administracion/bloqueos-di153.test.mjs` — 3 pruebas aisladas del ensamblado de servidor.
- Modificado: `scripts/qa-di152-panel.py` — arnés existente portable, salida requerida y 7 casos opcionales `--di153`; conserva los 13 previos.
- Nuevo: `scripts/qa-di153-postgres.py` — ejecutor local que reutiliza SQL existente.
- Nuevo: este documento y `docs/evidencias/DI-153/` — evidencias y resultados diferenciados.

No se cambian aplicación, guards, configuración, dependencias, datos reales, módulos clínicos o migraciones. La publicación de las pruebas no habilita escrituras. Commit de alcance: `DI-153 test(admin): completar cobertura local y evidencias de permisos`.
