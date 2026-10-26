# Cuenta de pacientes — Jhan

Ruta: `/cuenta`. Rama: `feature/jhan-auth`.

## Ejecutar

Usar Node.js 22 (mínimo 22.9), `npm ci` y la configuración pública existente:
`Copy-Item .env.example .env.local` si el archivo local aún no existe. No sobrescribir un entorno existente.
Ejecutar `npm run dev` y abrir http://localhost:3000/cuenta.
El build de CI no necesita credenciales. En Vercel las dos variables públicas deben estar disponibles
durante el build; este módulo no cambia la configuración de despliegue.

El registro guarda el nombre en los metadatos de Auth. Si el servicio exige confirmación por correo,
no crea el perfil antes de tener una sesión: el paciente confirma y vuelve a iniciar sesión.
Tras verificar `getUser()`, se consulta su perfil y, si falta y tiene un nombre válido, se crea.
Las cuentas anteriores sin nombre pueden completarlo desde el formulario de perfil.
Solo se actualiza `full_name`; RLS sigue siendo la autorización real.
El SDK existente conserva la sesión en el navegador. El cierre de sesión es local a ese navegador.

## Comprobaciones

```powershell
node --experimental-strip-types --test src/features/cuenta/validaciones.test.mjs src/features/cuenta/perfiles.test.mjs
npm run typecheck
npm run build
npm audit
npm run check:supabase
```

Las pruebas de `perfiles.test.mjs` usan un cliente simulado: cubren restricciones de identidad,
campos enviados, errores y creación simultánea; no demuestran las políticas RLS del servidor.
Los workflows existentes verifican tipos, build y auditoría; no ejecutan estos tests adicionales.

## Demostración funcional con una cuenta ficticia

1. Sin sesión, comprobar que solo se muestran los formularios, incluso tras recargar.
2. Enviar campos vacíos, correo inválido, nombre de un carácter y contraseñas distintas.
3. Registrar una cuenta de prueba con un correo controlado y confirmar el mensaje cuando corresponda.
4. Confirmar el correo si el servicio lo exige; ingresar con la cuenta válida.
5. Comprobar correo y nombre; editar el nombre, guardar y recargar para comprobar persistencia.
6. Probar un nombre de menos de 2 caracteres; no debe enviarse a Supabase.
7. Cerrar sesión; el perfil desaparece. Recargar y comprobar que no se puede editar sin sesión.
8. Con dos cuentas ficticias diferentes, comprobar aislamiento real; no reutilizar una sola cuenta
   para afirmar que se ha probado acceso entre usuarios.

No incluir contraseñas en evidencias, commits ni consola. No sobrescribir ni eliminar la cuenta compartida.
Una prueba con credenciales inválidas confirma el contacto con Auth, pero no demuestra un login correcto.
Sin credenciales de prueba quedan pendientes el login válido, la confirmación por correo, lectura/creación/
edición reales del perfil, persistencia autenticada, cierre de una sesión real y aislamiento entre cuentas.

## Guion para la presentación

«Desarrollé mi módulo sin cambiar los de mis compañeros. El primer commit agrega registro y login;
el segundo guarda el perfil en Supabase y el tercero controla validaciones y cierre de sesión.
Reutilizo el cliente común, verifico la identidad con getUser y RLS protege cada perfil.
Muestro las validaciones, el flujo con mi cuenta ficticia y las verificaciones de GitHub Actions.
Distingo las pruebas locales simuladas de los flujos que he probado realmente con Supabase».


## Siguiente ronda propuesta (no es trabajo ya finalizado)

La primera ronda de cuenta está integrada en PR #5. No rehacer registro, login ni perfil.

- **DI-27, «Corregir fallos funcionales del prototipo» (Sprint 5):** detectar y corregir un error real de navegación/formulario o manejo de errores; dejar pasos para reproducir y verificar la corrección. Relacionado con **DI-94**, «Revisar navegación y manejo de errores», y **DI-95**, «Corregir errores y actualizar despliegue».
- **DI-26, «Priorizar e implementar mejoras de interfaz» (Sprint 5):** solo si hay hallazgos verificables, priorizar por gravedad/frecuencia/esfuerzo y mostrar antes/después; no inventar feedback. Puedes centrarse en accesibilidad, foco con teclado y mensajes de confirmación del módulo `/cuenta`.
- **Pruebas:** ampliar las nueve pruebas existentes cuando aparezca un caso nuevo que pueda comprobarse sin red. Mantener las pruebas con RLS/Supabase real como evidencia separada.

Trabajar en nueva rama propia derivada de `main`, solo `src/app/(modulos)/cuenta/**` y `src/features/cuenta/**`. Crear PR con evidencias; CI, Security y Tests validan automáticamente. Ver [guía de próximas rondas](../../../docs/DESARROLLO.md).


## Entregables numerados de Jhan

- **Avance 1 — COMPLETADO en PR #5:** registro/login, perfil y sesión; 9 pruebas aisladas y pruebas RLS controladas.
- **Avance 2 — DI-27 / DI-94–95:** detectar y corregir errores reproducibles de cuenta, validaciones, mensajes, navegación con teclado y sesión. Documentar antes/después, prueba y PR. **DI-26** solo se atribuye a cambios priorizados desde hallazgos reales.
- **Avance 3 — DI-34 / DI-111–113:** documentar arquitectura, entidades y contratos de acceso. **DI-40:** evaluación de visión *exploratoria* con metodología, datos aptos y métricas si se implementa; no producir diagnósticos. No modificar módulos ajenos.
- **Avance 4 — DI-45:** checklist de integración, revisión de GitHub Actions/Vercel, documentación técnica de release, demostración final y retrospectiva. Mantener correo de confirmación real como prueba pendiente hasta verificarlo.

**En paralelo, tareas académicas asignadas en Jira del Sprint 5:** DI-30 benchmarking/posicionamiento (en curso) y DI-32 viabilidad/flujo de caja (por hacer). No se consideran completadas por cambios del módulo de cuenta.

Cada avance requiere **su propio PR o entregable verificable**, partiendo de `main`, con commits en español; no rehacer Avance 1. Ver [plan maestro](../../../docs/DESARROLLO.md).
