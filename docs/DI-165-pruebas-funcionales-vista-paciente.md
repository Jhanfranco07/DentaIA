# DI-165 — Pruebas funcionales de la vista del paciente

- **Historia:** DI-146 — Vista del paciente
- **Subtarea:** DI-165 — Ejecutar pruebas funcionales de la vista del paciente
- **Responsable:** Angie Jara
- **Rama:** `feature/vista-paciente`
- **Commit de la lógica y pruebas automáticas del panel:** `4b01498`
- **Fecha de redacción:** 03/11/2026
- **Entorno:** Windows, navegador Chrome, servidor local `http://localhost:3000` (`npm run dev`), Supabase del proyecto académico, Node.js 22 (versión exacta por registrar).
- **Estado:** pruebas ejecutadas y registradas. Los límites y lo no ejecutado figuran en la sección 6 y no se cuentan como aprobados.

## 1. Alcance y reglas

Pruebas del panel `/panel` definido en DI-146, sin ampliar su alcance. Se distingue entre pruebas con datos simulados y pruebas contra servicios reales. Las capturas complementan los resultados y no los sustituyen. Lo bloqueado o no ejecutado figura como pendiente y no cuenta como aprobado.

## 2. Pruebas automáticas

Comando del workflow de pruebas aisladas (sin red ni credenciales):

```
node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"
```

| # | Qué se probó | Capa | Datos | Resultado |
|---|---|---|---|---|
| A1 | Pruebas existentes de cuenta, solicitudes, fotografías, navegación, directorio y análisis (89 pruebas) | Unitaria | Cliente simulado | 89 aprobadas, 0 fallidas, 0 omitidas |
| A2 | `src/features/panel/logica.test.mjs`: conteo de solicitudes y pendientes, y decisión de reporte o ausencia de reporte (9 pruebas) | Unitaria | Datos simulados | 9 aprobadas, 0 fallidas |
| A3 | Ejecución conjunta de todas las pruebas con las del panel incluidas | Unitaria | Simulados | 98 pruebas, 98 aprobadas, 0 fallidas, 0 omitidas (ejecutado tras el commit `4b01498`) |

Las advertencias `MODULE_TYPELESS_PACKAGE_JSON` de Node no son fallos.

Lo que cubre A2:
- Sin solicitudes devuelve ceros; solo el estado `requested` cuenta como pendiente; un estado desconocido no cuenta.
- Sin sesión de demostración, caso desconocido, etapa anterior a las recomendaciones o etapa desconocida: ausencia de reporte.
- Desde las recomendaciones: se devuelven las del caso, sin alterarlas, y el resultado no incluye datos de cuenta.

Límite: los componentes de React no tienen pruebas automáticas. No se definió ni se instaló un arnés de renderizado, y no se afirma que exista.

## 3. Comprobaciones complementarias

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Sin errores, verificado tras DI-164 y de nuevo tras el commit `4b01498` |
| `npm run build` | Compiló, pasó lint y tipos y generó 11 páginas, con `/panel` incluida (verificado antes del commit `4b01498`) |

El `typecheck` y el `build` no prueban comportamiento.

## 4. Pruebas manuales en navegador

Todas con servidor local, Supabase real para perfil, fotografías y solicitudes, y reporte de demostración simulado guardado en el navegador.

| # | Criterio de DI-146 | Escenario | Esperado | Resultado | Evidencia |
|---|---|---|---|---|---|
| M1 | 1 | Entrar a `/panel` sin sesión | Invitación a iniciar sesión, sin datos | Aprobada | Observación directa |
| M2 | 3 | Resumen con sesión | 1 fotografía, 3 solicitudes, 1 pendiente, iguales a `/fotografias` y `/solicitudes` | Aprobada | `panel-resumen.png` |
| M3 | 2 | Tab por las tres tarjetas | Cada enlace muestra foco visible | Aprobada | `panel-foco-tab.png` |
| M4 | 4 | Sin recorrido de demostración | Estado vacío con enlace al recorrido | Aprobada | Observación directa |
| M5 | 4 | Con recorrido completado (en `localhost`) | Caso, aviso «Resultado simulado para fines académicos» y 3 recomendaciones iguales a las del reporte | Aprobada | Texto de pantalla verificado |
| M6 | 5 | Cancelar una solicitud propia desde el panel | Pasa a «Cancelada» y persiste al recargar | Aprobada | Captura del aviso de confirmación |
| M7 | 6 | Error de red: bloquear `appointment_requests` | «No pudimos cargar tu resumen» con «Reintentar» y «No se pudieron cargar tus solicitudes», sin texto técnico | Aprobada | `panel-error-red.png` |
| M8 | 6 | Estado de carga con red lenta | Avisos «Comprobando tu sesión…», «Cargando tu resumen…» y «Cargando tus solicitudes…» | Aprobada | `panel-carga.png` |
| M9 | 3 y 4 | Cerrar sesión y recargar `/panel` | Sin datos privados visibles; invitación a iniciar sesión | Aprobada | `panel-sin-sesion.png` |
| M10 | Regresión | Tras `4b01498`: resumen y reporte siguen funcionando | Mismos resultados que M2, M4 y M5 | Aprobada: el resumen y el estado vacío del reporte funcionaron en M11 (con el código de `4b01498`). Reporte con recorrido completado tras `4b01498`: **por registrar** | Observación directa |
| M11 | 3 | Privacidad con dos cuentas sintéticas reales. Paciente Demo A en `localhost:3000` y Paciente Demo B en `127.0.0.1:3000` (sesiones independientes), ambas contra Supabase real. Se abrió `/panel` en cada una | A: 0 fotografías, 2 solicitudes, 1 pendiente. B: 0 fotografías, 1 solicitud, 1 pendiente. Ninguna cuenta ve datos de la otra | Aprobada: los valores coinciden con lo esperado y no hubo datos cruzados. En el historial, A vio sus 2 solicitudes (1 «Solicitada», 1 «Cancelada») y B vio su única solicitud | Texto de pantalla verificado |
| M12 | 3 | Misma comprobación en `/cuenta`, `/solicitudes` y `/fotografias` de cada cuenta | Cada cuenta ve solo su perfil, sus solicitudes y su galería | Aprobada: perfil, solicitudes y fotografías de A y B corresponden a su propietario | Texto de pantalla verificado |
| M13 | 6 | Teclado en `/panel` con sesión: Tab hasta el enlace del reporte y hasta el botón «Cancelar solicitud» (sin pulsar Enter) | Ambos muestran foco visible | Aprobada (según la ejecución de la integrante) | Observación directa |
| M14 | 6 | Adaptación móvil del panel completo a 375 px, con resumen, tarjetas, reporte y «Mis solicitudes» | Una sola columna, sin cortes ni desplazamiento lateral | Aprobada (según la ejecución de la integrante) | Observación directa |

Distinción: M1 a M3 y M6 a M9 usan Supabase real. M4 y M5 usan un reporte de demostración que vive solo en el navegador y no es historial clínico persistente.

## 5. Trazabilidad con los criterios de DI-146

| Criterio de DI-146 | Estado | Respaldo |
|---|---|---|
| 1. Con sesión accede al panel; sin sesión se exige autenticación con retorno interno validado | **Parcial.** Sin sesión se invita a iniciar sesión; no se valida un retorno interno hacia `/panel` | M1, M9 |
| 2. El panel enlaza perfil, fotografías y solicitudes sin duplicarlos | Cumplido | M3, M2 |
| 3. Solo muestra datos del paciente autenticado; cambiar un ID no da acceso a otra cuenta | **Cumplido en la interfaz con dos cuentas reales.** El panel muestra solo los datos de la cuenta autenticada (M11, M12) y las pruebas automáticas con cliente simulado verifican el filtro por usuario (A1). Cambiar un ID contra el backend real no se probó: la interfaz no ofrece un ID editable | M2, M9, M11, M12, A1 |
| 4. Reporte con advertencias; sin reporte, estado vacío y enlace | Cumplido | M4, M5, A2 |
| 5. El historial reutiliza solicitudes y cancelación; los reportes temporales no se presentan como historial clínico | Cumplido | M6 |
| 6. Se comprueban carga, error, vacío, teclado, móvil y aislamiento, distinguiendo simulación de backend real | **Cumplido en la interfaz.** Se comprobaron carga, error, vacío, teclado, móvil y aislamiento, distinguiendo Supabase real de datos simulados. Límites en la sección 6 | M3, M7, M8, M11, M13, M14 |

## 6. Pendientes y límites

No se ejecutaron o no se pueden afirmar:

1. **Aislamiento con dos cuentas sintéticas:** probado en la interfaz (M11, M12). Quedan fuera la manipulación de un ID o de un retorno contra el backend real y las pruebas de API o RLS directas, que no se ejecutaron. Las pruebas automáticas con cliente simulado no acreditan aislamiento real. La rama de backend clínico (`docs/auditoria-arquitectura-integral`, PR19 en borrador) no se integró: queda fuera del alcance de DI-146.
2. **Integración contra base de datos real mediante pruebas automatizadas:** no existe convención ni comando, y no se ejecutó.
3. **Teclado y móvil del panel completo:** probados (M13 y M14), sin captura nueva. La captura `panel-375.png` corresponde a la versión de DI-161, que solo tenía las tarjetas.
4. **Contraste de colores:** no se midió.
5. **Retorno interno validado hacia `/panel` tras iniciar sesión:** no implementado; `src/lib/navegacion.ts` solo valida retornos hacia `/solicitudes`.
6. **Componentes de React sin pruebas automáticas:** sin arnés de renderizado definido.
7. **La demostración solo se probó en `localhost`:** por la IP de la red local el navegador no habilita `crypto.subtle`.
8. **El contador de solicitudes pendientes no se actualiza al cancelar** hasta recargar, porque `MisSolicitudes` no avisa del cambio (módulo de otra integrante).
9. **Cierre de sesión:** se verificó el estado tras recargar; el comportamiento antes de recargar no se registró.

## 7. Cómo repetir las pruebas

```
npm run typecheck
npm run build
node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"
```

Para las pruebas manuales: `npm run dev`, abrir `http://localhost:3000/panel` y seguir la tabla de la sección 4. Usar datos ficticios y no modificar las solicitudes de la cuenta compartida.

## 8. Evidencias

Carpeta `docs/evidencias/panel/`: `panel-resumen.png`, `panel-foco-tab.png`, `panel-error-red.png`, `panel-carga.png`, `panel-sin-sesion.png`, `panel-375.png` y `panel-1440.png`.
