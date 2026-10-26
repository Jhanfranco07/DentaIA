# Fotografías — Stephan

Ruta `/fotografias`, rama inicial `feature/stephan-fotografias`. **Antes de avanzar, completar y probar la primera ronda** según [guía general](../../../docs/DESARROLLO.md). Usar solo archivos sintéticos/de demostración, nunca fotografías clínicas reales.

## Primera ronda — entrega funcional

Solicitar consentimiento explícito y guardar `patient_consents` antes de cargar. Validar JPG/PNG/WebP, decodificación y tamaño de 1 a 8.388.608 bytes. Subir a bucket privado `dental-photos` en ruta `user.id/consent.id/UUID.extension` y registrar `dental_photos`; compensar si falla el registro. Listar fotos propias, descargar de manera privada y eliminar primero Storage y después metadatos. Permitir revocar consentimiento sin publicar URLs. No depender de la pantalla de Jhan ni de Angie/Anelis; usar sesión común existente.

## Próxima ronda — propuestas independientes

- **DI-27 — Corregir fallos funcionales del prototipo (Sprint 5, 27/10–09/11):** detectar y reparar error real de carga, recaptura, mensaje de error o eliminación. **DI-94:** revisar móvil, navegación y validaciones; **DI-95:** documentar fallo, commits y pruebas.
- **DI-26 — Priorizar e implementar mejoras de interfaz (Sprint 5):** si hay observaciones reales, aplicar y mostrar una mejora de la experiencia de consentimiento/carga; **DI-92/DI-93:** matriz de prioridades, evidencia y antes/después. No fingir sesiones de usabilidad.
- **DI-37 / DI-120–122 (Sprint 6):** subida privada/vista previa, consentimiento y eliminación, y captura en móviles. Verificar qué quedó terminado en primera ronda antes de añadir trabajo.

## Pruebas y PR

Pruebas `*.test.mjs` sin red para extensión/tamaño, consentimiento requerido, revocación y errores de flujo. Pruebas reales del bucket privado, permisos y eliminación por separado, con imágenes ficticias. Trabajar en carpeta exclusiva `src/app/(modulos)/fotografias/**` y `src/features/fotografias/**`, desde `main` actualizada, rama propia, commits en español y PR. Los pipelines CI/Security/Tests son compartidos.

Guía general: [docs/DESARROLLO.md](../../../docs/DESARROLLO.md).


## Entregables numerados de Stephan

- **Avance 1 — PENDIENTE DE CONFIRMAR:** consentimiento, carga/listado/eliminación privada de imágenes ficticias con Storage y RLS; presentar PR y demostración sin exponer fotografías.
- **Avance 2 — DI-27 / DI-94–95 (contribución técnica propuesta):** auditar y corregir defectos reales de archivo inválido, recaptura, permiso, navegación móvil y errores de eliminación. DI-26 solo si hay observación/priorización verdadera.
- **Avance 3 — DI-37 / DI-120–122 (colaboración propuesta; Jira asigna DI-37 a Jhan):** fortalecer captura segura, consentimiento/revocación, eliminación y pruebas en Android/iOS cuando haya dispositivo disponible. No subir datos de salud reales.
- **Avance 4 — apoyo a DI-42–43:** integración mínima de acceso protegido a imágenes de demostración y pruebas de regresión; **no** implementar interpretaciones diagnósticas o editar el módulo de Anelis sin coordinación.

En Jira, Stephan no figura aún como responsable formal de esas historias; coordinar la asignación antes de cambiar el responsable. Cada avance se entrega mediante PR separado con pruebas y evidencias. Ver [plan maestro](../../../docs/DESARROLLO.md).
