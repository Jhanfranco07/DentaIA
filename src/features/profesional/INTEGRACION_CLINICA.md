# Integración clínica de la vista odontólogo

La ruta `/profesional` usa `ProfesionalClinico`. No usa el proveedor sintético
como fallback: sin sesión o sin backend disponible muestra un estado sin datos.

## Contratos consumidos

- `GET /api/professional/me`
- `GET /api/professional/requests?membershipId=<uuid>`
- `GET /api/professional/patients?membershipId=<uuid>`
- `GET /api/clinical/patients/<patientId>/history?membershipId=<uuid>`

El token de la sesión Supabase se obtiene solo para la solicitud actual y se
envía al BFF same-origin en `Authorization: Bearer`. El navegador no consulta
tablas clínicas ni usa claves privilegiadas.

`api-clinica.ts` reconstruye DTOs permitidos y rechaza respuestas incompatibles.
`control-consultas-clinicas.ts` aborta solicitudes pendientes y descarta sus
resultados al cambiar sesión, clínica o paciente. El historial conserva el cursor
opaco emitido por el servidor; no lo interpreta ni genera otro cursor.

Mientras un historial está visible, `ProfesionalClinico` lo vuelve a consultar al
recuperar foco, al volver visible la pestaña y como máximo una vez por minuto. Cada
revalidación limpia el contenido antes de pedirlo otra vez; una respuesta `401` o
`403` elimina el historial y el paciente seleccionado. Esta defensa reduce la
exposición de datos en caché de interfaz, pero no promete revocación instantánea:
el BFF y sus RPC siguen siendo la autoridad para cada lectura.

Los eventos cercanos de foco, visibilidad e intervalo se coordinan en una sola
lectura activa y, si ocurre otra señal durante ella, se ejecuta una única
revalidación posterior. Una lectura exitosa informa que la cronología se actualizó
desde la primera página; las páginas acumuladas y su cursor no se conservan.

Las páginas posteriores deben conservar el mismo `professionalId` y, para
solicitudes, el mismo `membershipId`; las discrepancias se cierran limpiando el
contexto. Las fechas ISO se validan también contra el calendario, no solo por
expresión regular.

## Pruebas locales

```powershell
npm.cmd run test:profesional
npm.cmd exec -- tsc --noEmit --incremental false
```

`test:profesional` incluye las cuatro suites sintéticas DI-156--DI-159 y las tres
suites del flujo clínico real: cliente HTTP, cancelación de consultas y coordinación
de revalidación. Son pruebas unitarias locales; no montan componentes React ni
constituyen una verificación E2E.

La verificación E2E requiere que el BFF de Jhan y las RPC clínicas estén presentes
en la aplicación, más cuentas QA sintéticas autorizadas. Esta rama no incorpora
esas rutas ni configura secretos o cuentas QA.
