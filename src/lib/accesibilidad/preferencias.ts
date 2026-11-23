export const CLAVE_ACCESIBILIDAD = "dentaia-accesibilidad-v1";
export const PREFERENCIAS_INICIALES = {
  escala: 100 as 100 | 125 | 150,
  espaciado: false, contraste: false, fuente: false, enlaces: false,
  movimiento: false, saturacion: false, guia: false, mascara: false,
  imagenes: false, cursor: false,
};
export type PreferenciasAccesibilidad = typeof PREFERENCIAS_INICIALES;
export type Ajuste = Exclude<keyof PreferenciasAccesibilidad, "escala">;
export type PerfilAccesibilidad = "estimulos" | "vision" | "concentracion";

export function normalizarPreferencias(valor: unknown): PreferenciasAccesibilidad {
  const salida = { ...PREFERENCIAS_INICIALES };
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return salida;
  const datos = valor as Record<string, unknown>;
  if (datos.escala === 100 || datos.escala === 125 || datos.escala === 150) salida.escala = datos.escala;
  for (const clave of Object.keys(salida) as (keyof PreferenciasAccesibilidad)[]) {
    if (clave !== "escala") salida[clave] = datos[clave] === true;
  }
  return salida;
}
export function leerPreferencias(almacen: Pick<Storage, "getItem">): PreferenciasAccesibilidad {
  try { return normalizarPreferencias(JSON.parse(almacen.getItem(CLAVE_ACCESIBILIDAD) ?? "null")); }
  catch { return { ...PREFERENCIAS_INICIALES }; }
}
export function perfilActivo(p: PreferenciasAccesibilidad, perfil: PerfilAccesibilidad) {
  if (perfil === "estimulos") return p.movimiento && p.saturacion;
  if (perfil === "vision") return p.escala === 150 && p.contraste && p.enlaces;
  return p.mascara && p.imagenes && p.movimiento;
}
export function alternarPerfil(p: PreferenciasAccesibilidad, perfil: PerfilAccesibilidad): PreferenciasAccesibilidad {
  const activar = !perfilActivo(p, perfil);
  if (perfil === "estimulos") return { ...p, movimiento: activar, saturacion: activar };
  if (perfil === "vision") return { ...p, escala: activar ? 150 : 100, contraste: activar, enlaces: activar };
  return { ...p, mascara: activar, imagenes: activar, movimiento: activar };
}

// Solo valores booleanos y una escala permitida; no se inserta contenido guardado como HTML.
// Se ejecuta en el head para respetar preferencias antes de la animación inicial.
export const INICIAR_ACCESIBILIDAD = `(function(){try{var p=JSON.parse(localStorage.getItem("${CLAVE_ACCESIBILIDAD}")||"null");if(!p||typeof p!=="object"||Array.isArray(p))return;var h=document.documentElement;var claves=${JSON.stringify(Object.keys(PREFERENCIAS_INICIALES).filter(c => c !== "escala"))};claves.forEach(function(c){h.setAttribute("data-a11y-"+c,String(p[c]===true));});var escala=[100,125,150].indexOf(p.escala)>=0?p.escala:100;h.style.setProperty("--a11y-escala",String(escala/100));}catch(e){}})();`;
