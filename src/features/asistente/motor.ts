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

/** Triage conservador: variantes habituales sin tildes; compartido por chat y servidor. */
export function esUrgenciaBucal(pregunta: string): boolean {
  const texto = pregunta.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const respiracion = /(?:no (?:puedo|logro|consigo) (?:bien )?(?:respirar|tragar)|(?:me cuesta|dificultad(?:es)? (?:para|al)) .*?(?:respirar|tragar)|(?:falta (?:de |el )?aire|me ahogo|asfixia|no puedo pasar saliva))/.test(texto);
  const hinchazon = /(?:hinch(?:a(?:zon|da|do|miento)?|o)|inflama(?:cion|da|do)?).*?(?:cara|rostro|cuello|mejilla)|(?:cara|rostro|cuello|mejilla).*?(?:hincha|inflama)/.test(texto);
  const hemorragia = /(?:hemorragia|(?:sangra|sangrado|sangre).*?(?:mucho|abundante|sin parar|no para|no se detiene)|(?:no (?:deja|paro) de sangrar))/.test(texto);
  const trauma = /(?:traumatismo|golpe|accidente).*?(?:fuerte|grave|severo)/.test(texto);
  const dolor = /dolor.*?(?:insoportable|inaguantable|muy intenso)/.test(texto);
  const fiebre = /fiebre/.test(texto) && /(?:hincha|inflama|absceso)/.test(texto);
  return respiracion || hinchazon || hemorragia || trauma || dolor || fiebre;
}

export function responderOrientacion(pregunta: string, observacion: ObservacionAsistente | null = null): RespuestaAsistente {
  const texto = pregunta.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().slice(0, 500);
  const gui = (ids: string[]) => ids.filter(id => GUIAS_BUCALES.some(g => g.id === id));
  const urgencia = esUrgenciaBucal(pregunta);
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
  if (/enc[ií]a|sangra|inflama|hilo|interdental/.test(texto)) return { texto: "Para limpiar entre los dientes: 1) Pasa el hilo con suavidad, sin golpear la encía. 2) Rodéalo alrededor del diente en forma de C y deslízalo por los lados. 3) Repite una vez al día. Si el sangrado persiste, hay dolor o inflamación, consulta a un odontólogo.",
    guias: gui(["encias", "hilo", "cepillado"]), especialidad: "periodoncia", enlaces: [ruta("/buenas-practicas", "Abrir guías")], alerta: false };
  if (/amarill|mancha|color|blanqueam|caries|dolor/.test(texto)) return { texto: "El color amarillo o una mancha no significa necesariamente caries: una foto no permite saber la causa. Para cuidarte hoy: cepíllate dos veces al día con pasta fluorada, limpia entre dientes y evita blanqueamientos sin valoración profesional. Si notas una mancha nueva, dolor o sensibilidad, pide una revisión odontológica.",
    guias: gui(["cepillado", "fluor", "controles"]), especialidad: "general", enlaces: [ruta("/directorio", "Explorar odontólogos")], alerta: false };
  if (/rutina|habito|cepill|cuid|consejo|guia|azucar|fluor|preven/.test(texto)) return { texto: "Empieza con tres hábitos sencillos: 1) Cepíllate dos minutos, dos veces al día, con pasta fluorada y cepillo suave. 2) Limpia entre los dientes una vez al día. 3) Reduce bebidas azucaradas y consulta con tu odontólogo cuándo corresponde tu próximo control. ¿Cuál te cuesta más mantener?",
    guias: gui(["cepillado", "hilo", "alimentacion", "fluor", "controles"]), especialidad: null, enlaces: [ruta("/paciente/rutinas", "Abrir mis rutinas"), ruta("/buenas-practicas", "Todas las guías")], alerta: false };
  if (/suscrip|premium|plan|pago/.test(texto)) return { texto: "Puedes revisar el plan de tu cuenta, la vigencia y el estado del pago de prueba en DentaIA Premium. Las funciones avanzadas en desarrollo no se habilitan por contratar el plan.",
    guias: [], especialidad: null, enlaces: [ruta("/premium", "Ver mi plan")], alerta: false };
  return { texto: "Dime qué te gustaría resolver y te lo explico aquí mismo. Puedo ayudarte con cepillado, limpieza entre dientes, manchas, rutinas preventivas, resultados que decidas compartir o servicios publicados. Si describes dolor o molestias, te orientaré sobre cuándo buscar una evaluación presencial; no hago diagnósticos.",
    guias: gui(["cepillado", "controles"]), especialidad: null,
    enlaces: [ruta("/analisis", "Preparar fotografía"), ruta("/paciente/rutinas", "Mis rutinas"), ruta("/directorio", "Ver profesionales")], alerta: false };
}
