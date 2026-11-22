"use client";

import { useEffect, useRef } from "react";
import styles from "./estela-agua.module.css";
import { useAccesibilidad } from "./Accesibilidad";

const CANTIDAD = 24;
const VIDA = 1350;
const VERTICES = `attribute vec2 a_posicion;
void main(){gl_Position=vec4(a_posicion,0.0,1.0);}`;
const FRAGMENTOS = `precision mediump float;
uniform vec2 u_resolucion;
uniform vec2 u_ventana;
uniform float u_tiempo;
uniform vec4 u_gotas[24];
void main(){
  vec2 pixel=gl_FragCoord.xy/u_resolucion*u_ventana;
  // Ondas en el campo de la estela, sin muestrear ni deformar la página.
  vec2 ondulacion=vec2(sin(pixel.y*.019+u_tiempo*1.6),cos(pixel.x*.016-u_tiempo*1.3))*7.0;
  float campo=0.0;
  vec2 gradiente=vec2(0.0);
  for(int i=0;i<24;i++){
    vec4 gota=u_gotas[i];
    if(gota.w<=0.0)continue;
    vec2 distancia=pixel+ondulacion-gota.xy;
    float radio=max(gota.z,1.0);
    float influencia=exp(-dot(distancia,distancia)/(radio*radio))*gota.w;
    campo+=influencia;
    gradiente+=-2.0*distancia/(radio*radio)*influencia;
  }
  if(campo<.025){gl_FragColor=vec4(0.0);return;}
  float orilla=exp(-abs(campo-.36)*28.0);
  float interior=exp(-abs(campo-.62)*19.0);
  vec3 normal=normalize(vec3(gradiente*95.0,.7));
  float brillo=pow(max(dot(normal,normalize(vec3(-.45,.65,.65))),0.0),5.0);
  float prisma=sin(campo*10.0+normal.x*2.3+normal.y*1.7);
  vec3 agua=mix(vec3(.49,.79,.96),vec3(.83,.89,1.0),prisma*.5+.5);
  agua=mix(agua,vec3(1.0),brillo*.8);
  float cuerpo=smoothstep(.025,.35,campo)*.018;
  float alpha=min(.34,orilla*(.16+brillo*.19)+interior*.045+cuerpo);
  gl_FragColor=vec4(agua,alpha);
}`;

type Gota = { x: number; y: number; radio: number; nacimiento: number };

/** Decoración transparente: no lee el DOM ni captura clics, teclado o desplazamiento. */
export default function EstelaAgua() {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const { preferencias } = useAccesibilidad();

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas || preferencias.movimiento || preferencias.imagenes || preferencias.escala !== 100) return;
    const movimiento = window.matchMedia("(prefers-reduced-motion: reduce)");
    const raton = window.matchMedia("(hover: hover) and (pointer: fine)");
    let destruir: (() => void) | undefined;

    function iniciar() {
      destruir?.();
      destruir = undefined;
      if (!canvas || movimiento.matches || !raton.matches) return;
      const gl = canvas.getContext("webgl", {
        alpha: true, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, powerPreference: "low-power",
      });
      if (!gl) return;

      function compilar(tipo: number, fuente: string) {
        const shader = gl!.createShader(tipo);
        if (!shader) return null;
        gl!.shaderSource(shader, fuente);
        gl!.compileShader(shader);
        if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
          gl!.deleteShader(shader);
          return null;
        }
        return shader;
      }
      const vertice = compilar(gl.VERTEX_SHADER, VERTICES);
      const fragmento = compilar(gl.FRAGMENT_SHADER, FRAGMENTOS);
      if (!vertice || !fragmento) {
        if (vertice) gl.deleteShader(vertice);
        if (fragmento) gl.deleteShader(fragmento);
        return;
      }
      const programa = gl.createProgram();
      const buffer = gl.createBuffer();
      if (!programa || !buffer) {
        gl.deleteShader(vertice); gl.deleteShader(fragmento);
        if (programa) gl.deleteProgram(programa);
        if (buffer) gl.deleteBuffer(buffer);
        return;
      }
      gl.attachShader(programa, vertice); gl.attachShader(programa, fragmento);
      gl.linkProgram(programa);
      if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
        gl.deleteProgram(programa); gl.deleteBuffer(buffer);
        gl.deleteShader(vertice); gl.deleteShader(fragmento);
        return;
      }
      gl.useProgram(programa);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const posicion = gl.getAttribLocation(programa, "a_posicion");
      gl.enableVertexAttribArray(posicion);
      gl.vertexAttribPointer(posicion, 2, gl.FLOAT, false, 0, 0);
      const resolucion = gl.getUniformLocation(programa, "u_resolucion");
      const ventana = gl.getUniformLocation(programa, "u_ventana");
      const tiempo = gl.getUniformLocation(programa, "u_tiempo");
      const gotasUniforme = gl.getUniformLocation(programa, "u_gotas[0]");
      const datos = new Float32Array(CANTIDAD * 4);
      let gotas: Gota[] = [];
      let frame = 0;
      let ultimoFrame = 0;
      let anterior: { x: number; y: number } | null = null;
      let ancho = 0, alto = 0;
      let perdido = false;

      function limpiar() {
        cancelAnimationFrame(frame); frame = 0;
        gotas = []; anterior = null;
        gl!.clearColor(0, 0, 0, 0); gl!.clear(gl!.COLOR_BUFFER_BIT);
      }
      function ajustar() {
        ancho = window.innerWidth; alto = window.innerHeight;
        // Limitar el coste gráfico también en pantallas de alta densidad.
        const escala = Math.min(window.devicePixelRatio || 1, 1.25, 1280 / Math.max(ancho, alto));
        canvas!.width = Math.max(1, Math.round(ancho * escala));
        canvas!.height = Math.max(1, Math.round(alto * escala));
        gl!.viewport(0, 0, canvas!.width, canvas!.height);
        gl!.uniform2f(resolucion, canvas!.width, canvas!.height);
        gl!.uniform2f(ventana, ancho, alto);
        limpiar();
      }
      function pintar(ahora: number) {
        frame = 0;
        if (perdido || document.hidden) return;
        if (ahora - ultimoFrame < 30) { frame = requestAnimationFrame(pintar); return; }
        ultimoFrame = ahora;
        gotas = gotas.filter(g => ahora - g.nacimiento < VIDA);
        if (!gotas.length) { limpiar(); return; }
        datos.fill(0);
        gotas.forEach((g, i) => {
          const edad = (ahora - g.nacimiento) / VIDA;
          datos.set([g.x, alto - g.y, g.radio * (1 + edad * .32), Math.pow(1 - edad, 2) * .32], i * 4);
        });
        gl!.uniform1f(tiempo, ahora / 1000);
        gl!.uniform4fv(gotasUniforme, datos);
        gl!.drawArrays(gl!.TRIANGLES, 0, 6);
        frame = requestAnimationFrame(pintar);
      }
      function mover(evento: PointerEvent) {
        if (evento.pointerType !== "mouse" || perdido || document.hidden) return;
        const { clientX: x, clientY: y } = evento;
        const distancia = anterior ? Math.hypot(x - anterior.x, y - anterior.y) : 0;
        if (anterior && distancia < 5) return;
        gotas.unshift({ x, y, radio: Math.min(88, 54 + distancia * .22), nacimiento: performance.now() });
        gotas = gotas.slice(0, CANTIDAD);
        anterior = { x, y };
        if (!frame) frame = requestAnimationFrame(pintar);
      }
      function ocultar() { if (document.hidden) limpiar(); }
      function perderContexto(evento: Event) { evento.preventDefault(); perdido = true; limpiar(); }
      function restaurar() { iniciar(); }
      ajustar();
      window.addEventListener("pointermove", mover, { passive: true });
      window.addEventListener("resize", ajustar, { passive: true });
      window.addEventListener("blur", limpiar);
      document.addEventListener("visibilitychange", ocultar);
      canvas.addEventListener("webglcontextlost", perderContexto);
      canvas.addEventListener("webglcontextrestored", restaurar);
      destruir = () => {
        limpiar();
        window.removeEventListener("pointermove", mover);
        window.removeEventListener("resize", ajustar);
        window.removeEventListener("blur", limpiar);
        document.removeEventListener("visibilitychange", ocultar);
        canvas.removeEventListener("webglcontextlost", perderContexto);
        canvas.removeEventListener("webglcontextrestored", restaurar);
        gl.deleteBuffer(buffer); gl.deleteProgram(programa);
        gl.deleteShader(vertice); gl.deleteShader(fragmento);
      };
    }
    iniciar();
    movimiento.addEventListener("change", iniciar);
    raton.addEventListener("change", iniciar);
    return () => {
      movimiento.removeEventListener("change", iniciar);
      raton.removeEventListener("change", iniciar);
      destruir?.();
    };
  }, [preferencias.movimiento, preferencias.imagenes, preferencias.escala]);

  return <canvas ref={lienzo} className={styles.lienzo} aria-hidden="true" data-a11y-decorativa="true" />;
}
