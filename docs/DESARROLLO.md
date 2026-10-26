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
| Jhan | `feature/jhan-auth` | `/cuenta` | `src/app/(modulos)/cuenta/**`, `src/features/cuenta/**` |
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


---

## Guía de siguientes rondas (propuesta, 26/10/2026)

**Leer antes de programar:** esta sección traduce las historias de Jira a tareas comprensibles. Es una **propuesta de próximos avances**, no una orden de completar todo en una noche, ni significa que esas historias estén cerradas o reasignadas en Jira.

**Estado de referencia:** la primera ronda de Angie (directorio, PR #2) y Jhan (cuenta, PR #5) está integrada en `main`. Anelis y Stephan todavía deben confirmar mediante sus propios PR la implementación de sus módulos. Antes de comenzar una segunda ronda, comprobar en GitHub qué se fusionó realmente, para no repetir trabajo.

### Qué significan los códigos de Jira

- **DI-25 — Ejecutar pruebas de usabilidad del prototipo (Sprint 5, 27/10–09/11):** planificar y realizar sesiones con participantes reales, observar dificultades y completar la cuadrícula de retroalimentación. **DI-89** prepara protocolo y escenarios; **DI-90** son sesiones reales; **DI-91** registra gustos, críticas, preguntas e ideas. No inventar participantes ni resultados.
- **DI-26 — Priorizar e implementar mejoras de interfaz (Sprint 5):** organizar hallazgos reales, priorizar mejoras y actualizar pantallas, demostrando *antes y después*. **DI-92** es una matriz por gravedad, frecuencia, esfuerzo y responsable; **DI-93** contempla Figma, capturas y justificación. **Una mejora de código sin feedback aún es mejora técnica propuesta; no afirmar que provino de pacientes.**
- **DI-27 — Corregir fallos funcionales del prototipo (Sprint 5):** corregir errores comprobados de navegación, formularios, fotografía local y adaptabilidad, validar la aplicación y registrar las pruebas. **DI-94** revisa teclado, móvil, validaciones, reporte ficticio y directorio; **DI-95** pide commits en español, build y evidencia del error resuelto.
- **DI-35 / DI-115 (Sprint 6):** experiencia web y comprobación de accesibilidad/adaptación móvil (PC/Android/iOS, contraste, etiquetas, teclado).
- **DI-36 / DI-119 (Sprint 6):** backend y persistencia segura; ejecutar pruebas reales de operaciones y permisos.
- **DI-37 / DI-120–122 (Sprint 6):** subir fotos de prueba de forma privada, consentimiento y eliminación, y probar captura móvil.
- **DI-41 / DI-131–133 (Sprint 7):** directorio y filtros; el directorio de Angie ya existe, así que verificar la cobertura existente antes de añadir trabajo.

### Orden de trabajo para todos

1. **Ronda 1 — módulo asignado:** completar y probar el módulo indicado arriba, con commits propios en su rama y PR independiente. El directorio de Angie y cuenta de Jhan ya están integrados; no rehacerlos.
2. **Ronda 2 — mejora pequeña e independiente:** seleccionar **un** problema real de su módulo, documentar cómo reproducirlo y corregirlo; o elegir una mejora de accesibilidad comprobable. Vincularla a DI-26 o DI-27 *según corresponda*, sin asumir que la historia global quedó completa.
3. **Ronda 3 — pruebas automatizadas:** añadir pruebas aisladas `*.test.mjs` en `src/features/<modulo>/` si pueden correr sin red ni claves. Se ejecutan mediante el workflow Tests ya fusionado. Las pruebas con Supabase real y credenciales se documentan aparte. No modificar los pipelines comunes sin coordinar.

### Propuestas por integrante (no reasignaciones de Jira)

| Integrante | Ronda 1 | Ronda 2: avance de código sugerido y autónomo | Ronda 3: pruebas sugeridas |
| --- | --- | --- | --- |
| **Jhan** | **Hecha**: registro/login, perfil y sesión en `/cuenta` (PR #5) | Revisar accesibilidad del formulario, navegación por teclado, indicadores de carga y mensajes seguros de error; corregir **un** problema reproducible (DI-27 / DI-94; DI-26 si surge de feedback) | Validaciones y lógica del perfil, estados de error y regresión; pruebas sin credenciales en `src/features/cuenta/` |
| **Angie** | **Hecha**: directorio con Supabase, búsqueda, distrito y detalle (PR #2) | Probar y mejorar uso móvil, foco de teclado, etiquetas y estado sin resultados **sin rehacer filtros existentes** (DI-26 / DI-115; DI-27 si corrige un error) | Normalización de búsqueda/filtros, formato y estados vacíos/errores con datos simulados |
| **Anelis** | **Por comprobar**: alta/listado/cancelación de solicitudes desde `/solicitudes` | Una vez funcional, mejorar validación de fecha y horas, errores y estados vacíos dentro de su módulo (DI-27 / DI-94) | Validación de campos, estados `requested/cancelled` con cliente simulado; permisos reales verificados por separado (DI-119 cuando corresponda) |
| **Stephan** | **Por comprobar**: consentimiento, foto privada, consulta y eliminación desde `/fotografias` | Una vez funcional, mejorar error de archivo inválido, recaptura/uso móvil y mensajes de eliminación (DI-27 / DI-94; DI-122 si se prueba móvil) | Tipo, tamaño, consentimiento, revocación y rutas de error simuladas; subir/eliminar realmente solo con archivos ficticios y credenciales de prueba |

### Trabajo paralelo sin bloqueos

- Cada ronda adicional **empieza desde `main` actualizada**, no desde una rama antigua de otro miembro. Si ya hay cambios locales, guardarlos e integrar con cuidado antes de avanzar.
- Cambiar solamente los directorios de su módulo; evitar `package.json`, `src/app/page.tsx`, estilos/layout globales, cliente Supabase y pipelines compartidos.
- No esperar el trabajo de otro módulo, no importar sus componentes ni crear contratos nuevos sin discutirlo. Usar registros ficticios y operaciones ya existentes.
- Hacer **un PR por mejora coherente** y commits representativos (funcionalidad, validación, pruebas); conservar autoría personal. Los pipelines CI, Security y Tests ya existen y se reutilizan.
- Adjuntar en el PR el código Jira apropiado, descripción del antes/después, pasos de prueba, capturas si aplican y resultados de Actions.
- El Sprint 5 **no está terminado**: además de código, DI-25 requiere sesiones reales; DI-26 exige priorización y evidencia; DI-27 requiere correcciones verificadas. DI-28–33 (mercado y modelo de negocio) siguen siendo trabajo académico distinto.
- No cambiar estados ni fechas de Jira solo por editar esta documentación. La asignación formal y el cierre se hacen cuando se verifiquen evidencias.

### Guías individuales

- [Jhan — cuenta](../src/features/cuenta/README.md)
- [Angie — directorio](../src/features/directorio/README.md)
- [Anelis — solicitudes](../src/features/solicitudes/README.md)
- [Stephan — fotografías](../src/features/fotografias/README.md)


---

## Plan maestro de entregables numerados (26/10/2026)

> **Esta sección sustituye la interpretación de “rondas” genéricas por una ruta de entregables.** Las rondas anteriores son orientativas; el plan de abajo define qué entregar y cuándo se considera revisable. No confundir fecha académica con fecha de commit ni cerrar una historia solo por tener un PR. Comprobar Jira y GitHub antes de marcar estados.

### Avance 1 — Base funcional (primera entrega)

**Meta:** contar con cuatro módulos iniciales navegables y comprobables de forma individual.

- **Jhan:** registro/inicio/cierre de sesión y perfil persistente (PR #5, fusionado).
- **Angie:** directorio de odontólogos, búsqueda/filtros/detalle (PR #2, fusionado).
- **Anelis:** solicitudes de demostración, listado propio y cancelación (pendiente de confirmar mediante su PR).
- **Stephan:** consentimiento y carga/consulta/eliminación privada de fotos ficticias (pendiente de confirmar mediante su PR).
- **Entrega:** PR por persona, commits propios, demo, casos de éxito/error y CI/Security/Tests. La funcionalidad integrada se relaciona con **DI-23** y partes de **DI-76–85**, **DI-81**; no significa que todas estén terminadas.
- **No empezar a llamar “Avance 2 terminado” si Avance 1 del integrante sigue abierto.** Se puede programar el siguiente avance en una rama nueva una vez su primera ronda esté integrada, sin esperar a otros compañeros.

### Avance 2 — Completar y validar el MVP (Sprint 4 y Sprint 5)

**Historias:** **DI-23** prototipo navegable; **DI-24** escenarios y métricas; **DI-25** pruebas de usabilidad reales; **DI-26** priorización y mejoras de interfaz; **DI-27** corrección de fallos. Evidencia por historia y subtarea, no solo por nombre del sprint.

| Responsable propuesto para código | Actividades comprobables | Entrega y evidencia |
| --- | --- | --- |
| **Jhan** | Probar navegación, errores de cuenta, foco de teclado, sesión y despliegue; corregir fallos reales (**DI-27, DI-94, DI-95**). | Commit/PR con error reproducible, corrección, capturas si procede y validación CI/Tests/Vercel. |
| **Angie** | Auditar pantallas del directorio en móvil/teclado; mejorar experiencia a partir de hallazgos, registrar comparación antes/después (**DI-26, DI-92, DI-93**). | Matriz de mejoras con prioridad y evidencia, capturas/prototipo y PR de interfaz. |
| **Anelis** | Preparar escenarios y métricas (**DI-24, DI-86–88**), protocolo de prueba (**DI-25, DI-89**), conducir sesiones reales (**DI-90**) y recopilar retroalimentación (**DI-91**). Puede corregir sus validaciones de solicitudes, sin atribuirlo a sesiones inexistentes. | Protocolo, registro anonimizado de observaciones reales, resultados y PR si hay corrección funcional. |
| **Stephan** | Auditar consentimiento, flujo de fotos, errores, recaptura y dispositivos; corregir defectos dentro de su módulo, como contribución técnica a **DI-27 / DI-94–95**. | Capturas de prueba con material ficticio, pasos para reproducir y PR de corrección. |

**Condición de cierre:** evidencia auténtica de pruebas de usuarios (sin inventarlas); mejoras priorizadas; errores resueltos o documentados; criterios DI-23–27 revisados. La participación de Stephan aquí es una **propuesta técnica**, no una reasignación de historias en Jira.

**Trabajo académico paralelo del Sprint 5, no asumirlo resuelto por programar:**
- **DI-28 — Segmentar y seleccionar público objetivo:** estado Jira *Listo*; revisar evidencia existente.
- **DI-29 — Dimensionar TAM, SAM, SOM:** estado Jira *Listo*; revisar fuentes/cálculos.
- **DI-30 — Benchmarking y posicionamiento:** *En curso*, asignado Jhan.
- **DI-31 — Nueve bloques del Business Model Canvas:** *En curso*, asignado Anelis.
- **DI-32 — Viabilidad y flujo de caja:** *Por hacer*, asignado Jhan.
- **DI-33 — Coherencia del modelo de negocio:** *Por hacer*, asignado Angie.
Cada resultado requiere su propia evidencia académica (documento, tabla, fuentes, cálculos), no commits ficticios.

### Avance 3 — Consolidación técnica y exploración de IA (Sprint 6)

**Historias:** **DI-34** arquitectura/modelo; **DI-35** web de producción; **DI-36** backend/persistencia; **DI-37** fotos y consentimiento; **DI-38** datasets/anotación; **DI-39** calidad y privacidad fotográfica; **DI-40** evaluación exploratoria de visión por computadora.

| Integrante | Alcance propuesto de entrega | Evidencia mínima |
| --- | --- | --- |
| **Jhan** | **DI-34/DI-111–113:** diagrama lógico, entidades y contratos/privacidad; evaluar cobertura de CI/Auth. **DI-40:** experimento de IA *exploratorio* con datos aptos y métricas, sin afirmaciones diagnósticas. | Diagramas reproducibles, justificación técnica y protocolo/resultados del experimento si llega a ejecutarse. |
| **Angie** | **DI-35/DI-114–116:** modularización UI, accesibilidad/responsive e integración comprobada con servicios. **DI-38:** revisión documentada de datasets y protocolo de anotación, no inventar dataset etiquetado. | PR de interfaz, pruebas móvil/teclado, ficha de fuentes/licencias y protocolo. |
| **Anelis** | **DI-36/DI-117–119:** migraciones/persistencia, validación de operaciones y pruebas de permisos sobre el backend existente. **DI-39:** checklist y evaluación documentada de privacidad/calidad de imágenes de demostración. | PR de su módulo si aplica, pruebas reales de permisos y documentación reproducible sin secretos. |
| **Stephan** | Contribución técnica propuesta a **DI-37/DI-120–122**: completar subida segura, consentimiento/revocación, borrado y pruebas de cámara/recaptura en móvil. | PR de fotos y pruebas con imágenes sintéticas, evidencia de RLS/Storage sin exponer fotos privadas. |

**Condición de cierre:** frontend, backend, modelo y almacenamiento con pruebas; artefactos de arquitectura verificables; investigación de IA registrada como exploratoria, con límites y sin diagnóstico clínico. La propiedad formal de **DI-37** aparece actualmente asignada a Jhan; la implementación por Stephan se debe coordinar y regularizar en Jira si procede.

### Avance 4 — Integración y cierre de DentaIA (Sprint 7)

**Historias:** **DI-41** directorio y filtros (incluido trabajo ya realizado), **DI-42** reporte preventivo explicable, **DI-43** pruebas de usabilidad/seguridad/revisión odontológica, **DI-44** documentación y pitch, **DI-45** entrega técnica/retrospectiva.

| Integrante | Aporte planificado | Evidencia mínima |
| --- | --- | --- |
| **Jhan** | Integración y estabilización de flujos, evidencia GitHub Actions/Vercel; **DI-45** entrega técnica, retrospectiva y limitaciones. | Checklist final, demo estable, links PR/Actions y retrospectiva. |
| **Angie** | Revisar **DI-41** con lo ya construido, cerrar faltantes de perfiles/filtros/tarifas ficticias; **DI-44** documentos, pantallas, guion y pitch. | Pruebas directorio, capturas, documentación final y presentación. |
| **Anelis** | **DI-42** reporte **orientativo, explicable, no diagnóstico**, y conexión con directorio; **DI-43** evidencia de pruebas/seguridad y revisión por profesional **solo si realmente ocurrió**. | Función demostrativa real, evidencia de pruebas y límites explícitos; no inventar validación odontológica. |
| **Stephan** | Apoyar integración final de fotos privadas con el flujo preventivo, mensajes de consentimiento y pruebas de regresión dentro de su módulo. | PR de integración puntual, pruebas de protección de imágenes y demostración con archivos ficticios. |

**Condición de cierre:** demostración funcional sin promesas clínicas, documentación, pruebas, resultados y entrega académica verificables. Si alguna validación profesional no se realiza, dejar explícito el límite.

### Cómo entregar cada avance en GitHub

1. Actualizar `main` y crear rama del **avance correspondiente**: `feature/<nombre>-avance2`, `feature/<nombre>-avance3`, `feature/<nombre>-avance4`. No reutilizar ramas antiguas ni duplicar commits fusionados.
2. Seleccionar tareas de su fila **que todavía falten**. Los entregables académicos sin código pueden registrarse en documentos, no forzar commits.
3. Un PR por conjunto pequeño y coherente, con: **Avance N**, códigos Jira explicados, descripción, criterios de aceptación, capturas/resultados, pruebas y enlace al despliegue si corresponde.
4. No fusionar sin verificar CI, Security y Tests. Para `*.test.mjs`, solo pruebas sin red/secretos; Supabase real requiere pruebas controladas aparte.
5. Registrar evidencia y estado en Jira **solo después de revisar y verificar**; Sprint 5 y demás sprints no se declaran finalizados por crear esta planificación.

**Nota:** la organización por Avance 1–4 es una forma de entrega del equipo; no renombra ni cambia los siete sprints existentes del proyecto en Jira.
