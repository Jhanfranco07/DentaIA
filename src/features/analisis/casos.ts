export type RegionDemo = { x: number; y: number; rx: number; ry: number; etiqueta: string };
export type CasoDemo = { id: string; titulo: string; resumen: string; imagen: string; sha256: string; observaciones: readonly string[]; recomendaciones: readonly string[]; regiones: readonly RegionDemo[] };
export const AVISO_DEMO = "Resultado simulado para fines académicos";
export const CASOS: readonly CasoDemo[] = [
  { id: "cuidado-habitual", titulo: "Cuidado bucal habitual", resumen: "Hábitos cotidianos para acompañar el cuidado de tu sonrisa.", imagen: "/demo/cuidado-habitual.png", sha256: "b2074f8f82fb806573fb3bf0d0f92b33aee61203dcefa072bcfc7f7eab2bffb6",
    observaciones: ["No se han señalado zonas de atención especial en este ejemplo.", "Esta ilustración no permite determinar el estado de salud de una persona."],
    recomendaciones: ["Cepilla tus dientes con pasta fluorada y una técnica suave.", "Incluye la limpieza entre los dientes en tu rutina diaria.", "Mantén tus controles odontológicos según la indicación de tu profesional."], regiones: [] },
  { id: "atencion-preventiva", titulo: "Una zona para conversar", resumen: "Una pieza dental resaltada para una conversación preventiva.", imagen: "/demo/atencion-preventiva.png", sha256: "806116d41cc070c2eb02870a864ec33721a669bfa4cd41cc252fd869dc4f6382",
    observaciones: ["La zona marcada es una referencia ilustrativa preparada para esta muestra.", "El resaltado no confirma caries ni otra enfermedad dental."],
    recomendaciones: ["Observa cambios o molestias y coméntalos con tu odontólogo.", "Mantén una higiene cuidadosa sin presionar la zona señalada.", "Solicita una evaluación profesional si tienes alguna preocupación."], regiones: [{ x: .565, y: .365, rx: .038, ry: .09, etiqueta: "Zona dental ilustrativa" }] },
  { id: "cuidado-encias", titulo: "Encías y cuidado preventivo", resumen: "Una guía educativa para prestar atención al cuidado de las encías.", imagen: "/demo/cuidado-encias.png", sha256: "3e3e8727b44fe6af4f27af1fc2a7c9c9f2e75067fb7bd6dacca80da2ae00d72e",
    observaciones: ["La región de encía resaltada forma parte del ejemplo educativo.", "No se ha detectado ni confirmado gingivitis o inflamación real."],
    recomendaciones: ["Limpia suavemente el borde entre dientes y encías.", "Consulta si notas sangrado frecuente, sensibilidad o cambios persistentes.", "Pide a tu odontólogo orientación sobre tu técnica de higiene."], regiones: [{ x: .5, y: .29, rx: .22, ry: .045, etiqueta: "Región gingival ilustrativa" }] },
];

export async function reconocerMuestra(contenido: Uint8Array): Promise<CasoDemo | null> {
  if (!contenido.byteLength || contenido.byteLength > 8_388_608) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(contenido).buffer);
  const hash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
  return CASOS.find(caso => caso.sha256 === hash) ?? null;
}
