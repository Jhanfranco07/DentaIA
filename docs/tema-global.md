# Apariencia compartida

El selector Claro/Oscuro está disponible en la cabecera pública y en todos los
portales. Las rutas sin cabecera muestran un selector flotante. Una única
preferencia se conserva al navegar y se sincroniza entre pestañas.

- Primera visita: claro, independientemente del tema del dispositivo.
- Preferencia guardada: se respeta hasta que la persona cambie de modo.
- Compatibilidad: se recupera la elección explícita del antiguo selector del paciente.
- Si el almacenamiento está bloqueado: el selector funciona durante la sesión.
- Estilos oscuros locales para pacientes, profesionales, administración, acceso,
  cuenta, fotografías, demostración educativa, directorio y comparación de planes.
- No se aplican filtros de inversión a fotografías, ilustraciones ni teselas del mapa.

## Validación automática

- `npm run build`: correcto.
- `npm test`: 91 pruebas correctas, incluidas 7 de la preferencia de tema.
- `npm run test:profesional`: 65 pruebas correctas.

## Revisión visual pendiente en navegador

- En un perfil nuevo, confirmar que se abre el modo claro.
- Alternar el tema y navegar entre módulos; recargar y comprobar persistencia.
- Comprobar sincronización con otra pestaña.
- Revisar escritorio y móvil, incluyendo apertura del menú y foco de teclado.
- Revisar títulos, textos secundarios, formularios, estados, botones y enlaces
  en panel, Buenas prácticas, directorio/lista/detalle/mapa, fotografías,
  resultados, solicitudes, rutinas, cuenta, planes, profesional y administración.

Esta validación automática no acredita una auditoría visual ni de accesibilidad
completa. No se han realizado cambios en permisos, datos o procesos clínicos.
