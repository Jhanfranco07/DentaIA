export function Icono({ nombre = "diente", size = 24 }: { nombre?: "diente" | "flecha" | "escudo" | "reporte" | "persona"; size?: number }) {
  const trazos = {
    diente: "M12 5C8 1 3 4 5 10c1 3 1 10 4 10 2 0 1-7 3-7s1 7 3 7c3 0 3-7 4-10 2-6-3-9-7-5Z",
    flecha: "M4 12h15m-6-6 6 6-6 6", escudo: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6",
    reporte: "M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6", persona: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3c0-6 16-6 16 0v3",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={trazos[nombre]} /></svg>;
}
export function Marca() { return <span className="marca"><span className="marca-icono"><Icono size={27} /></span><span>Denta<span className="marca-acento">IA</span></span></span>; }
