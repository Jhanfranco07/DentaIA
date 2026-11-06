# Guía del equipo — backend académico compartido

Verificado el 03/11/2026, America/Lima. **Solo datos sintéticos; no uso clínico real.**

## Versión e instalación

Repositorio: https://github.com/Jhanfranco07/DentaIA. Rama: `docs/auditoria-arquitectura-integral`. Utilizar el nuevo commit publicado de esta entrega, informado al finalizar, y registrar `git rev-parse HEAD`. [PR19](https://github.com/Jhanfranco07/DentaIA/pull/19) sigue Draft; no está integrado en main.

Requisitos: Node.js 22, npm, Git e Internet. Anelis y Angie **no necesitan Docker**, Supabase CLI, PostgreSQL local ni credenciales administrativas. Para probar sin tocar sus interfaces:

```powershell
git fetch origin
git status --short
git worktree add --detach ../DentaIA-backend-qa origin/docs/auditoria-arquitectura-integral
cd ../DentaIA-backend-qa
npm ci
```

Conservar primero los cambios personales. No cambiar de rama con trabajo sin respaldar.

## Configuración e inicio

Proyecto Dental-IA: `vwmdknzjyvmsdqpepykz`. No repetir migraciones ni semillas: ya están aplicadas.

Crear `.env.development.local`, ignorado por Git. Obtener la **publishable key** de Jhan por canal privado o del panel autorizado. Nunca secret/service_role. Generar un secret de cursor diferente por computadora con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` y guardarlo únicamente localmente.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://vwmdknzjyvmsdqpepykz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable del proyecto>
DENTAIA_CLINICAL_HTTP_ENABLED=true
DENTAIA_CLINICAL_TARGET=dentalia_academic
DENTAIA_CLINICAL_ACADEMIC_ENABLED=true
DENTAIA_CLINICAL_PROJECT_REF=vwmdknzjyvmsdqpepykz
DENTAIA_CLINICAL_SUPABASE_URL=https://vwmdknzjyvmsdqpepykz.supabase.co
DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY=<la misma publishable>
DENTAIA_CLINICAL_DEMO_USER_IDS=798b53d9-9bfb-483b-8f6e-6d28403a1925,f244056c-e9bc-44e4-94d6-5b93e610429b,d3374749-74b2-4146-8c40-05a268d57af9,c7a44fd8-045b-4096-a1db-0df0b46f2969,42ce87d9-0b63-422c-9805-d25b2f681b71
DENTAIA_CLINICAL_CURSOR_SECRET=<32 bytes aleatorios base64url>
DENTAIA_CLINICAL_CURSOR_TTL_SECONDS=300
DENTAIA_ADMIN_READS_ENABLED=false
DENTAIA_ROLE_WRITES_ENABLED=false
```

Solo las dos variables NEXT_PUBLIC se envían al navegador. No compartir `.env.local` del operador, conexión PostgreSQL, claves administrativas ni secret de cursor. Jhan ya tiene el archivo preparado; puede regenerarlo en su computadora con `node scripts/configurar-entorno-academico.mjs`, que usa su almacén privado. Las integrantes configuran únicamente los valores anteriores.

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Abrir `http://127.0.0.1:3000/cuenta`. Mantener el mismo origen y reiniciar Next tras cambiar variables. localhost y 127.0.0.1 tienen sesiones independientes: permiten probar dos cuentas sin cerrar la primera. El SDK de la aplicación inicia sesión contra Auth remoto; el BFF valida firma e identidad fresca.

## Cuentas y entrega privada

| Cuenta | Identificador sintético | Rol | Uso |
|---|---|---|---|
| Paciente Demo A | fase8-paciente-a@dentaia.test | paciente | Angie: dos solicitudes, dos atenciones en dos clínicas, dos concesiones vigentes |
| Paciente Demo B | fase8-paciente-b@dentaia.test | paciente | Contraprueba: una solicitud/atención, concesión vencida y revocada |
| Odontólogo Demo A | fase8-odontologo-a@dentaia.test | odontologo | Anelis: Clínica Demo A, una solicitud, dos atenciones autorizadas de A |
| Odontólogo Demo B | fase8-odontologo-b@dentaia.test | odontologo | Clínica Demo B, dos solicitudes, una atención autorizada de A |
| Administrador Demo | fase8-admin@dentaia.test | superusuario | Jhan: autorización administrativa MFA/AAL2; sin acceso clínico automático |

No reciben correo. Auth Admin confirmó individualmente estas cinco cuentas; no se desactivó la confirmación global. Las verificaciones profesionales se identifican como fixtures sin acreditación real. Los dos dentistas demo están **inactivos** y fuera del catálogo público.

Passwords diferentes, guardados con DPAPI fuera de Git y ACL del usuario Windows de Jhan/SYSTEM. Jhan puede verlos personalmente en una ventana privada:

```powershell
powershell -NoProfile -File scripts/ver-credenciales-academicas.ps1
```

Compartir únicamente la contraseña de la cuenta asignada mediante un gestor de contraseñas con entrega privada o canal cifrado acordado. No enviar DPAPI, capturas ni secretos al chat. **La entrega privada al equipo no se ha realizado automáticamente.**

El administrador QA ya tiene un TOTP verificado. Jhan puede incorporar personalmente su secreto existente al autenticador desde el tercer campo de la ventana privada. No iniciar otro enrolamiento ni borrar factores. Para desafío legítimo: `/desarrollo/mfa-admin`, habilitando `DENTAIA_QA_MFA_ENABLED=true` solo localmente si corresponde. `/api/administracion/acceso`: AAL1 devuelve 403; AAL2 autorizado, 200. No compartir ese factor con las integrantes.

`/desarrollo/panel-admin` es la estructura visual local existente. Su disponibilidad no significa que las operaciones reales de DI-151 estén habilitadas en esta configuración compartida. No se modificó esa implementación.

## Contratos y consumo

Fuentes: [tipos TypeScript](backend_mvp/CONTRATOS_CLIENTE.ts), [contratos y ejemplos](GUIA_INTEGRACION_FRONTEND_QA.md) y `src/features/clinica-http/`. El BFF remoto devuelve `environment: academic_remote`; los RPC conservan su etiqueta interna histórica `qa_local`, sin convertir por ello las pruebas remotas en locales.

| Método | Ruta | Alcance |
|---|---|---|
| GET | /api/professional/me | Profesional propio y contextos activos |
| GET | /api/professional/requests?membershipId=UUID | Solicitudes asignadas, sin contactos privados |
| GET | /api/professional/patients?membershipId=UUID | Pacientes con concesión vigente |
| GET | /api/clinical/patients/UUID/history | Propietario; profesional añade contexto autorizado |
| GET | /api/clinical/patients/me | Identificador clínico propio |
| GET | /api/clinical/access-grants | Concesiones propias, alcance y estado |
| POST | /api/clinical/access-grants | Propietario, Idempotency-Key UUID y alcance explícito |
| POST | /api/clinical/access-grants/UUID/revoke | Propietario; cuerpo `{}`; idempotente |

Todos requieren Bearer de la sesión real, sin imprimirlo:

```ts
const { data: { session } } = await supabase.auth.getSession();
if (!session) throw new Error('Iniciar sesión');
const response = await fetch('/api/professional/me', {
  headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
});
const result = await response.json();
if (!response.ok) { /* estado restringido/error; no sustituir por mocks */ }
```

Paciente: obtener primero `patients/me`, luego concesiones e historial. Profesional: `professional/me`, seleccionar uno de sus contexts y utilizar su membershipId. **Auth UUID, patientId, dentistId, professionalId y membershipId son distintos.** Los UUID sintéticos están en [el inventario](integracion_fase8/LOTE_ACADEMICO_REAL.json).

Contrato de concesión, sustituyendo solo por recursos propios del lote:

```json
{"membershipId":"<contexto-demo>","encounterIds":["<atencion-propia>"],"expiresAt":"<ISO futura hasta 24 horas>","policyVersion":"QA-NO-CLINICO-v1","accepted":true}
```

Generar una clave con crypto.randomUUID() por intención y conservarla en reintentos. La prueba HTTP de esta entrega **reutilizó** una concesión sembrada: 200/replayed=true, no 201. No afirmar creación HTTP nueva. El operador insertó cuatro concesiones y el paciente B revocó una realmente por JWT/RPC.

Workspace usa limit/afterId y nextAfterId; historial usa limit/cursor y nextCursor opaco firmado, ligado a actor, sesión, contexto y límite. No intercambiarlos. Filtros de solicitudes: requested/cancelled.

## Escenarios y estados de interfaz

Mostrar carga, vacío, éxito, restringido y error. Al cambiar cuenta/contexto, vaciar información anterior y descartar respuestas atrasadas. 400: entrada inválida; 401: iniciar/renovar sesión; 403: denegado sin revelar existencia; 404: servicio cerrado; 409: conflicto idempotente; 413/415: tamaño/tipo; 503: proveedor/servicio no disponible. No convertir un error real en éxito con fixtures.

- Angie: reutilizar perfil y solicitudes propias existentes; el historial de solicitudes es distinto del clínico. Paciente A no lee ni modifica perfil/historial/solicitudes de B.
- Anelis: profesional A tiene un contexto y una solicitud; B, un contexto y dos solicitudes (una cancelada). Ambos acceden solo al alcance vigente de A. El historial de B se rechaza por expiración/revocación. No consultar tablas clínicas directamente ni utilizar service_role para evitar RLS.
- Jhan: MFA/AAL2 y DI-150 comprobados con la cuenta nueva. Lecturas/escrituras administrativas desactivadas en el entorno compartido; DI-151 intacto.
- Consentimiento fotográfico y autorización clínica son finalidades distintas. Esta entrega leyó cero consentimientos propios nuevos; **no probó nuevas subidas/eliminaciones fotográficas remotas**. No tocar el archivo preexistente.

Las dos concesiones vivas vencen **24 horas después de la siembra**: revisar expiresAt; la expiración no es un fallo del backend. Renovar exige acción controlada del paciente sobre recursos propios. No alargar vigencias por SQL. Los exámenes son metadatos unavailable, sin archivos ni descarga clínica.

La activación limita cinco cuentas y los recursos inventariados. Añadir nuevas membresías, atenciones, entradas, documentos o solicitudes fuera del inventario puede cerrar los servicios hasta revisar otra activación específica. No ampliar allowlists por conveniencia. Las cinco cuentas originales siguen con la clínica cerrada.

## Integración conservadora en ramas personales

No es necesario modificar main para probar. Respaldar primero el trabajo personal. Cuando su responsable autorice incorporar el backend:

```powershell
git fetch origin
git status --short
git merge --no-ff origin/docs/auditoria-arquitectura-integral
npm ci
npm run typecheck
npm run build
node --experimental-strip-types --test "src/features/**/*.test.mjs"
```

Conserva commits administrativos y de las integrantes. No force push, squash, rebase ni cherry-picks duplicados. Ante conflictos, detenerse y acordar con la autora; no aceptar ours/theirs automáticamente. **Esta ejecución no alteró sus ramas ni interfaces.**

Antes de esta entrega, backend/main divergen en 15/8 commits; merge-tree de esas referencias no detectó conflictos. No equivale a validación visual de la combinación ni autoriza merge del PR19. Cada rama debe probar su integración. Utilizar los checks del nuevo SHA; no los de 49985c5.

## Evidencias y pendientes

[Informe vigente](INTEGRACION_FINAL_SUPABASE_DENTALIA.md): 35 comprobaciones reales Next/Dental-IA, 12 reales SDK/RLS/MFA, 7 SQL locales, 284 pruebas aisladas, TypeScript/build/audit y ocho cierres de producción.

Pendientes: entregar credenciales privadamente y recorrer las interfaces del equipo; pruebas excepcionales remotas de fallos de auditoría (solo cubiertas localmente); renovación legítima de concesiones; verificación profesional, consentimiento, retención, destinatarios y descarga auditada para uso real. No se certifica aptitud clínica ni se habilita Vercel.
