# Desarrollo independiente de DentaIA

## Preparación común

Esta base agrega conexión y espacios de trabajo. No completa los cuatro avances ni sustituye el MVP de `/`.
Los módulos empiezan como pantallas pendientes; cada integrante programa y demuestra su propia funcionalidad.

1. Instalar Node.js 22 LTS (mínimo 22.9; `nvm use` si se utiliza nvm) y Git.
2. Fusionar el PR de preparación en `main` antes de crear las cuatro ramas.
3. Cada integrante clona el repositorio, actualiza `main` y copia su SHA con `git rev-parse HEAD`.
   Los cuatro deben usar ese mismo SHA como punto de partida.

```bash
git clone https://github.com/Jhanfranco07/DentaIA.git
cd DentaIA
git switch main
git pull --ff-only origin main
cp .env.example .env.local
npm ci
npm run check:supabase
npm run dev
```

En PowerShell: `Copy-Item .env.example .env.local`. Abrir http://localhost:3000/desarrollo/acceso.
El SDK se usa desde componentes cliente y eventos/efectos; no crear el cliente durante un render en servidor.
Es autenticación cliente con autorización real mediante RLS, no una implementación SSR con cookies.
No usar el estado del navegador para autorizar endpoints de servidor futuros.

La URL y clave de `.env.example` son públicas y corresponden al proyecto académico ya creado.
No añadir contraseñas PostgreSQL, claves secretas ni service_role al frontend.
Los comandos de build funcionan sin `.env.local`; la falta de variables se informa al usar la conexión.

## Cuentas de prueba: una vez, solo el propietario

Las cuentas NO se crean copiando el repositorio. El acceso de prueba no registra usuarios ni envía correos.
La integración de Supabase permite SQL pero no incluye una operación administrativa de creación de usuarios Auth.
Por eso se incluye un script local que usa la API oficial de Auth y evita modificar directamente `auth.users`.

En Supabase > Settings > API Keys, el propietario obtiene una **secret key** (o la service_role heredada).
Crear `.env.admin.local` con `SUPABASE_SECRET_KEY=...`. Es un archivo ignorado por Git; no entregarlo al equipo.

```bash
npm run setup:test-users
```

Se crean jhan.dev, angie.dev, anelis.dev y stephan.dev bajo el dominio reservado `dentaia.test`,
con email confirmado y contraseñas aleatorias distintas. Son identidades de prueba, no correos reales.
Las credenciales se guardan en `.env.test-accounts.local`, también ignorado; entregar a cada integrante solo su par.
Eliminar `.env.admin.local` al terminar. El script nunca cambia cuentas existentes ni sobrescribe el archivo de salida.
Si hubo un fallo parcial, conservar las credenciales ya generadas y completar las cuentas faltantes desde
Authentication > Users > Add user. También se pueden crear las cuatro cuentas directamente desde ese panel,
marcando la confirmación del correo, sin ejecutar el script.

Cada persona ingresa en `/desarrollo/acceso` con su cuenta. La sesión persiste en ese navegador y permite
usar su módulo sin esperar el login final. Para probar aislamiento, usar dos perfiles de navegador distintos.
La ruta devuelve 404 en `npm run build && npm start`; no es el acceso de producción.

## Archivos y ramas exclusivos

| Integrante | Rama | Ruta | Archivos que puede editar |
| --- | --- | --- | --- |
| Jhan | `feature/jhan-cuenta` | `/cuenta` | `src/app/(modulos)/cuenta/**`, `src/features/cuenta/**` |
| Angie | `feature/angie-directorio` | `/directorio` | `src/app/(modulos)/directorio/**`, `src/features/directorio/**` |
| Anelis | `feature/anelis-solicitudes` | `/solicitudes` | `src/app/(modulos)/solicitudes/**`, `src/features/solicitudes/**` |
| Stephan | `feature/stephan-fotografias` | `/fotografias` | `src/app/(modulos)/fotografias/**`, `src/features/fotografias/**` |

Las carpetas `src/features` se crean al implementar cada avance. Cada módulo usa su propio CSS Module.
Ejemplo después de actualizar main: `git switch -c feature/angie-directorio`.
No crear ramas desde la rama de otro integrante. No editar `src/app/page.tsx`, layout global, globals.css,
package.json, lockfile o cliente compartido para estos avances. No importar código de otro módulo.
La navegación entre las cuatro rutas ya está preparada en el layout del grupo.

## Contrato real de datos y operaciones

Importar `getSupabaseBrowserClient` de `@/lib/supabase/browser`; los tipos se generaron desde la BD
en `src/lib/supabase/database.types.ts`. No escribir IDs de odontólogos manualmente: consultarlos.
El SDK genera tipos de Update para todas las columnas, pero los permisos SQL solo permiten las indicadas abajo.

### Jhan: cuenta y perfil

- Implementar registro con `auth.signUp`, login con `auth.signInWithPassword` y cierre con `auth.signOut`.
- El registro normal puede exigir confirmación por correo según la configuración de Auth. No desactivarla
  ni cambiar los proveedores del proyecto sin coordinar. Las cuentas de desarrollo ya confirmadas evitan ese bloqueo.
- Consultar el usuario con `auth.getUser()`. Crear `profiles` con `{ id: user.id, full_name }` después de iniciar sesión;
  validar nombre de 2–120 caracteres. Leer el perfil propio y actualizar únicamente `full_name`.
- La pantalla de prueba ya inicia sesiones; el avance individual consiste en el flujo del producto, validaciones,
  perfil persistente y estados de acceso. No presentar la herramienta común como trabajo individual.

### Angie: directorio

```ts
const client = getSupabaseBrowserClient();
const { data, error } = await client.from("dentists")
  .select("*").eq("is_active", true).order("name");
```

Mostrar datos reales de la BD, buscar por nombre/especialidad y filtrar por distrito. Puede filtrar localmente
los cuatro registros consultados. Implementar carga, error, lista vacía y detalle del perfil.
No necesita sesión ni la pantalla de solicitudes. Todos los perfiles y precios siguen siendo ficticios.
Usar `Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" })` para los precios numéricos.

### Anelis: solicitudes

Consultar `dentists` directamente desde su módulo para poblar un select; no importar el componente de Angie.
Con una sesión de prueba, insertar en `appointment_requests`:

```ts
const { error } = await client.from("appointment_requests").insert({
  dentist_id: selectedDentistId,
  contact_name: name,
  contact_email: email,
  preferred_date: date, // YYYY-MM-DD, hoy o posterior
  preferred_time: time || null,
  message, // opcional, máximo 1000 caracteres
});
```

`client` es la instancia compartida; las variables del ejemplo provienen del formulario que implementará Anelis.
El servidor asigna `user_id`, `status='requested'` e `is_demo=true`. Consultar la lista propia con select y orden
por `created_at`; RLS filtra los registros. Cancelar con `.update({status: "cancelled"}).eq("id", requestId)`.
Solo se permite actualizar `status`. No hay agenda real, confirmación clínica, correos ni edición de datos ajenos.
Los únicos estados de esta entrega son `requested` y `cancelled`.

### Stephan: consentimiento y fotografías

1. Usar solo imágenes sintéticas/de prueba. Cambiar el texto de su módulo: almacenar una foto en Supabase es
   distinto de la vista previa local del MVP; explicar destino, finalidad y eliminación antes de aceptar.
2. Validar tipo JPG/PNG/WebP, tamaño 1–8,388,608 bytes y decodificación. Solicitar consentimiento explícito.
3. Insertar `patient_consents` con `policy_version` y el texto efectivamente aceptado en `consent_text`
   (20–5000 caracteres); recuperar `id` con `.select("id").single()`.
4. Ruta obligatoria del archivo: `user.id/consent.id/UUID.extension`. Bucket `dental-photos`, privado.
   Usar `storage.from("dental-photos").upload(path, file, {upsert: false, contentType: file.type})`.
   Las subidas requieren consentimiento vigente; no se permite reemplazar objetos.
5. Registrar `dental_photos`: `consent_id`, `object_path`, `original_filename`, `mime_type`, `size_bytes`.
   Si falla el registro después de subir, eliminar el archivo con Storage API y mostrar el error.
6. Consultar fotos propias; descargar con Storage API y usar una URL temporal local, revocándola al terminar.
7. Eliminar primero el archivo con `storage.from("dental-photos").remove([path])` y después los metadatos.
   Si falla una fase, informar y permitir reintentar. Borrar una fila NO borra el archivo automáticamente.
8. Revocar con `patient_consents.update({revoked_at: new Date().toISOString()}).eq("id", consentId)`.
   La revocación bloquea nuevas cargas; el propietario conserva acceso para consultar/eliminar archivos previos.
   Si la UI ofrece “revocar y eliminar”, debe ejecutar ambas operaciones y mostrar si alguna falla.

No guardar URLs públicas, no subir sin consentimiento, no añadir IA ni entrenamiento.
No depende del login de Jhan, ni de solicitudes o directorio.

## Pruebas y entrega

```bash
npm run check:supabase
npm run typecheck
npm run build
```

`check:supabase` hace consultas reales al directorio y verifica que un visitante no reciba datos privados.
Para probar Auth, cada integrante puede agregar SOLO sus credenciales a `.env.local` como
`DENTAIA_TEST_EMAIL` y `DENTAIA_TEST_PASSWORD` (sin prefijo NEXT_PUBLIC_) y repetir el comando.
No es una prueba completa de las cuatro funcionalidades; cada PR debe probar su operación real y casos de error.

- Jhan: cuenta, sesión, perfil tras recarga, validaciones y acceso sin sesión.
- Angie: consulta remota, búsqueda, filtro, detalle, vacío y error de conexión.
- Anelis: alta real, recarga, cancelación y otra cuenta sin acceso a la solicitud.
- Stephan: consentimiento, subida privada real, recarga, eliminación y archivo inválido.

Commits propios y en español; incluir código funcional y evidencia del caso correcto y del error.
Un PR por integrante. Los cuatro pueden demostrarse individualmente antes de integrar las demás ramas.
Orden de integración flexible porque las carpetas son distintas; después de cada merge comprobar las cuatro rutas.
No modificar Jira ni fechas/sprints por preparar esta base.
