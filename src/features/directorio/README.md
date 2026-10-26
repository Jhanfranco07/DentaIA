# Directorio — Angie

Ruta `/directorio`. Primera ronda **integrada mediante PR #2**: https://github.com/Jhanfranco07/DentaIA/pull/2. Ya existe listado desde Supabase, búsqueda por nombre/especialidad, filtro por distrito, detalle y estados de error/vacío. **No volver a implementar lo mismo.** Los odontólogos y precios son ficticios.

## Próxima ronda — propuesta pequeña e independiente

- **DI-26 — Priorizar e implementar mejoras de interfaz (Sprint 5, 27/10–09/11):** ordenar mejoras basadas en observaciones verificables, aplicar una mejora visible al directorio y comparar antes/después. **DI-92:** gravedad, frecuencia, esfuerzo y responsable. **DI-93:** documentar comparativa y justificación; Figma si corresponde. Sin usuarios reales, hablar de *mejora propuesta*, no de «feedback de pacientes».
- **DI-27 — Corregir fallos funcionales (Sprint 5):** comprobar y arreglar un error reproducible de teclado, navegación, filtros o errores; **DI-94:** revisar teclado y móvil; **DI-95:** commits en español, build y evidencia.
- **DI-115 (Sprint 6):** adaptación móvil y accesibilidad (etiquetas, contraste, foco de teclado) si ese es el trabajo elegido.

Implementación sugerida: seleccionar **una** mejora concreta de usabilidad/responsive o un error de filtros comprobado. No modificar la API de solicitudes ni otros módulos.

## Pruebas y entrega

Añadir pruebas de utilidades y filtrado con datos ficticios sin red en `src/features/directorio/*.test.mjs`. Ejecutar `npm run typecheck`, `npm run build` y revisar CI, Security y Tests en el PR. Para casos con Supabase, probar separadamente y describir resultados reales.

Comenzar desde `main` actualizada, crear una rama nueva como `feature/angie-directorio-mejoras`. Editar solo `src/app/(modulos)/directorio/**` y `src/features/directorio/**`. Commits propios, un PR sin fusionarlo automáticamente. No cambiar estados Jira sin evidencia.

Guía general: [docs/DESARROLLO.md](../../../docs/DESARROLLO.md).
