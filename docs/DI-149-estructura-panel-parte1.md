# DI-149 — Estructura del panel administrativo, parte 1

- Historia: DI-144 — Superusuario y panel administrativo.
- Responsable: Jhan.
- Fecha de trabajo: 30/10/2026.
- Rama: `feature/superusuario-admin`.
- Estado: primera parte visual implementada; DI-149 continúa pendiente de completar y revisar.
- Referencia: [DI-148 — Matriz de roles y permisos](DI-148-matriz-roles-permisos.md).

## Alcance del primer día

Estructura de presentación para el futuro panel: layout, menú lateral, encabezado, inicio y espacios para usuarios y roles. Se conservan Next.js App Router, React, TypeScript y CSS Modules. Se reutilizan `Icono` de `src/components/Identidad.tsx`, variables de color, tipografía y foco del estilo global. No se añadieron dependencias, APIs, modelos o políticas.

No se encontraron criterios adicionales de DI-149 en archivos locales. Se utiliza el alcance solicitado para esta primera parte, sin consultar ni modificar Jira.

## Componentes y responsabilidades

Todos los componentes de presentación pertenecen a `src/features/administracion/`:

| Archivo | Responsabilidad |
| --- | --- |
| `estructura.ts` | Identificadores y descripciones de secciones; contrato tipado de navegación, sin permisos efectivos. |
| `LayoutAdministrativo.tsx` | Composición del menú lateral, encabezado y contenido; no reemplaza el layout global ni crea otro elemento `main`. |
| `NavegacionAdministrativa.tsx` | Botones Inicio, Usuarios y Roles y permisos; identifica la selección con `aria-pressed`. |
| `EncabezadoAdministrativo.tsx` | Sección actual e indicador de vista de diseño; no representa una identidad autenticada. |
| `TarjetaAdministrativa.tsx` | Tarjeta reutilizable con icono, explicación y acción de navegación local. |
| `PanelAdministrativoDemo.tsx` | Entrada cliente de la demostración, estado en memoria, foco del título, dashboard y contenido de usuarios/roles. |
| `administracion.module.css` | Estilos encapsulados, alineados con DentaIA; base fluida para no bloquear la vista móvil. |

La ruta de desarrollo se incorpora en `src/app/desarrollo/panel-admin/page.tsx`.

La navegación cambia únicamente la sección de presentación en memoria. No son rutas administrativas reales ni existe persistencia de selección. Las tarjetas abren las mismas secciones que el menú; no tienen acciones vacías que aparenten gestionar cuentas.

Usuarios muestra columnas previstas y una explicación de que no se consultaron registros. No es un listado de usuarios ficticios ni una respuesta vacía de la base de datos. Roles muestra una referencia de los cuatro perfiles de DI-148 y distingue las capacidades existentes de los roles autenticados pendientes. No asigna permisos a la sesión actual.

## Visualización y límite de producción

Con el servidor de desarrollo:

```powershell
npm run dev
```

Abrir `http://localhost:3000/desarrollo/panel-admin`. Para un puerto alternativo se puede ejecutar `npm run dev -- --hostname 127.0.0.1 --port 3020` y abrir `http://127.0.0.1:3020/desarrollo/panel-admin`.

La página comprueba en servidor `process.env.NODE_ENV !== "development"` y llama a `notFound()` antes de importar o representar el panel. Usa `force-dynamic` y metadatos `noindex`. Se sigue el patrón de la herramienta existente `src/app/desarrollo/acceso/page.tsx`.

**Esta restricción de entorno no es autorización administrativa.** El modo producción, incluido un Preview construido como producción, no habilita la vista. No existe `/admin` ni `/api/admin` en esta entrega. La vista tampoco se añade al encabezado público. No se debe quitar este límite para publicar el diseño mientras no exista la autorización correspondiente de DI-150.

No se importa ningún cliente Supabase, servicio de autenticación ni fuente de datos en el módulo administrativo. No hay formularios, invitaciones, asignaciones de rol, cambios de cuenta, métricas inventadas, usuarios de ejemplo o acceso a datos clínicos. El aviso de diseño permanece visible y el superusuario no recibe permisos clínicos implícitos.

## Verificación ejecutada

| Comprobación | Resultado y alcance |
| --- | --- |
| Rama y estado inicial | Rama correcta y árbol limpio antes de comenzar. |
| `npm run typecheck` | Aprobado. |
| `npm run build` | Aprobado con Next.js 15.5.28; incluye la ruta dinámica de desarrollo. Que aparezca en el build no significa que sea accesible en producción. |
| Lint independiente | No hay script `lint` en `package.json`; no se instaló un ejecutor nuevo. |
| Pruebas existentes de Node.js | 89 aprobadas, 0 fallidas, 0 omitidas: `node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"`. |
| Restricción en producción local | `next start`: `/desarrollo/panel-admin`, `?demo=1` y `?seccion=usuarios` responden 404 y no representan el dashboard. `/admin` y `/api/admin` también responden 404. |
| Rutas existentes en producción local | `/`, `/cuenta`, `/directorio`, `/solicitudes` y `/fotografias` responden HTTP 200 al solicitar HTML. No equivale a repetir operaciones privadas contra Supabase. |
| Desarrollo, navegador Chrome aislado | Vista HTTP 200; navegación entre tres secciones mediante menú, tarjetas y teclado; selección visible y foco del título. Un solo `main` y un solo `h1`. |
| Aislamiento de datos durante el recorrido | 0 peticiones a Supabase, 0 formularios de gestión, 0 errores de ejecución de React. No se usaron cuentas ni credenciales. |
| Presentación | Capturas de Inicio, Usuarios y Roles en 1440 px inspeccionadas; comprobación básica de Inicio y Roles en 390 px sin desbordamiento horizontal. Responsive completo pendiente. |

Las comprobaciones de navegador se realizaron con herramientas ya disponibles en el entorno de QA, sin incorporar Playwright al proyecto ni cambiar sus workflows. Se corrigió una coincidencia ambigua de texto en el arnés de QA; no era un fallo de la aplicación. La disponibilidad de los servidores temporales se resolvió mediante una sesión de terminal propia, sin detener procesos ajenos.

No se realizaron pruebas de autenticación administrativa, permisos RLS o acceso a cuentas reales: estas funciones no se implementan en DI-149. La suite existente y los checks de HTML aportan evidencia de compatibilidad, pero no certifican nuevamente todos los flujos privados del equipo.

## Continuación prevista para la parte 2

1. Completar el comportamiento responsive del menú y la densidad del contenido para tablet y móvil. La base actual apila los bloques; aún no ofrece un menú administrativo plegable.
2. Definir e incorporar estados visuales de carga, vacío y error como componentes de presentación, con mensajes y accesibilidad. La explicación estática de usuarios no sustituye esos estados.
3. Revisar navegación y foco al volver al contenido, selección, comportamiento del menú móvil y tamaños de controles.
4. Realizar revisión visual más amplia en escritorio, tablet y móvil, incluido contraste y navegación por teclado.
5. Evaluar si las vistas Inicio, Usuarios y Roles deben separarse en componentes adicionales cuando aumente su contenido; conservar el contrato de secciones para evitar duplicación.

DI-150 incorporará la autenticación y autorización por una entrega separada. La gestión real de usuarios y roles, otros trabajos DI-151/DI-152, el modelo clínico y las políticas de datos permanecen fuera de esta parte. No se considera finalizada DI-149 con esta primera versión.

## Mensaje de commit propuesto

```text
DI-149 feat(admin): crear estructura visual inicial del panel
```

El commit no se crea en esta entrega: los archivos quedan pendientes de revisión del usuario, sin staging, push ni Pull Request.
