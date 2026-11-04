# Arquitectura física

## Topología observada

Navegadores consumen Next.js integrado en Vercel. Los módulos cliente usan Supabase JS por HTTPS para Auth, Data API y Storage. GitHub contiene main y ramas de funcionalidades. No se encontró servidor de IA, Edge Functions desplegadas ni servicio externo de historia clínica. La ubicación/región, plan, backups y restricciones de red del proyecto no se verificaron; no se deducen del nombre del repositorio.

main observado: 1bcb84956e755b4089494af43f983fd0d2e5bfad. La API de estados devuelve Vercel success para ese SHA. Esto verifica el estado reportado por la integración, no una prueba funcional del sitio. Administración c992a142 y paciente 502790a6 pertenecen a ramas separadas y no se asumen desplegados en producción.

## Justificación de tecnologías

| Tecnología | Evidencia / estado | Justificación y límite |
|---|---|---|
| Next.js 15.5.28, React 19.1.8 | package.json main | App Router y servidor/cliente comunes; evitar introducir otro backend para CRUD sin necesidad |
| TypeScript 5.9.3 | package.json y tsconfig | Contratos estáticos; no sustituye validación de entradas ni pruebas |
| Supabase JS 2.118.0 | paquete actual | Reutiliza Auth, Data API y Storage; sesiones personales existentes |
| PostgreSQL Supabase | Catálogo de Dental-IA | Integridad, transacciones y RLS; no desplegar migraciones desde esta documentación |
| Storage privado | Bucket observado dental-photos | Aísla binarios y propiedad; borrado no es atómico con DB |
| Vercel | Estado de commit Vercel success | Hosting Next.js existente; duración de funciones y plan no inspeccionados |
| GitHub Actions, Node 22 | ci.yml/tests.yml/security.yml | Repetición de tipos, compilación, tests aislados y npm audit |
| server-only 0.0.1 | Rama administrativa | Evita importar adaptadores privilegiados en cliente; no sustituye autorización |
| Runtime de visión | Propuesto, proveedor sin decidir | Evaluar cómputo/costo/latencia después de medir modelo; sin afirmar Render/AWS/FastAPI actuales |

## Entornos y secretos

Separar local, QA y producción con proyectos/datos y secretos distintos cuando el equipo lo apruebe. NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY son configuración cliente; nunca poner ahí credenciales de lectura/escritura administrativa. DENTAIA_ADMIN_READS_ENABLED y DENTAIA_ROLE_WRITES_ENABLED requieren opt-in explícito. DENTAIA_SUPABASE_ADMIN_READ_SECRET y DENTAIA_SUPABASE_ROLE_WRITE_SECRET solo servidor, con rotación y ámbito mínimo. Las variables QA/MFA y bootstrap no son permisos ni rutas productivas. No se inspeccionaron valores.

HTTPS extremo a extremo; no deshabilitar TLS. El changelog oficial consultado anuncia retirada de cifrados TLS 1.2 antiguos el 10/11/2026: validar clientes compatibles, sin cambiar dependencias por esta revisión. El índice .md no pudo abrirse por content-type; se consultó el changelog HTML. No se asume conectividad clínica externa ni VPN.

## Operación propuesta

Logs estructurados con request_id, código, duración y resultado, sin bearer, correos, texto clínico o URL con filtros sensibles. Medir tasa de errores, latencia de RPC/Storage, fallos de auditoría, reintentos y trabajos atascados. No se comprobó una solución APM ni alertas actuales; elegir herramienta y presupuesto después. La consulta de historial falla cerrada si auditoría no está disponible. Establecer límites de cuerpo, paginación y rate limiting por identidad/contexto, con umbrales por medir.

CI y Tests disparan en push main/feature y PR a main. Security usa npm audit en push main, PR y manual; no cubre automáticamente cada push de rama. No se evidencia un paso explícito de deploy en esos YAML: la integración Vercel es independiente. Añadir pruebas reales en QA con otra convención, secretos mínimos y aprobación; nunca convertir fixtures en evidencia de RLS real.

Referencias: [changelog](https://supabase.com/changelog), [MFA](https://supabase.com/docs/guides/auth/auth-mfa). [Diagramas físicos, despliegue y CI/CD](DIAGRAMAS.md).
