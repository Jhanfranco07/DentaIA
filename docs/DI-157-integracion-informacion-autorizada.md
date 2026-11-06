# DI-157 â€” IntegraciÃ³n demostrativa de informaciÃ³n autorizada del paciente

**Proyecto:** DentaIA
**Historia relacionada:** DI-145 â€” Vista del odontÃ³logo
**Predecesora:** [DI-156](./DI-156-implementacion-vista-profesional.md)
**Estado:** implementaciÃ³n demostrativa con datos y permisos exclusivamente sintÃ©ticos.

## Objetivo y lÃ­mite

DI-157 aÃ±ade a `/profesional` un lÃ­mite de servicio entre la interfaz y la fuente de historiales. Permite demostrar quÃ© recibe la vista cuando un permiso sintÃ©tico estÃ¡ concedido, denegado, expirado o revocado, sin consultar ni almacenar informaciÃ³n clÃ­nica real.

No es una integraciÃ³n autorizada con Supabase ni una implementaciÃ³n de seguridad. Los selectores de paciente, clÃ­nica y escenario son controles visibles de demostraciÃ³n; una persona puede cambiarlos desde el navegador y no representan identidad, rol ni concesiÃ³n verificables.

## ImplementaciÃ³n

| Archivo | Responsabilidad |
| --- | --- |
| `src/features/profesional/historial-autorizado.ts` | Contrato de consulta, respuestas seguras de interfaz y servicio que evalÃºa una fuente inyectada. |
| `src/features/profesional/proveedor-historial-sintetico.ts` | Fuente sintÃ©tica de contextos y concesiones. Puede sustituirse sin cambiar la interfaz. |
| `src/features/profesional/ProfesionalDemo.tsx` | Solicita datos al proveedor, limpia la vista antes de cada consulta y permite cambiar paciente, clÃ­nica y escenario de demostraciÃ³n. |
| `src/features/profesional/EstadoHistorial.tsx` | Muestra Ãºnicamente los datos devueltos por el servicio y mensajes seguros cuando no hay autorizaciÃ³n. |

La concesiÃ³n sintÃ©tica del paciente A, desde la clÃ­nica de contexto Norte, incluye dos atenciones: una de la ClÃ­nica ficticia Costa y otra de la ClÃ­nica ficticia Centro. Su procedencia, profesional y fechas se mantienen en cada entrada. El paciente B tiene una concesiÃ³n sintÃ©tica deliberadamente limitada a una sola atenciÃ³n para comprobar el alcance por registro.

## Estados simulados

| Escenario | Resultado de la interfaz | Datos clÃ­nicos visibles |
| --- | --- | --- |
| Permiso concedido | CronologÃ­a filtrada por `encounterIds` autorizados en la fixture. | Solo las atenciones incluidas en el alcance sintÃ©tico. |
| Permiso denegado | Alerta segura. | Ninguno. |
| Permiso expirado | Alerta segura que indica vencimiento simulado. | Ninguno. |
| Permiso revocado | Alerta segura que indica revocaciÃ³n simulada. | Ninguno. |
| Sin datos / error | Estado existente de DI-156. | Ninguno. |

Al cambiar paciente, clÃ­nica o escenario, la vista se reinicia a carga con caso y atenciones vacÃ­os. La solicitud anterior se cancela al cambiar sus dependencias, por lo que no debe quedar informaciÃ³n visible mientras se resuelve la siguiente respuesta.

## Pruebas

Las pruebas aisladas de `historial-autorizado.test.mjs` cubren:

- cronologÃ­a autorizada del paciente A y la procedencia de dos clÃ­nicas;
- filtrado por alcance de registros para el paciente B;
- denegaciÃ³n al cambiar a una clÃ­nica sin concesiÃ³n sintÃ©tica;
- permisos denegado, expirado y revocado sin datos devueltos;
- paciente inexistente, vacÃ­o y error sin conservar datos clÃ­nicos.

Resultados de verificaciÃ³n ejecutados el 02/11/2026:

- `node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"`: **101 aprobadas, 0 fallos**.
- `npm.cmd run typecheck`: correcto.
- `npm.cmd run build`: correcto; incluye la ruta estÃ¡tica `/profesional`.

PowerShell bloquea `npm.ps1` por la polÃ­tica local de firmas, por eso los dos Ãºltimos comandos se invocaron con `npm.cmd`; no se cambiÃ³ esa polÃ­tica.

## Pendiente para la integraciÃ³n real

Jhan confirmÃ³ que no existen todavÃ­a tablas de historias clÃ­nicas compartidas, clÃ­nicas, autorizaciones ni auditorÃ­a clÃ­nica en Supabase. Para reemplazar este proveedor serÃ¡n necesarios, como mÃ­nimo:

1. Roles verificables y relaciÃ³n profesionalâ€“clÃ­nica derivados de la identidad autenticada.
2. Pacientes, atenciones, concesiones con alcance/vigencia/revocaciÃ³n y auditorÃ­a de accesos.
3. RLS y un RPC o servicio de backend que autorice, audite y devuelva datos de forma atÃ³mica, con denegaciÃ³n si la auditorÃ­a falla.
4. Tipos de Supabase regenerados y pruebas reales con identidades separadas, revocaciÃ³n y aislamiento entre pacientes.

No se deben reutilizar `patient_consents` ni los permisos de fotografÃ­as para esta finalidad: esos datos cubren almacenamiento privado de imÃ¡genes, no acceso entre profesionales o clÃ­nicas.
