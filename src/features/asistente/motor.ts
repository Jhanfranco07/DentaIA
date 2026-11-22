import { GUIAS_BUCALES } from "@/features/buenas-practicas/contenido";

export type ObservacionAsistente = {
  evaluable: boolean;
  variacionesColor: number;
  posiblesAusencias: number;
  posiblesApiñamientos: number;
};
export type Especialidad = "general" | "ortodoncia" | "periodoncia";
export type RespuestaAsistente = {
  texto: string;
  guias: string[];
  especialidad: Especialidad | null;
  enlaces: { href: string; etiqueta: string }[];
  alerta: boolean;
};
const ruta = (href: string, etiqueta: string) => ({ href, etiqueta });
const BASE = "Te acompaño con orientación educativa. No sustituyo a un odontólogo ni puedo confirmar un diagnóstico a partir de una foto.";

export function responderOrientacion(pregunta: string, observacion: ObservacionAsistente | null = null): RespuestaAsistente {
  const texto = pregunta.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().slice(0, 500);
  const gui = (ids: string[]) => ids.filter(id => GUIAS_BUCALES.some(g => g.id === id));
  const urgencia = /hinchazon.*(cara|cuello)|dificultad.*(respirar|tragar)|sangrado.*(abundante|no para)|traumatismo.*(fuerte|grave)|fiebre.*(hinchazon|inflamacion)|dolor.*insoportable/.test(texto);
  if (urgencia) return {
    texto: "Lo que describes podría requerir atención urgente. Busca atención médica u odontológica presencial inmediata; si tienes dificultad para respirar o tragar, acude a emergencias. No esperes un resultado de IA.",
    guias: [], especialidad: null, enlaces: [ruta("/directorio", "Ver directorio (no sustituye urgencias)")], alerta: true,
  };
  if (observacion && /resultado|foto|analisis|evaluacion|mis dientes|recomiend/.test(texto)) {
    if (!observacion.evaluable) return { texto: "Tu fotografía no fue suficientemente evaluable. Prueba otra toma con luz uniforme, sin filtros y con los dientes visibles. Si tienes síntomas, consulta presencialmente. " + BASE,
      guias: gui(["cepillado", "controles"]), especialidad: "general", enlaces: [ruta("/analisis", "Preparar otra foto"), ruta("/directorio", "Explorar profesionales")], alerta: false };
    const hallazgos = [
      observacion.variacionesColor ? `${observacion.variacionesColor} regiones con diferencias de color` : "",
      observacion.posiblesAusencias ? `${observacion.posiblesAusencias} zonas de posible ausencia` : "",
      observacion.posiblesApiñamientos ? `${observacion.posiblesApiñamientos} zonas de posible apiñamiento` : "",
    ].filter(Boolean).join(", ");
    return { texto: `En la fotografía se señalaron ${hallazgos || "sin zonas destacadas por los modelos"}. Son observaciones orientativas, no dientes diagnosticados. Recomiendo consultar con odontología general para valorar el contexto${observacion.posiblesApiñamientos ? " y preguntar si conviene evaluación de ortodoncia" : ""}. ${BASE}`,
      guias: gui(["cepillado", "hilo", "controles"]), especialidad: observacion.posiblesApiñamientos ? "ortodoncia" : "general",
      enlaces: [ruta("/directorio", "Ver directorio"), ruta("/buenas-practicas", "Revisar guías")], alerta: false };
  }
  if (/precio|costo|cuanto|tarifa|odontologo|dentista|profesional|consultorio|cita|limpieza|ortodoncia/.test(texto)) {
    const especialidad = /ortodoncia|bracket|alineacion|chueco/.test(texto) ? "ortodoncia" : "general";
    return { texto: "Puedo mostrar servicios y precios que los profesionales hayan publicado en DentaIA. No son cotizaciones ni disponibilidad en tiempo real: verifica la tarifa y la atención directamente con el profesional. Los perfiles de demostración nunca representan odontólogos reales.",
      guias: gui(["controles"]), especialidad, enlaces: [ruta("/directorio", "Explorar directorio"), ruta("/solicitudes", "Mis solicitudes")], alerta: false };
  }
  if (/enc[ií]a|sangra|inflama|hilo|interdental/.test(texto)) return { texto: "La limpieza interdental y el cuidado suave de encías son hábitos útiles. Si hay sangrado persistente, molestias o inflamación, consulta presencialmente. " + BASE,
    guias: gui(["encias", "hilo", "cepillado"]), especialidad: "periodoncia", enlaces: [ruta("/buenas-practicas", "Abrir guías")], alerta: false };
  if (/amarill|mancha|color|blanqueam|caries|dolor/.test(texto)) return { texto: "La tonalidad de una foto no identifica por sí sola caries ni la causa de una mancha. No te recomiendo tratamientos o blanqueamientos sin evaluación profesional. Puedes comenzar con prevención y una consulta odontológica. " + BASE,
    guias: gui(["cepillado", "fluor", "controles"]), especialidad: "general", enlaces: [ruta("/directorio", "Explorar odontólogos")], alerta: false };
  if (/rutina|habito|cepill|cuid|consejo|guia|azucar|fluor|preven/.test(texto)) return { texto: "Te propongo una rutina preventiva basada en las guías educativas disponibles en DentaIA: cepillado, limpieza entre dientes, prevención y controles regulares. Puedes registrar tus hábitos en Mis rutinas.",
    guias: gui(["cepillado", "hilo", "alimentacion", "fluor", "controles"]), especialidad: null, enlaces: [ruta("/paciente/rutinas", "Abrir mis rutinas"), ruta("/buenas-practicas", "Todas las guías")], alerta: false };
  if (/suscrip|premium|plan|pago/.test(texto)) return { texto: "Puedes revisar el plan de tu cuenta, la vigencia y el estado del pago de prueba en DentaIA Premium. Las funciones avanzadas en desarrollo no se habilitan por contratar el plan.",
    guias: [], especialidad: null, enlaces: [ruta("/premium", "Ver mi plan")], alerta: false };
  return { texto: "Puedo ayudarte a entender orientativamente un resultado que compartas, recomendar guías del catálogo, mostrar servicios y precios publicados, y llevarte a tus rutinas, solicitudes o profesionales. " + BASE,
    guias: gui(["cepillado", "controles"]), especialidad: null,
    enlaces: [ruta("/analisis", "Preparar fotografía"), ruta("/paciente/rutinas", "Mis rutinas"), ruta("/directorio", "Ver profesionales")], alerta: false };
}
