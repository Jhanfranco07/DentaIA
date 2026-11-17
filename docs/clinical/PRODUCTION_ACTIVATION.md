# Habilitación clínica segura de Production

Esta corrección separa el modo académico de Preview del acceso clínico de Production.

## Qué cambia
- Production solo se habilita explícitamente para un despliegue de Vercel desde `main`, con `DENTAIA_CLINICAL_PRODUCTION_ENABLED=true`, `DENTAIA_CLINICAL_HTTP_ENABLED=true` y `DENTAIA_CLINICAL_TARGET=dentalia_production`.
- URL **HTTPS** y clave pública clínicas deben corresponder exactamente a la URL y clave pública que usa la aplicación para autenticar usuarios. No se permite `service_role`.
- Production deja de exigir las cinco cuentas sintéticas, pero **no omite** la verificación JWT, la asignación de roles en `app_metadata` ni los RPC y políticas RLS en Supabase.
- Host de la aplicación limitado al dominio oficial y a la URL propia del despliegue de Vercel; se rechaza origen cruzado.
- Preview continúa con su lista de cinco usuarios sintéticos y el marcador del dataset académico, sin alterar su modo de acceso.

## Variables que se deben configurar en Vercel / Production antes de habilitar

```dotenv
DENTAIA_CLINICAL_HTTP_ENABLED=true
DENTAIA_CLINICAL_PRODUCTION_ENABLED=true
DENTAIA_CLINICAL_TARGET=dentalia_production
DENTAIA_CLINICAL_SUPABASE_URL=<MISMA_URL_QUE_NEXT_PUBLIC_SUPABASE_URL>
DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY=<MISMA_CLAVE_QUE_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY>
DENTAIA_CLINICAL_CURSOR_SECRET=<SECRETO_ALEATORIO_BASE64URL_DE_32_BYTES_O_MAS>
```

No incluir secretos en GitHub, screenshots ni logs. Para generar el secreto de cursor localmente se puede usar `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`, introducirlo en el panel seguro de Vercel y **no imprimirlo en chats**.

## Validación obligatoria antes del merge y deploy
1. Suite de tests, TypeScript, build y controles de seguridad del PR.
2. Verificar el `/api/professional/me` con un odontólogo autorizado y otro usuario no autorizado. Se espera 200 solo cuando exista una asignación clínica válida; no se aceptan accesos cruzados.
3. Comprobar lista de clínicas, solicitudes, pacientes autorizados e historial, con revocación/expiración y comprobaciones de no acceso para otros profesionales.
4. Revisar `dentistId` del perfil devuelto por el RPC. **Mis servicios** aparece solo si el perfil profesional está vinculado a una ficha `dentists`.
5. Probar `dentist_services`: crear, editar, activar y leer desde una sesión odontológica permitida; denegar operaciones de otro usuario y respetar RLS.
6. Validar origen distinto, token inválido y configuración incompleta: denegación sin devolver datos.
7. Solo tras aprobar todo, fusionar y desplegar, y repetir las pruebas en Production con cuentas de demostración autorizadas, sin introducir datos médicos reales.

**Nota:** el entorno de Production podría compartir actualmente una base académica. Verificar que los usuarios y las membresías clínicas pertenecen realmente al proyecto de autenticación de Production. Esta corrección no crea membresías, no amplía políticas RLS, no migra datos clínicos y no autoriza ningún acceso médico por el simple hecho de tener rol odontólogo.
