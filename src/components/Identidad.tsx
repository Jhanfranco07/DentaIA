export type NombreIcono = "diente" | "flecha" | "escudo" | "reporte" | "persona" | "casa" | "camara" | "calendario" | "clinica" | "usuarios" | "salir" | "buscar" | "llave" | "reloj" | "menu" | "cerrar" | "enlace" | "subir" | "destello" | "imagen" | "check" | "alerta" | "privacidad" | "reloj-lista" | "actualizar";

export function Icono({ nombre = "diente", size = 24 }: { nombre?: NombreIcono; size?: number }) {
  const trazos = {
    diente: "M12 5C8 1 3 4 5 10c1 3 1 10 4 10 2 0 1-7 3-7s1 7 3 7c3 0 3-7 4-10 2-6-3-9-7-5Z",
    flecha: "M4 12h15m-6-6 6 6-6 6", escudo: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6",
    reporte: "M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6", persona: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3c0-6 16-6 16 0v3",
    casa: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z",
    camara: "M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
    calendario: "M5 4v3m14-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Zm3 8h2m3 0h2m-7 4h2m3 0h2",
    clinica: "M12 3v18M3 12h18M5 5h14v14H5zM9 8v2m6-2v2m-6 6v2m6-2v2",
    usuarios: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-3a4 4 0 0 1 0 8m2 2h4v-2a4 4 0 0 0-3-3.87",
    salir: "M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7",
    buscar: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm6-2 4 4",
    llave: "M15 7a5 5 0 1 0-4.9 6H13l2 2 2-2 2 2 3-3-5-5a5 5 0 0 0-2-0Z",
    reloj: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-16v6l4 2",
    menu: "M4 6h16M4 12h16M4 18h16",
    cerrar: "M18 6 6 18M6 6l12 12",
    enlace: "M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7m2.7 6.4a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7",
    subir: "M12 16V4m0 0L7 9m5-5 5 5M4 16v4h16v-4",
    destello: "m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Zm7 12 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z",
    imagen: "M4 5h16v14H4zM8 10h.01M4 16l5-5 4 4 3-3 4 4",
    check: "m5 12 4 4L19 6",
    alerta: "M12 9v4m0 4h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z",
    privacidad: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3-11 2 2 4-4",
    "reloj-lista": "M12 8v4l3 2M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
    actualizar: "M20 7v5h-5M4 17v-5h5m-5 0a8 8 0 0 1 14-5l2 2m-16 6 2 2a8 8 0 0 0 14-5",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={trazos[nombre]} /></svg>;
}
export function Marca() { return <span className="marca"><span className="marca-icono"><Icono size={27} /></span><span>Denta<span className="marca-acento">IA</span></span></span>; }
