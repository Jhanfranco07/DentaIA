# Avance 2 de Jhan — errores de formulario accesibles

Rama: `feature/jhan-avance2`, desde `main` (`f41a547`).
Contribución técnica a **DI-27 / DI-94–95**. No cierra esas historias ni todo el Sprint 5.
No proviene de sesiones con pacientes ni se presenta como investigación de usabilidad.

## Error reproducible antes de la corrección

1. Abrir `/cuenta` sin sesión.
2. Enviar el login vacío o con un correo inválido.
3. Aparece el mensaje, pero el foco permanece en el botón de envío.
4. Los inputs no tienen `aria-invalid` ni asociación con el error mediante `aria-describedby`.

Comprobación previa en navegador: foco en «Entrar a mi cuenta», y ambos atributos ausentes.
Un usuario de teclado debe regresar manualmente al campo; un lector de pantalla no encuentra
la relación entre el mensaje y el control que lo originó.

## Corrección

- Se identifica el primer campo inválido manteniendo las reglas de validación originales.
- Se enfoca ese control y se marca con `aria-invalid="true"`.
- `aria-describedby` enlaza el mensaje de error; se conserva la ayuda de contraseña y nombre.
- El borde y fondo refuerzan la señal, sin depender exclusivamente del color.
- Al editar el campo señalado se limpia su error; cambiar entre login/registro limpia el estado.
- El perfil aplica el mismo comportamiento al nombre inválido.
- Los errores remotos se mantienen como mensajes generales: no se atribuyen falsamente a un campo.
- No se añaden dependencias, se alteran permisos o se cambian operaciones de Supabase.

## Evidencia ejecutada localmente

| Caso | Antes | Después comprobado |
| --- | --- | --- |
| Error de login | Foco en envío, sin asociación | Foco en `email`, marcado inválido y descrito por `cuenta-error` |
| Registro con nombre de un carácter | Error general | Foco en `nombre`, marcado inválido |
| Contraseñas distintas | Error general | Foco en `confirmacion`, asociado a `cuenta-error` |
| Tab desde correo | — | Pasa al campo `password` |
| Nombre inválido en perfil autenticado | Error general | Foco en `full_name`, ayuda y `perfil-error` asociados |
| Corregir nombre | — | Se elimina la marca de error |
| Recargar perfil tras prueba inválida | — | Nombre guardado intacto; no se envió una actualización válida |

La sesión local disponible permitió comprobar el perfil sin solicitar ni guardar contraseñas.
Se cerró al terminar; no se modificaron nombres persistidos ni otros datos.
Se verificaron foco y atributos DOM, no se ejecutó una auditoría con NVDA/VoiceOver ni dispositivos móviles físicos.

## Regresión automatizada

```powershell
node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"
npm run typecheck
npm run build
npm audit
```

Cinco casos nuevos en `accesibilidad.test.mjs`: primer campo vacío, correo inválido,
orden de registro, mensaje sin contraseñas y formulario válido. Se suman a las nueve pruebas
existentes: **14 pruebas**. Los tests nuevos validan la selección del campo; el foco y los atributos
se comprobaron por separado en navegador. No confundirlos con una prueba automatizada de lector de pantalla.

Los pipelines comunes CI, Security y Tests se reutilizan sin modificaciones. La evidencia remota
y el enlace del Preview quedan en el PR. El despliegue de producción no se modifica desde esta rama.

## Pendientes del alcance mayor

El registro con envío y confirmación real por correo sigue pendiente y no es parte de esta corrección.
Las sesiones de usabilidad con participantes, las pruebas en dispositivos físicos y los entregables
académicos DI-30/DI-32 requieren su propia evidencia. No se alteraron estados ni fechas de Jira.
