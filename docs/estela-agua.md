# Estela de agua del mouse

Efecto decorativo en `PublicShell`, separado de la animación de entrada.
Un canvas transparente dibuja una estela líquida de tonos celestes mediante
WebGL, sin tomar capturas, desplazar elementos ni distorsionar textos o imágenes.

- `pointer-events: none`, sin elementos de formulario ni controles adicionales.
- Eventos de movimiento pasivos; no se cancela el desplazamiento o los clics.
- Compatible con el scroll porque se dibuja en coordenadas del viewport.
- Solo ratón con hover y puntero fino; se desactiva con movimiento reducido.
- Máximo 24 gotas; resolución limitada a 1.280 píxeles en el lado mayor.
- Renderizado limitado a unos 33 fps; se detiene cuando se disipa la estela.
- Limpieza de eventos, recursos gráficos y cuadros de animación al desmontar.
- Si no hay WebGL, la página sigue funcionando sin efecto.

## Verificación

`npm run build` completado. Los shaders se compilaron, enlazaron y renderizaron
con un contexto OpenGL ES fuera del navegador. Se comprobó que la estela tiene
transparencia y que, sin gotas, el lienzo es completamente transparente.
Pendiente: revisión de apariencia, interacción y rendimiento en navegador real,
incluidos el modo de movimiento reducido y los dispositivos táctiles.
