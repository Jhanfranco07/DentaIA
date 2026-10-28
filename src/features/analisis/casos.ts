export type RegionDemo = { x: number; y: number; rx: number; ry: number; etiqueta: string };
export type CasoDemo = {
  id: string; titulo: string; resumen: string; imagen: string; sha256: string;
  ancho: number; alto: number;
  tipoImagen: "referencia-pendiente" | "fotografia-autorizada";
  atribucion: string; fuente?: string; licenciaUrl?: string;
  observaciones: readonly string[]; recomendaciones: readonly string[]; regiones: readonly RegionDemo[];
};
export const AVISO_DEMO = "Resultado simulado para fines académicos";
// Fotografías clínicas pendientes de autorización y fuente verificable.
// Estos recursos son tarjetas editoriales propias, sin anatomía ni regiones clínicas.
// Al aprobar fotografías: registrar procedencia/licencia, dimensiones, hash y regiones.
export const CASOS: readonly CasoDemo[] = [
  { id: "cuidado-habitual", titulo: "Cuidado bucal habitual", resumen: "Hábitos cotidianos para acompañar el cuidado de tu sonrisa.", imagen: "/demo/cuidado-habitual.jpg", sha256: "0c4bf24ec2d85200d74ff420afccaca75b39b71203ba110ecbe8cb34bd00a031", ancho: 1400, alto: 840, tipoImagen: "referencia-pendiente", atribucion: "Referencia editorial DentaIA · no es una fotografía clínica",
    observaciones: ["Esta referencia presenta hábitos generales de cuidado, sin evaluar la boca de ninguna persona.", "La fotografía clínica de este ejemplo está pendiente de autorización; no se señalan regiones anatómicas."],
    recomendaciones: ["Cepilla tus dientes con pasta fluorada y una técnica suave.", "Incluye la limpieza entre los dientes en tu rutina diaria.", "Mantén tus controles odontológicos según la indicación de tu profesional."], regiones: [] },
  { id: "atencion-preventiva", titulo: "Atención preventiva dental", resumen: "Prepara una conversación con tu odontólogo sobre el cuidado preventivo.", imagen: "/demo/atencion-preventiva.jpg", sha256: "4a20d4904eebd201ec97052ab5739c1b905a9004bec81d14753ae5a80c791b5b", ancho: 1400, alto: 840, tipoImagen: "referencia-pendiente", atribucion: "Referencia editorial DentaIA · no es una fotografía clínica",
    observaciones: ["El contenido educativo de este caso está preparado de antemano y no confirma caries ni otra enfermedad.", "La fotografía clínica está pendiente de autorización; no se inventan ni resaltan zonas dentales en esta tarjeta."],
    recomendaciones: ["Observa cambios o molestias y coméntalos con tu odontólogo.", "Mantén una higiene cuidadosa sin presionar las zonas sensibles.", "Solicita una evaluación profesional si tienes alguna preocupación."], regiones: [] },
  { id: "cuidado-encias", titulo: "Cuidado de encías", resumen: "Una guía educativa para prestar atención al cuidado de las encías.", imagen: "/demo/cuidado-encias.jpg", sha256: "a1287eedfda9416acbe8329d95d85f87f96ec431f28c6569b73a1c6b5a88bae8", ancho: 1400, alto: 840, tipoImagen: "referencia-pendiente", atribucion: "Referencia editorial DentaIA · no es una fotografía clínica",
    observaciones: ["Este ejemplo comparte consejos generales sobre higiene de encías; no detecta gingivitis ni inflamación.", "La fotografía clínica está pendiente de autorización; esta referencia editorial no incluye regiones gingivales marcadas."],
    recomendaciones: ["Limpia suavemente el borde entre dientes y encías.", "Consulta si notas sangrado frecuente, sensibilidad o cambios persistentes.", "Pide a tu odontólogo orientación sobre tu técnica de higiene."], regiones: [] },
];

export async function reconocerMuestra(contenido: Uint8Array): Promise<CasoDemo | null> {
  if (!contenido.byteLength || contenido.byteLength > 8_388_608) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(contenido).buffer);
  const hash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
  return CASOS.find(caso => caso.sha256 === hash) ?? null;
}
