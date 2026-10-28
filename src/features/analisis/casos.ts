export type RegionDemo = { x: number; y: number; rx: number; ry: number; etiqueta: string };
export type CasoDemo = {
  id: string; titulo: string; resumen: string; imagen: string; sha256: string;
  ancho: number; alto: number;
  tipoImagen: "referencia-pendiente" | "fotografia-autorizada";
  atribucion: string; fuente?: string; licenciaUrl?: string;
  observaciones: readonly string[]; recomendaciones: readonly string[]; regiones: readonly RegionDemo[];
};
export const AVISO_DEMO = "Resultado simulado para fines académicos";
// Fotografías públicas reutilizables: procedencia y evidencias por archivo en
// docs/FOTOGRAFIAS_DEMO.md y docs/evidencias/fotografias/fuentes.json.
// Las regiones son referencias editoriales manuales, nunca detecciones automáticas.
export const CASOS: readonly CasoDemo[] = [
  { id: "cuidado-habitual", titulo: "Cuidado bucal habitual", resumen: "Una fotografía intraoral para conversar sobre hábitos cotidianos.", imagen: "/demo/cuidado-habitual.jpg", sha256: "73f8781d80ee70ac9ad5bb35d60121a09b8650ac6d22165a0b7ae2a846428884", ancho: 1280, alto: 1707, tipoImagen: "fotografia-autorizada", atribucion: "Detailed view of the inside of the human mouth · CC0 · adaptación: compresión JPEG", fuente: "https://commons.wikimedia.org/wiki/File:Detailed_view_of_the_inside_of_the_human_mouth.jpg", licenciaUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    observaciones: ["Esta fotografía de referencia acompaña consejos generales de cuidado; no evalúa la salud de una persona.", "No se señalan zonas especiales en este ejemplo. La ausencia de marcas no confirma que la boca esté sana."],
    recomendaciones: ["Cepilla tus dientes con pasta fluorada y una técnica suave.", "Incluye la limpieza entre los dientes en tu rutina diaria.", "Mantén tus controles odontológicos según la indicación de tu profesional."], regiones: [] },
  { id: "atencion-preventiva", titulo: "Atención preventiva dental", resumen: "Una pieza dental de referencia para una conversación preventiva.", imagen: "/demo/atencion-preventiva.jpg", sha256: "9df2f498893f87a57427cd73cd7b5cb291e7e3807bb64884b7f41b8b3648decf", ancho: 1280, alto: 960, tipoImagen: "fotografia-autorizada", atribucion: "Suyash.dwivedi · Dental Caries Cavity 2 (cropped) · CC BY-SA 4.0 · adaptación: compresión JPEG", fuente: "https://commons.wikimedia.org/wiki/File%3ADental_Caries_Cavity_2_%28cropped%29.JPG", licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    observaciones: ["La zona dental marcada es una referencia visual seleccionada manualmente para esta fotografía pública.", "El contenido está preparado de antemano: no constituye una detección automática ni un diagnóstico de quien usa DentaIA."],
    recomendaciones: ["Observa cambios o molestias y coméntalos con tu odontólogo.", "Mantén una higiene cuidadosa sin presionar las zonas sensibles.", "Solicita una evaluación profesional si tienes alguna preocupación."], regiones: [{ x: .48, y: .57, rx: .17, ry: .23, etiqueta: "Zona dental de referencia" }] },
  { id: "cuidado-encias", titulo: "Cuidado de encías", resumen: "Una fotografía de referencia para conversar sobre dientes y encías.", imagen: "/demo/cuidado-encias.jpg", sha256: "97376310eb73f2eeacb691559d2ce6dc184aeb4caf66299f588c3d36a19b0628", ancho: 1280, alto: 636, tipoImagen: "fotografia-autorizada", atribucion: "DRosenbach · MandibularAnteriorCalculus · dominio público · adaptación: compresión JPEG", fuente: "https://commons.wikimedia.org/wiki/File%3AMandibularAnteriorCalculus.JPG", licenciaUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    observaciones: ["La región de encía marcada es una referencia educativa preparada manualmente para esta fotografía pública.", "Esta demostración no analiza tu boca ni detecta gingivitis o inflamación; comparte consejos preventivos generales."],
    recomendaciones: ["Limpia suavemente el borde entre dientes y encías.", "Consulta si notas sangrado frecuente, sensibilidad o cambios persistentes.", "Pide a tu odontólogo orientación sobre tu técnica de higiene."], regiones: [{ x: .53, y: .68, rx: .17, ry: .10, etiqueta: "Región gingival de referencia" }] },
];

export async function reconocerMuestra(contenido: Uint8Array): Promise<CasoDemo | null> {
  if (!contenido.byteLength || contenido.byteLength > 8_388_608) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(contenido).buffer);
  const hash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
  return CASOS.find(caso => caso.sha256 === hash) ?? null;
}
