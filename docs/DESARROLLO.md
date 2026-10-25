# Desarrollo independiente de DentaIA

## Empezar aquí: guía para el equipo

La base común ya está fusionada en `main`. Cada integrante debe leer esta guía, preparar su entorno
y desarrollar únicamente su módulo. No necesita esperar a que los demás terminen.

| Integrante | Avance funcional | Dónde programar |
| --- | --- | --- |
| Jhan | Registro, login, cierre de sesión y perfil persistente | `src/app/(modulos)/cuenta/` |
| Angie | Directorio desde BD, búsqueda, filtros y detalle | `src/app/(modulos)/directorio/` |
| Anelis | Registrar, listar y cancelar solicitudes de demostración | `src/app/(modulos)/solicitudes/` |
| Stephan | Consentimiento, carga privada, consulta y eliminación de fotografías | `src/app/(modulos)/fotografias/` |

Más abajo, **Contrato real de datos y operaciones** contiene las instrucciones de cada integrante.
Las pantallas son puntos de partida: el avance funcional debe programarlo cada persona con sus propios commits.

## Preparación común

Esta base agrega conexión y espacios de trabajo. No completa los cuatro avances ni sustituye el MVP de `/`.
Los módulos empiezan como pantallas pendientes; cada integrante programa y demuestra su propia funcionalidad.

1. Instalar Node.js 22 LTS (mínimo 22.9; `nvm use` si se utiliza nvm) y Git.
2. La preparación ya está fusionada en `main`; actualizar esa rama antes de crear la rama individual.
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

## Acceso compartido de prueba

La cuenta `jhan.dev@dentaia.test` ya existe y tiene el correo confirmado.
Los cuatro integrantes pueden utilizarla desde sus propias computadoras.

- **Correo:** `jhan.dev@dentaia.test`.
- **Contraseña:** solicitarla a Jhan por un canal privado. No se publica en este repositorio público.
- **Dónde ingresar:** http://localhost:3000/desarrollo/acceso, después de ejecutar `npm run dev`.
- Cada integrante usa su propia cuenta de GitHub para sus ramas, commits y Pull Requests.

No es una cuenta administradora de Supabase; es un usuario de prueba de la aplicación.
No necesitan la contraseña PostgreSQL ni una clave secret/service_role para desarrollar.

### Pasos para usarla

1. Preparar el entorno con los comandos anteriores y abrir la dirección local.
2. Iniciar sesión con la cuenta compartida y la contraseña recibida por privado.
3. Usar los enlaces para entrar a su módulo; la sesión persiste en ese navegador.
4. Implementar y probar su funcionalidad sin importar código de las otras tres ramas.

El acceso de prueba no registra usuarios ni envía correos. Devuelve 404 en `npm run build && npm start`;
no es el login final de producción que implementará Jhan.

### Datos compartidos

Todos usan el mismo usuario: verán las mismas solicitudes, fotografías y perfil.
Identificar los registros de prueba con el nombre del integrante y no eliminar registros de otro.
Usar únicamente datos ficticios e imágenes de prueba. Un cambio del perfil compartido afecta a todos.

Esto permite comenzar los cuatro avances, pero no comprobar aislamiento entre personas:
para esa prueba posterior se necesita una segunda cuenta diferente y dos perfiles de navegador.

### Crear cuentas adicionales después (opcional, solo el propietario)

No es necesario crear cuatro cuentas para comenzar. Si luego se necesitan cuentas individuales,
el propietario puede crearlas desde Authentication > Users > Add user > Create new user,
marcando Auto confirm user, o usar `npm run setup:test-users`.

El script requiere `SUPABASE_SECRET_KEY` en `.env.admin.local`, un archivo ignorado por Git.
Nunca entregar esa clave al equipo. El script crea únicamente cuentas nuevas, no modifica la contraseña
de la cuenta compartida existente, y guarda las credenciales nuevas en `.env.test-accounts.local`.
Como Jhan ya tiene una cuenta creada, el script informará que esa cuenta no se creó de nuevo;
conservar las credenciales originales y revisar los resultados antes de repetirlo.

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
  ni cambiar los proveedores del proyecto sin coordinar. La cuenta compartida ya confirmada evita ese bloqueo para las pruebas de acceso.
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
Para probar Auth, cada integrante puede agregar las credenciales de prueba recibidas por privado a `.env.local` como
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
