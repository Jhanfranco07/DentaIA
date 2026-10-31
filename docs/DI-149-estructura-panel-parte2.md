# DI-149 — Estructura del panel administrativo, parte 2

- Historia: DI-144 — Superusuario y panel administrativo.
- Fecha de trabajo: 31/10/2026.
- Rama exclusiva: `feature/superusuario-admin`.
- Base revisada: `3576c13589169608f69f4b65c745e2c44f230b3e` y [parte 1](DI-149-estructura-panel-parte1.md).
- Estado: segunda parte implementada y verificada localmente; registro como commit independiente y publicación en `feature/superusuario-admin` autorizados por el usuario. Sin Pull Request ni merge a `main`.

## Cambios

Se conservan el layout, encabezado, navegación, tarjetas, contrato de secciones y estilos propios de DentaIA. No se añaden dependencias al proyecto.

- Escritorio: menú lateral permanente, tarjetas en dos columnas y contenido fluido. En escritorio estrecho se reduce el lateral y las tarjetas pasan a una columna.
- Tablet y móvil, hasta 800 px: menú plegable dentro del flujo de la página. El botón anuncia su estado mediante `aria-expanded` y referencia el lateral con `aria-controls`. El contenido oculto queda fuera del recorrido de teclado y del árbol de accesibilidad. Se utilizan botones de navegación normales, sin semántica de menú de aplicación ni trampa de foco.
- Elegir sección cierra el menú móvil y enfoca su título. Escape cierra el menú y devuelve el foco al botón. Al cambiar entre escritorio y móvil se conserva un destino de foco visible; CSS mantiene temporalmente visible el control enfocado hasta que el listener de `matchMedia` transfiere el foco.
- Enlace para saltar al contenido del panel, controles de al menos 44 px de altura, foco global visible, tabla con encabezados semánticos, títulos y texto adaptables. Se mantiene un único `main` y un único `h1`.
- Nuevo componente reutilizable `EstadoAdministrativo`: carga con indicador y esqueleto decorativo, vacío con explicación, error con mensaje y reintento opcional. Carga y vacío usan `role="status"`; error usa `role="alert"`. No se depende solo del color. El indicador respeta movimiento reducido.
- En Usuarios, un selector etiquetado permite revisar estructura, carga, vacío y error. El reintento cambia exclusivamente a carga simulada y enfoca el selector para evitar perder el foco al desaparecer el botón. La carga no termina automáticamente: se elige otro estado manualmente.

## Cómo revisar

Ejecutar `npm run dev` y abrir `/desarrollo/panel-admin`. Revisar Inicio, Usuarios y Roles y permisos con el menú y las tarjetas. En Usuarios utilizar “Previsualizar estado de la lista”. En móvil abrir el menú y probar Tab, Shift+Tab, Enter, Espacio y Escape; comprobar también el cambio de tamaño con foco en el menú y el salto al contenido.

Todos los estados son simulaciones de presentación, con aviso visible. No representan consultas ni resultados reales. Se preserva el límite de entorno en `src/app/desarrollo/panel-admin/page.tsx`: `force-dynamic`, `noindex` y `notFound()` fuera de desarrollo, antes de importar el panel. No se modifica esta ruta, la autenticación, Supabase, la matriz de permisos ni las rutas públicas. No se implementa DI-150 ni gestión real de usuarios o roles.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Aprobado. |
| `npm run build` | Aprobado con Next.js 15.5.28. |
| `node --experimental-strip-types --test --test-reporter=tap 'src/features/**/*.test.mjs'` | 89 pruebas aprobadas, 0 fallidas, 0 omitidas. |
| `git diff --check` | Sin errores de formato. |
| Lint | No existe script independiente en el repositorio. |
| Chromium aislado: Inicio, Usuarios y Roles | Sin desbordamiento horizontal a 320, 390, 600, 768, 800, 820, 1024 y 1440 px; selección y foco del título correctos. |
| Teclado | Apertura con Enter, recorrido con Tab, selección con Espacio, cierre con Escape y retorno al botón; salto al contenido, tarjetas y transferencia de foco al cambiar de breakpoint comprobados. |
| Estados y reintento | Carga, vacío y error visibles; reintento lleva a carga y enfoca el selector. Comprobación adicional a 320, 768 y 1440 px tras ajustar el foco responsive. |
| Accesibilidad automática, axe | 0 infracciones WCAG A/AA detectadas dentro del panel en carga, vacío y error; menú móvil abierto comprobado a 320 y 768 px. No equivale a una certificación ni a pruebas con lector de pantalla. |
| Movimiento reducido | Indicador de carga sin animación al emular `prefers-reduced-motion: reduce`. |
| Aislamiento | 0 peticiones a Supabase y 0 errores de ejecución de React durante los recorridos. |
| Producción local (`next start`) | `/desarrollo/panel-admin`, `?demo=1`, `?seccion=usuarios`, `/admin` y `/api/admin`: HTTP 404, sin representación del panel. |
| Compatibilidad de rutas existentes | `/`, `/cuenta`, `/directorio`, `/solicitudes` y `/fotografias`: HTTP 200 al solicitar HTML en producción local. No se probaron operaciones privadas. |

Se utilizaron Playwright, axe y Chromium como herramientas temporales de QA fuera del repositorio, sin incorporarlas a `package.json`, al lockfile o a los workflows. Se inspeccionaron capturas de escritorio y móvil. Durante QA se corrigió una pérdida real de foco al reducir la ventana; también se ajustaron la creación del contexto de axe y un selector ambiguo del arnés de pruebas. No se modificó la aplicación para resolver esos dos problemas del arnés.

La restricción de desarrollo sigue sin ser autorización administrativa: el panel real necesita DI-150 antes de habilitarse en producción. No se realizaron pruebas de sesión administrativa, permisos RLS ni datos clínicos porque permanecen fuera del alcance.

## Archivos de la entrega

- Modificados: `src/features/administracion/LayoutAdministrativo.tsx`, `src/features/administracion/PanelAdministrativoDemo.tsx`, `src/features/administracion/administracion.module.css`.
- Nuevos: `src/features/administracion/EstadoAdministrativo.tsx`, `docs/DI-149-estructura-panel-parte2.md`.

## Revalidación para registrar el avance

Antes de crear el commit se revisaron los cinco archivos de la entrega y el alcance del diff: exclusivamente DI-149, sin cambios en autenticación, DI-150, rutas, dependencias u otras funcionalidades. No se encontraron credenciales ni datos sensibles; no se incluyen archivos de entorno, temporales, capturas o herramientas de QA.

Se repitieron `npm run typecheck`, `npm run build` y la suite existente de Node.js: aprobados, con 89 pruebas correctas, 0 fallidas y 0 omitidas. Los resultados de navegador de la tabla anterior corresponden a la verificación de implementación; no se volvieron a ejecutar durante el registro. Se conserva el bloqueo de producción en la ruta de desarrollo.

Mensaje autorizado: `DI-149 feat(admin): completar diseño responsive y estados visuales`.
