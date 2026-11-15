# DI-115 — Verificación de accesibilidad y adaptación móvil

**Historia:** DI-35 · Sprint 6
**Responsable de la actividad:** Angie Jara
**Base comprobada:** `2c9c51f3a8b9d24ae543f6e5716f1cd131fa2784`
**Fecha de ejecución técnica:** 11 de noviembre de 2026
**Estado:** Listo en Jira, según confirmación de Angie. La cobertura de las pruebas se detalla abajo.

## Resumen de cobertura

| Criterio | Resultado documentado |
| --- | --- |
| Vista PC | Revisión manual del panel y del directorio en Windows, incluida una ventana de 390 × 618 px emulada. |
| Vista Android | Sin ejecución registrada en dispositivo físico. La revisión Responsive corresponde al navegador de escritorio. |
| Vista iOS | Angie confirmó que el acceso finalmente funcionó en Safari en un iPhone físico. El alcance confirmado es la apertura del sitio. |
| Contraste | Cinco pares de colores del CSS superaron 4,5:1 para texto normal. El cálculo cubre los pares indicados en este informe. |
| Etiquetas | Se revisó la asociación entre etiquetas y controles de búsqueda y filtros en el código. Queda pendiente la revisión del nombre accesible de enlaces repetidos. |
| Teclado | Se verificaron navegación a cuenta y directorio, apertura y cierre del menú, retorno del foco, limpieza de filtros y apertura y retorno de una ficha. |

## Resultados ejecutados sobre la base integrada

| Comprobación | Entorno o datos | Resultado |
| --- | --- | --- |
| Instalación reproducible | Linux, Node.js 24.22.1, lockfile de la base | `npm ci` terminó e instaló 66 paquetes. [Registro](evidencias/DI-115/install.log) |
| Tipos y compilación | Next.js 15.5.28, configuración pública sintética | `npm run typecheck` y `npm run build` terminaron correctamente. [Tipos](evidencias/DI-115/typecheck.log) · [Compilación](evidencias/DI-115/build.log) |
| Regresión automatizada | `node --experimental-strip-types --test --test-reporter=tap 'src/features/**/*.test.mjs'` | 454 aprobadas, 0 fallidas. Son las pruebas existentes del repositorio. [TAP](evidencias/DI-115/tests.tap) |
| Respuesta HTTP | Servidor de producción local. URL y clave pública de fixture. Sin sesión de paciente | `/panel`, `/directorio`, ficha con identificador sintético y `/privacidad` devolvieron HTTP 200. Se verificó la presencia de un enlace a privacidad en el HTML público del listado y de la ficha. El 200 solo comprueba que la ruta responde. [Resultado](evidencias/DI-115/http.json) |
| Navegador nuevo | Chromium 156.0.8078.79, Playwright en Linux | Bloqueado al iniciar Chromium por restricción de socket del proceso. La página no llegó a abrirse. [Registro](evidencias/DI-115/navegador.txt) |

### Contraste de texto calculado a partir del CSS

Para colores sólidos de sRGB se aplicó `(L clara + 0,05) / (L oscura + 0,05)`, con luminancia relativa de cada color. Se usó 4,5:1 como umbral de texto normal. Los pares se obtuvieron de `src/features/directorio/directorio.module.css` y de los tokens de `src/app/globals.css`. Ver [WCAG 2.2, criterio 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

| Elemento | Texto | Fondo | Relación | Resultado del par |
| --- | --- | --- | --- | --- |
| Botón de reintento | `#FFFFFF` | `#087F8C` | 4,75:1 | Supera el umbral |
| Enlaces «Ver perfil» y «Solicitar orientación» | `#06636E` | `#F2FAF9` | 6,57:1 | Supera el umbral |
| Etiqueta de filtro | `#35556B` | `#FFFFFF` | 7,89:1 | Supera el umbral |
| Aviso de perfiles ficticios | `#704D12` | `#FFF7E8` | 7,15:1 | Supera el umbral |
| Encabezado de aviso de error | `#8C3038` | `#FFF5F5` | 7,57:1 | Supera el umbral |

Estas mediciones cubren combinaciones seleccionadas. Quedan pendientes el estilo renderizado en todos los estados, el indicador de foco, el mapa y la revisión integral de contraste.

### Inspección de código

| Punto | Evidencia | Comprobación de navegador pendiente |
| --- | --- | --- |
| Etiquetas de filtros | `DirectorioLista.tsx` asocia búsqueda, distrito, especialidad, distancia y orden con `htmlFor` e `id`. | Confirmar los nombres en el árbol de accesibilidad y recorrer controles habilitados con Tab. |
| Acciones repetidas | Las tarjetas renderizan «Ver perfil» y «Solicitar orientación» para cada profesional. El JSX de ambos enlaces usa el mismo texto en todas las tarjetas, sin nombre adicional del profesional. | Comparar dos tarjetas en la lista de enlaces del lector de pantalla. Registrar el contexto disponible antes de decidir el ajuste. |
| Foco tras limpiar filtros | `limpiarFiltros` devuelve el foco al buscador con `busquedaRef.current?.focus()`. | El caso M1d confirma el retorno al buscador al activar «Limpiar filtros» con Enter. |
| Foco tras reintentar | El botón se elimina al entrar al estado de carga. El manejador actual cambia estado y contador de intento, sin seleccionar un destino de foco. | Simular un fallo, pulsar Enter en «Reintentar» y registrar el foco durante la carga y tras la recuperación. |
| Menú del paciente | `PortalShell.tsx` declara nombre, estado expandido y relación con la navegación. | Los casos M1b y M1c confirman el recorrido, el retorno del foco y la navegación al directorio. |
| Privacidad | El encabezado y pie públicos enlazan a `/privacidad`. La respuesta inicial de `/panel` sin sesión no contiene ese enlace. | Confirmar el camino a privacidad desde el panel con sesión y desde la navegación móvil. |

## Evidencia previa del equipo

- [Panel del paciente](ux-paciente/README.md). El equipo documentó cinco anchos, navegación móvil y una regresión con sesión y API sintéticas. El panel no cambió entre `8537a5a` y `2c9c51f`.
- [Directorio y mapa](ux-directorio/README.md). El equipo registró 13 casos aprobados con Playwright y datos interceptados. Incluye cinco anchos, teclado móvil, filtros, ausencia de datos y fallos de teselas.
- [DI-165](DI-165-pruebas-funcionales-vista-paciente.md). Pruebas históricas de la vista paciente, con el entorno y límites descritos en ese documento.

Los registros anteriores pertenecen a sus ejecuciones originales. Las comprobaciones automatizadas de esta entrega usaron una compilación local con configuración sintética. Los resultados manuales que siguen corresponden a la revisión local de Angie en Windows.

## Verificación manual del 11 de noviembre de 2026

**Entorno de escritorio:** Windows, servidor local de desarrollo en `localhost:3000` y modo Responsive de DevTools a 390 × 618 px emulados. Se probó la rama `feature/angie-di115-accesibilidad` después del commit documental `b4d40de`, sobre la base de aplicación `2c9c51f`.

| Caso | Recorrido | Resultado observado | Evidencia |
| --- | --- | --- | --- |
| M1a | `/panel` sin sesión. Revisar aviso y activar «Ir a Mi cuenta» con Tab y Enter. | El título, el aviso y el enlace se ven completos. Enter abre `/cuenta`. | Captura del modo Responsive y confirmación manual de Angie. |
| M1b | `/panel` con sesión. Llegar al menú con Tab, abrirlo con Enter y cerrarlo con Escape. | El menú abre y, al cerrarlo, el foco vuelve al botón. | Confirmación manual de Angie. |
| M1c | Desde `/panel`, llegar al enlace al directorio con Tab y pulsar Enter. | El foco es visible y el enlace abre `/directorio`. | Confirmación manual de Angie. |
| M1d | En `/directorio`, buscar `zzzz`, llegar a «Limpiar filtros» con Tab y pulsar Enter. | Se borra la búsqueda y el foco vuelve al buscador. | Confirmación manual de Angie. |
| M1e | En `/directorio`, llegar a «Ver perfil» con Tab y pulsar Enter. Revisar la ficha y activar «Volver al directorio». | «Ver perfil» muestra foco visible y abre la ficha correspondiente. La ficha se ve completa y el enlace de retorno abre el listado. | Confirmación manual de Angie. |
| M4 inicial | Safari en iPhone físico, conectado al mismo Wi-Fi que el PC. Intento de abrir `/directorio` mediante la dirección de red del servidor local. | La página no cargó en ese intento. El acceso funcionó posteriormente, según la confirmación registrada abajo. | Reporte de Angie. |

La emulación a 390 px se ejecutó en un navegador de escritorio. La captura y las confirmaciones documentan los pasos indicados. El desbordamiento horizontal no se midió por separado.

## Diagnóstico de acceso desde la red local

En la PC se inició el servidor en una ventana independiente con `npm run dev -- --hostname 0.0.0.0 --port 3000`. La petición `curl.exe --noproxy "*" -I --max-time 30 http://192.168.1.5:3000/directorio` devolvió `HTTP/1.1 200 OK` desde la propia PC. Después se volvió a intentar en Safari desde el iPhone y la página siguió sin cargar. Quedó confirmada la respuesta HTTP desde la PC. En el intento final, Angie confirmó que el sitio sí abrió en Safari en el iPhone. El resultado se registró a partir de su confirmación. Quedan sin registrar la fecha exacta de ese intento, la versión de iOS, el entorno utilizado y el resultado de recorrer el listado, el mapa, la ficha y el panel. La causa del fallo inicial sigue sin determinarse.

## Casos pendientes de verificación

| ID | Entorno | Recorrido | Evidencia por registrar |
| --- | --- | --- | --- |
| M1 restante | PC a 390 px emulados | Medir desbordamiento horizontal y revisar cortes en el panel con sesión. | Ancho, estado de sesión y resultado. |
| M2 | PC, 1440 px y zoom 200 % | Panel → directorio → ficha → privacidad. Revisar Tab/Shift+Tab, nombres accesibles y lectura a zoom. | Ruta, navegador, controles afectados y captura cuando aplique. |
| M3 | Android con Chrome | Abrir directorio y ficha. Usar búsqueda, distrito, Lista/Mapa y volver a Lista. Denegar geolocalización si se solicita. | Modelo, SO, navegador, ancho y resultado. |
| M4 | iOS con Safari | El acceso funcionó en el intento final. Queda por registrar el recorrido del listado, mapa, ficha y panel con sesión de prueba, cuando corresponda. | Modelo, SO, navegador y resultado. |
| M5 | PC con herramientas de red | Probar carga, vacío y error recuperable de directorio y ficha. Usar fixtures o una cuenta académica autorizada según el caso. Revisar mensajes, estado del foco y navegación. | Qué respuesta se simuló, texto mostrado y elemento activo tras recuperar. |
| M6 | PC con herramienta de accesibilidad | Inspeccionar dos tarjetas y comprobar contraste de texto y foco en panel, listado y ficha. | Nombre computado de cada enlace, colores y relación observada. |

Para cada ejecución, registrar `fecha | SHA | ruta | dispositivo/SO/navegador | ancho | fixture o entorno académico | pasos | esperado | observado | evidencia`. Estados sugeridos: aprobado, hallazgo, bloqueado y pendiente. Un resultado de navegador de escritorio a 390 px se registra como ancho emulado.

### Reproducción con los scripts del repositorio

En una terminal PowerShell de una copia local, configura valores sintéticos y deja abierto el servidor. Usa un entorno con las banderas de escritura y clínica desactivadas.

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://ux-fixtures.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fixture'
npm run build
npm run start -- --hostname 127.0.0.1 --port 3180
```

En otra terminal, con Playwright Python instalado fuera del repositorio y `$chrome` apuntando a un ejecutable de Chrome o Edge, ejecuta:

```powershell
python scripts/qa-ux-paciente.py --output "$env:TEMP\di115-panel" --browser "$chrome"
python scripts/qa-directorio-mapa.py --fase despues --output "$env:TEMP\di115-directorio" --browser "$chrome"
```

Revisa el JSON de cada recorrido antes de adjuntarlo. Angie marcó DI-115 como Listo en Jira. Los casos pendientes de esta tabla delimitan el alcance de la verificación documentada.

