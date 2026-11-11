# DI-159 — Pruebas funcionales y de acceso de la vista profesional

**Historia:** DI-145 — Vista del odontólogo
**Fecha de ejecución:** 04/11/2026 (America/Lima)
**Entorno:** Windows local, Node.js 22.16.0, Next.js 15.5.28, sin red, sin credenciales y con datos sintéticos.
**Base evaluada:** `9cd2d7430abdc5807beec5b742396ba4b43e8c8d` más los cambios locales de DI-159 descritos en este documento.

## Alcance y regla de evidencia

Esta evidencia cubre contratos TypeScript y proveedores locales sintéticos. No acredita autenticación, roles, RLS, auditoría persistente, API HTTP ni datos clínicos reales. Las palabras *permiso*, *revocación* y *auditoría* se refieren a los dobles de prueba descritos aquí, salvo que se indique expresamente lo contrario.

No se ejecutaron comandos que lean `.env`, contacten Supabase ni modifiquen servicios externos. `next-env.d.ts` tenía una modificación local ajena y se dejó intacto.

## Matriz de criterios

| Criterio DI-159 | Cobertura local | Capa y evidencia | Límite pendiente |
| --- | --- | --- | --- |
| 1. Roles, permiso, alcance, vigencia, revocación, IDs, procedencia y estados | Parcial | Unitarias de historial y resultados; denegación, expiración, revocación, alcance por registro, IDs no resueltos y estados seguros. | No hay identidad, rol ni validación de formato UUID real. |
| 2. Vista → contrato → permisos → origen → auditoría | Parcial | Integración local proveedor → servicio → modelo de vista; el proveedor de demostración exige un auditor sintético. | Sin React DOM, API, persistencia ni auditoría de servidor. |
| 3. Caso autorizado entre dos clínicas | Cubierto sintéticamente | Cronología ordenada y procedencia de dos clínicas en `historial-autorizado.test.mjs`. | No valida clínicas ni profesionales reales. |
| 4. Casos denegados y cambio de contexto | Parcial | Contexto sin concesión, IDs no resueltos, permiso denegado/expirado/revocado y limpieza de vistas sintéticas. | Visitante, sesión, rol incorrecto y manipulación HTTP real no existen en este frontend. |
| 5. Control del paciente y revocación | Parcial | Una concesión mutable en memoria permite y luego deniega una nueva lectura. | No hay identidad de paciente, operación persistente ni revocación autenticada. |
| 6. Auditoría permitida/denegada y fallo cerrado | Cubierto sintéticamente | Política requerida sin auditor devuelve error; el proveedor de demostración configura un auditor en memoria y el contrato espera su resultado antes de devolver. | No es bitácora protegida, atómica ni persistente en servidor. |
| 7. Flujos funcionales, navegación, teclado y móvil | Parcial | Estados y limpieza se verifican en modelos puros; recorrido visual fue informado manualmente. | No hay arnés React/DOM/E2E instalado; no se automatizaron navegación, foco, responsive ni solicitudes. |
| 8. Campos, exámenes, fechas y procedencia | Parcial | Utilidades de fechas/campos, orden cronológico y ausencia de duplicados se prueban con fixtures sintéticas. | No hay renderizado DOM automatizado ni validación clínica. |
| 9. Sin conexiones externas ni expedientes reales | Cubierto | Suite determinista sin red, sin credenciales y con proveedores locales. | No sustituye pruebas posteriores contra un entorno controlado real. |

## Escenarios y aserciones relevantes

- Una concesión sintética permite únicamente encuentros incluidos en su alcance; IDs repetidos no duplican la cronología.
- Paciente o contexto no resuelto devuelve denegación sin caso ni entradas.
- Revocar la concesión en memoria entre dos lecturas obliga a reevaluar y denegar la segunda.
- Los permisos denegado, expirado y revocado no transportan contenido de historial ni resultado educativo.
- La transición de contenido educativo a acceso denegado pasa por carga vacía y termina sin resultado.
- La auditoría sintética registra solamente `operacion`, `patientId`, `contextId` y `resultado`; un error al registrarla retorna error sin caso ni entradas.
- Una política de auditoría requerida sin auditor configurado retorna error sin caso ni entradas.
- Excepciones síncronas, rechazos asíncronos de auditoría y fallos de fuente retornan error sin contenido.
- Resultados educativos conservan una lista blanca; campos ajenos al contrato no llegan a la vista.

Las aserciones comparan estados, colecciones vacías, orden, ausencia de propiedades y resultados exactos. No se usan temporizadores de espera, red ni reproducciones de lógica de producción dentro de las pruebas.

## Comandos y resultados

```powershell
npm.cmd run test:profesional
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false
git diff --check
```

Resultado de la suite profesional: **35 aprobadas, 0 fallidas, 0 omitidas, 0 canceladas**.
Typecheck: **correcto, sin salida de errores**.

`npm.cmd` se usa porque la política local bloquea `npm.ps1`; el script no usa `.env` ni red. Se emplea `--experimental-strip-types` de Node 22 porque las pruebas `.mjs` importan módulos TypeScript directamente.

## Defecto identificado y corrección aplicada

Antes de este trabajo, `crearServicioHistorialAutorizado` no tenía un puerto de auditoría: ninguna prueba podía comprobar que un fallo de auditoría bloqueara una lectura. Se incorporaron `AuditorHistorialSintetico` y una política explícita: la compatibilidad heredada permanece opcional, pero el proveedor que usa la demostración exige auditoría y configura un auditor local.

El evento expone solo la operación, IDs sintéticos de solicitud y resultado; nunca entradas ni campos clínicos. Si falta un auditor bajo política requerida, o su registro falla, el servicio retorna el estado seguro `error` sin caso ni entradas. El auditor del proveedor de demostración conserva únicamente el último evento en memoria del navegador: puede perderse o alterarse y no es auditoría persistente, protegida ni productiva.

## Riesgos y dependencias pendientes

- El selector de escenarios y los proveedores locales son modificables desde el navegador; no constituyen seguridad.
- No existe modelo local de sesión, roles ni profesionales verificados; por ello no se afirma cobertura de visitante o rol incorrecto.
- Los identificadores sintéticos se resuelven por existencia, no por un contrato UUID/API definitivo.
- Falta un arnés de componentes React y navegador. No se instalaron dependencias nuevas por no tener autorización.
- Las pruebas React/DOM/E2E siguen pendientes: las ejecutadas cubren modelos y contratos, no DOM, foco, navegación ni responsive.
- Una revocación concurrente después de leer la concesión y antes de completar una auditoría asíncrona podría requerir una nueva validación para evitar entrega tardía. El doble local no resuelve esa carrera; una API real necesita autorización y auditoría atómicas del servidor.
- Falta adaptar la vista a la API autorizada de Jhan y comprobar JWT, RLS, auditoría atómica, revocación persistente, errores HTTP, caché y aislamiento entre usuarios en un entorno de prueba.
- No se ejecutó `npm run build`: podría regenerar `next-env.d.ts` y escribir `.next`, fuera del alcance seguro de esta verificación.
