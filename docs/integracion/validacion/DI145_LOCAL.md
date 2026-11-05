# DI-145 — validación local Sprint 5

Fecha: 04/11/2026 (America/Lima). Entorno local, Node.js 22.17.0. Los archivos de entorno se revisaron únicamente para confirmar presencia de variables; no se registraron ni publicaron sus valores.

## Aprobadas

- Variables públicas Supabase en `.env.local` y configuración clínica en `.env.development.local`: presentes.
- `npm run typecheck`: aprobado.
- `npm run build`: aprobado; Next.js compiló y generó las rutas, incluida `/profesional`.
- Pruebas automatizadas aisladas: 384 aprobadas, 0 fallidas, 0 omitidas. Incluye los módulos existentes y DI-145.
- Pruebas profesionales locales: 60 aprobadas, 0 fallidas, 0 omitidas.
- Pruebas DI-159 del cliente contra el BFF real en memoria: 5 aprobadas, 0 fallidas. Incluyen perfil y contexto, solicitudes asignadas, pacientes autorizados, historial, 401/403, nueva denegación al cambiar el resultado de autorización del RPC, y llamada sin token tras logout.
- `git diff --check`: aprobado.

Las pruebas DI-159 en memoria usan dobles de autenticación/RPC. Su resultado no demuestra login remoto, RLS ni auditoría SQL persistente; el evento de auditoría de esa suite es un doble en memoria.

## Pendientes / bloqueadas

- `npm run check:supabase`: aprobado como operación de solo lectura; conexión real confirmada, cuatro perfiles ficticios del directorio y cero filas privadas visibles para el visitante en las tablas comprobadas. No ejecutó Auth.
- E2E real de DI-159: pendiente. No se intentó login ni se ejecutaron pruebas que requieran contraseñas o cuentas QA. El almacén privado local de esas cuentas no está presente.
- Por lo anterior quedan pendientes la revocación y expiración persistentes, auditoría remota, alcance real entre cuentas y el recorrido real del odontólogo.

No se hicieron escrituras en Supabase ni cambios a RLS, migraciones o permisos. El primer intento local fue bloqueado por red (`EACCES`); tras autorizar la ejecución con red, el mismo chequeo de solo lectura aprobó.
