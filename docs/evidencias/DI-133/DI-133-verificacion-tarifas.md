# DI-133 Verificación de tarifas del directorio

Historia DI-41 · Sprint 7 · Angie Jara
Fecha de verificación: 12 de noviembre de 2026.

## Implementación original

| Referencia | Aporte |
| --- | --- |
| [4ec87a0](https://github.com/Jhanfranco07/DentaIA/commit/4ec87a0) | Agregó el formateo del importe y la moneda. |
| [7fb8836](https://github.com/Jhanfranco07/DentaIA/commit/7fb8836) | Mostró el precio de consulta en el listado. |
| [10b8f6b](https://github.com/Jhanfranco07/DentaIA/commit/10b8f6b) | Mostró el precio en la ficha y lo identificó como ilustrativo para perfiles ficticios. |
| [0c091ea](https://github.com/Jhanfranco07/DentaIA/commit/0c091ea) | Agregó pruebas de formato de moneda y de importes no disponibles. |

Los primeros tres commits forman parte del [PR #2 del directorio](https://github.com/Jhanfranco07/DentaIA/pull/2).

## Verificación actual

| Comprobación | Resultado y evidencia |
| --- | --- |
| Perfil ficticio en escritorio | La ficha de demostración de Daniel Flores muestra «Perfil ficticio» y omite el importe. Su descripción identifica el carácter ilustrativo del dato. Resultado observado en la captura de la revisión manual de DI-131. |
| Regla de visualización | En la base revisada `1e91f63`, el listado y la ficha muestran el importe únicamente cuando el perfil no está marcado como ficticio. El código lee el importe y la moneda desde el registro del directorio. |
| Pruebas automatizadas | Se ejecutó `node --experimental-strip-types --test src/features/directorio/formato.test.mjs` en la copia de revisión basada en `1e91f63`. Pasaron 12 de 12 pruebas del archivo, incluidas las de soles, otra moneda e importes no disponibles. |

## Límite de la evidencia

En el repositorio revisado no se identificó una ficha de prueba con tarifa autorizada y fuente verificable. La condición de perfil no ficticio en la interfaz, por sí sola, no acredita la autorización ni la procedencia de la tarifa. Ese caso queda pendiente de verificación. Las pruebas de formato usan valores de prueba y no validan tarifas reales.
