# DI-152 — Integrar el panel con los servicios disponibles

Fecha de trabajo: 03/11/2026, America/Lima. Responsable: Jhan Franco.
Historia: [DI-144](https://jhanfranco.atlassian.net/browse/DI-144). Subtarea: [DI-152](https://jhanfranco.atlassian.net/browse/DI-152).
Rama: `docs/auditoria-arquitectura-integral`, base `869db0366fb821d741dabc0bac7d236c0714586d`. PR19 continúa Draft, sin merge.

## Criterio consultado en Jira

DI-152 pide un panel conectado a servicios reales disponibles, con contrato/restricciones documentadas y mocks identificados. Requiere un entregable revisable vinculado a DI-144 y evidencias verificadas. DI-148–151 están Listo; DI-153 permanece pendiente. No se modificaron descripciones, responsables, fechas ni sprints.

DI-144 exige acceso de superusuario, rechazo de visitantes/pacientes/odontólogos, estados de listado, roles de la matriz y autorización del servidor. Esta entrega integra esos contratos; no sustituye la aceptación final de toda la historia ni sus pruebas pendientes.

## Estado previo y reutilización

- Layout, menú, navegación móvil, accesibilidad y estados de DI-149 existentes.
- DI-150: `/api/administracion/acceso`, sesión verificada, superusuario activo y MFA/AAL2; guard en cada operación.
- DI-151: proveedor Auth Admin + profiles, endpoint de usuarios reales, contrato de cambios de roles, aprobación/revisión/idempotencia y auditoría. No se reconstruyen ni cambian sus reglas SQL.
- El listado visual aún consumía el endpoint sintético y el formulario de escritura estaba separado en `/desarrollo/roles-admin`.

## Conexiones implementadas

1. La ruta local `/desarrollo/panel-admin` monta todas sus secciones solo después de obtener autorización de DI-150. Un cambio de sesión o un rechazo general 401/403 retira la vista y las cuentas. El HTML inicial es una carcasa de carga HTTP200; la autorización y sus rechazos efectivos corresponden a las API. No se introdujeron cookies/SSR ni otro sistema de autenticación.
2. Usuarios consulta `GET /api/administracion/usuarios/reales`. Conserva búsqueda por nombre/UUID, filtros de rol y estado, tamaño y página. Representa por separado estado de cuenta, presencia de perfil y asignación válida/ausente/inválida/suspendida. No confunde esos estados con el contrato sintético.
3. El adaptador comparte el transporte seguro existente: token nuevo por solicitud, ruta relativa fija, no-store, sin cookies ni redirecciones, timeout y errores controlados. Proyecta solo el DTO autorizado y rechaza respuestas incoherentes; no devuelve correos, credenciales, MFA ni datos clínicos.
4. Seleccionar una cuenta abre el formulario de roles existente dentro de la misma navegación. Reutiliza GET/POST `/api/administracion/roles`, aprobación independiente, revisión e Idempotency-Key. No crea aprobaciones ni endpoints. El resultado debe corresponder al código, operación y clave enviados antes de anunciar éxito.
5. Tras un resultado confirmado, la interfaz invalida el listado; volver a Usuarios consulta nuevamente. Un error o respuesta incierta conserva la clave/intención y no afirma rollback ni éxito.
6. Se conservaron layout, CSS responsive y componentes. Los proveedores sintéticos previos siguen disponibles para sus pruebas identificadas, pero no son el origen ni el fallback del panel integrado.

Archivos principales: `src/app/desarrollo/panel-admin/page.tsx`; `UsuariosAdministrativosConectados.tsx`, `UsuariosAdministrativos.tsx`, `PanelAdministrativoDemo.tsx`, `CambioRolesLocal.tsx`, `cliente.ts`, `cliente-panel-real.ts` y ajustes de texto en encabezado/navegación. El nombre histórico PanelAdministrativoDemo se conserva para no duplicar la estructura.

## Resolución de la observación de escritura

La suite real anterior registró **9 verificaciones aprobadas y una expectativa fallida**. Se conservan sus informes, sin convertirlos en una supuesta ejecución completa posterior exitosa.

| Contexto de la misma prueba afectada | HTTP esperado correcto | Recibido | Resultado |
|---|---|---|---|
| Petición con Origin 127.0.0.1 y URL reconstruida por Next con localhost | 403 ORIGEN_NO_ADMITIDO | 403 | Rechazada antes de leer el cuerpo, obtener contexto de escritura o invocar el proveedor |
| Petición y Origin localhost concordantes, escritura desactivada | 503 ESCRITURAS_DESACTIVADAS | 503 | Rechazada antes de crear el cliente de escritura |

La expectativa anterior de 503 ignoraba que el control de origen se ejecuta antes. Se corrigió el test; **no se modificaron el guard de origen, DI-150, las reglas de DI-151 ni los permisos remotos**. No se aceptan ambos códigos indiscriminadamente: cada variante exige el código y estado correspondientes a su etapa.

Se repitió únicamente esta prueba afectada, con dos variantes, contra Next local y sesión AAL2 real. Antes y después de cada POST se compararon conteos y huellas de la cuenta Auth objetivo, su perfil y las tablas administrativas de revisiones, aprobaciones y auditoría. Las cinco comparaciones quedaron idénticas. No se produjo una escritura administrativa ni un registro de auditoría de cambio aplicado. Las comprobaciones de login/MFA usan únicamente la cuenta de prueba y crean su sesión legítima; no cambian sus roles.

Evidencia: [ESCRITURA_BLOQUEADA.json](evidencias/DI-152/ESCRITURA_BLOQUEADA.json). Reproducción puntual: `node scripts/qa-di152-escritura-bloqueada.mjs`, únicamente con configuración privada y fixtures ya autorizadas del responsable. No imprime tokens ni credenciales. Para una operación legítima, usar el mismo origen concordante `http://localhost:3000` durante el login y la navegación; localhost y 127.0.0.1 tienen sesiones independientes. No eludir el guard cambiando cabeceras ni habilitar escrituras para resolver una discrepancia de origen.

## Pruebas ejecutadas y alcance

| Batería | Resultado | Capas y límites |
|---|---|---|
| Administración y autorización Node | 156/156 aprobadas | Incluye 15 nuevas del adaptador/contrato DI-152; guard/proveedor con fixtures, sin red |
| Chromium con API/Auth simulados | 13/13 aprobadas en el último intento | Listado, filtros, paginación, vacío/error/reintento, roles, refresco, pérdida de acceso, teclado y móvil; no acredita persistencia remota |
| Lectura administrativa real | Nueve casos positivos/negativos ya aprobados | Auth remoto, MFA real, API protegida, cinco cuentas sintéticas filtradas, dos odontólogos; Chromium real muestra listado, búsqueda y página 2 |
| Observación de escritura, repetición focalizada | 2/2 variantes aprobadas | 403 temprano y 503 de bandera, con comprobación SQL de conservación; sin escritura real |
| TypeScript | Exit0 | Ejecutado sobre la implementación integrada |
| Build Next.js | Ver registro de comprobaciones | Compilación complementaria, no sustituye las pruebas anteriores |
| ESLint independiente | No ejecutado | El repositorio no tiene script/configuración/dependencia de ESLint independiente; no se instaló otra herramienta |

Comando Node realmente utilizado:

```powershell
node --experimental-strip-types --test --test-reporter=tap "src/features/administracion/*.test.mjs" "src/features/autorizacion/*.test.mjs"
```

Navegador con fixtures: `python scripts/qa-di152-panel.py`, Playwright Python 1.61.0/Chromium preexistentes. El script intercepta las API y bloquea la red HTTPS externa, sin conectarse a Supabase. Los dos primeros intentos tuvieron fallos del arnés: selector de etiqueta exacta y menú móvil todavía cerrado. Se corrigieron los selectores y la apertura del menú, sin cambiar CSS ni la lógica para ocultar fallos. [Intentos completos](evidencias/DI-152/INTENTOS_NAVEGADOR.json) y [último resultado](evidencias/DI-152/NAVEGADOR_FIXTURES.json).

Lectura real ya ejecutada con `node scripts/qa-di152-real.mjs`: proceso Next temporal loopback, bandera de lectura true **solo en ese proceso**, credencial privada exclusivamente del servidor, escritura false y credencial de escritura vacía. Al terminar se detuvo el proceso y se cerraron sus sesiones de prueba. No se editaron archivos de entorno ni configuración remota. No volver a ejecutar la batería completa para la observación resuelta: basta el script focalizado. [Informe histórico con la expectativa fallida](evidencias/DI-152/LECTURA_REAL.json).

La escritura positiva y el refresco posterior se probaron con el contrato simulado, no se presentan como nuevas escrituras persistidas en Dental-IA. Las evidencias previas y la validación declarada de DI-151 se conservan como tales. No se repitió localmente la suite clínica de DI-36 ni se cambió su código; los workflows existentes pueden ejecutarla automáticamente al publicar.

## Configuración compartida y seguridad conservadas

`DENTAIA_ADMIN_READS_ENABLED=false` y `DENTAIA_ROLE_WRITES_ENABLED=false` permanecen en `.env.development.local`. El panel no cambia estas variables. La ventana de lectura controlada anterior no habilitó globalmente operaciones, no ejecutó migraciones ni alteró usuarios, RLS o datos clínicos.

El superusuario necesita sesión real AAL2; visitante, paciente, odontólogo y AAL1 reciben rechazo en las API. Los bloqueos de aprobación, concurrencia, último administrador y autoelevación siguen en DI-151. Administración no concede acceso clínico. La ruta local continúa cerrada en producción; no se despliega ni se configura Vercel manualmente.

## Cierre y trazabilidad

La integración y su observación pendiente quedaron verificadas dentro del alcance DI-152. El commit relacionado se identifica en Git por el mensaje `DI-152 feat(admin): integrar panel con servicios administrativos existentes`; su SHA y checks se registran en el comentario de Jira después de publicar. No se fusiona PR19 ni se cierra DI-144.

No se inicia DI-153. Su batería integral, incluidas nuevas escrituras persistentes con aprobaciones en un entorno autorizado, sigue pendiente; no se declara ejecutada a partir de fixtures. La desactivación compartida es una restricción documentada, no un éxito de escritura ni un permiso para activarla.

Los cambios locales previos en la guía del equipo y su manifiesto SHA-256 se conservan fuera del commit DI-152. No se incluyeron contraseñas, .env ni credenciales de infraestructura.
