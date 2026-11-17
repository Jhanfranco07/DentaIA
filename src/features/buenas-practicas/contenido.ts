export type CategoriaGuia = "Higiene diaria" | "Prevención" | "Señales de alerta";
export type GuiaBucal = {
  id: string;
  categoria: CategoriaGuia;
  titulo: string;
  descripcion: string;
  duracion: string;
  pasos: readonly string[];
  consejo: string;
  fuente: { nombre: string; url: string };
};

export const GUIAS_BUCALES: readonly GuiaBucal[] = [
  {
    id: "cepillado",
    categoria: "Higiene diaria",
    titulo: "Cepillado correcto",
    descripcion: "Dos minutos, dos veces al día, con pasta dental fluorada.",
    duracion: "2 minutos · 2 veces al día",
    pasos: [
      "Usa un cepillo de cerdas suaves y una pasta dental con flúor. Cepíllate dos veces al día durante dos minutos.",
      "Inclina las cerdas unos 45° hacia la línea de las encías. Haz movimientos cortos con poca presión para retirar la placa.",
      "Limpia la cara externa, la interna y la superficie con la que masticas. Para la cara interna de los dientes delanteros, pon el cepillo en vertical y muévelo suavemente de arriba abajo.",
      "Cambia el cepillo cada tres o cuatro meses, o antes si las cerdas se abren o se desgastan.",
    ],
    consejo: "Usa un temporizador de dos minutos y recorre siempre las mismas zonas. Por ejemplo, empieza arriba y termina abajo, sin saltarte las caras internas.",
    fuente: {
      nombre: "American Dental Association · Cepillos y técnica de cepillado",
      url: "https://www.ada.org/resources/ada-library/oral-health-topics/toothbrushes/",
    },
  },
  {
    id: "hilo",
    categoria: "Higiene diaria",
    titulo: "Limpieza interdental",
    descripcion: "Retira la placa de los espacios que el cepillo no alcanza.",
    duracion: "Una vez al día",
    pasos: [
      "Limpia entre los dientes todos los días con hilo dental u otro limpiador interdental adecuado para ti.",
      "Guía el hilo entre los dientes con suavidad. Evita que golpee la encía al pasar.",
      "Cuando llegues al borde de la encía, curva el hilo en forma de C contra un diente. Deslízalo suavemente por su costado y repite en el diente vecino.",
      "Continúa con el resto de la boca, incluida la parte posterior del último diente. Si la limpieza te sigue causando dolor o te cuesta hacerla con brackets o un puente, pide orientación a tu odontólogo.",
    ],
    consejo: "Asocia el hilo a una rutina que ya tengas. Puedes usarlo antes o después de cepillarte, por ejemplo, al prepararte para dormir.",
    fuente: {
      nombre: "American Dental Association · Uso del hilo dental",
      url: "https://www.mouthhealthy.org/all-topics-a-z/flossing/",
    },
  },
  {
    id: "alimentacion",
    categoria: "Prevención",
    titulo: "Alimentación y azúcar",
    descripcion: "Reduce los azúcares libres para ayudar a prevenir caries.",
    duracion: "Hábitos cotidianos",
    pasos: [
      "Las bacterias de la placa usan los azúcares libres para producir ácidos que desgastan la superficie del diente con el tiempo.",
      "Identifica fuentes de azúcares libres. Incluyen el azúcar que se añade a los alimentos y bebidas, además del que está presente en la miel, los jarabes y los jugos de fruta.",
      "Reduce el consumo de bebidas azucaradas y elige agua simple como bebida habitual.",
      "Al elegir una merienda, opta con más frecuencia por fruta entera en lugar de dulces o jugos.",
    ],
    consejo: "Para empezar, cambia la gaseosa o el jugo que tomas con el almuerzo por agua simple.",
    fuente: {
      nombre: "Organización Mundial de la Salud · Azúcares y caries dental",
      url: "https://www.who.int/es/news-room/fact-sheets/detail/sugars-and-dental-caries",
    },
  },
  {
    id: "fluor",
    categoria: "Prevención",
    titulo: "Protección con flúor",
    descripcion: "Aprende cómo el flúor protege el esmalte y ayuda a prevenir caries.",
    duracion: "En cada cepillado",
    pasos: [
      "La caries comienza cuando los ácidos que producen las bacterias dañan el esmalte, la capa externa del diente. Puede empezar sin causar dolor.",
      "El flúor ayuda a fortalecer el esmalte y puede detener o revertir el daño temprano, antes de que se forme una cavidad.",
      "Usa pasta dental con flúor dos veces al día y complementa el cepillado con limpieza entre los dientes.",
      "Acude a controles odontológicos regulares. Si notas una mancha nueva, dolor o sensibilidad, consulta para que un profesional evalúe la causa.",
    ],
    consejo: "Al comprar tu próxima pasta dental, revisa el envase y elige una que indique que contiene flúor.",
    fuente: {
      nombre: "Instituto Nacional de Investigación Dental y Craneofacial · Caries dental",
      url: "https://www.nidcr.nih.gov/espanol/temas-de-salud/la-caries-dental",
    },
  },
  {
    id: "controles",
    categoria: "Prevención",
    titulo: "Controles preventivos",
    descripcion: "Aprovecha la consulta para revisar tu salud bucal y tu rutina.",
    duracion: "Según indicación odontológica",
    pasos: [
      "Programa revisiones regulares. Pregunta al odontólogo cuándo te conviene volver según tus necesidades.",
      "Revisa con el profesional tu rutina de cepillado, limpieza entre los dientes y consumo de alimentos y bebidas con azúcar.",
      "Si te cuesta limpiar un espacio entre dos dientes, pide que te orienten sobre la herramienta que mejor se adapte a ti.",
      "Acuerda una rutina de cuidado en casa que puedas mantener y comenta en el siguiente control qué te resultó difícil.",
    ],
    consejo: "Lleva una pregunta concreta a tu consulta. Por ejemplo: «Me cuesta pasar el hilo entre estas muelas, ¿qué herramienta podría usar?».",
    fuente: {
      nombre: "American Dental Association · Recomendaciones de cuidado bucal",
      url: "https://www.mouthhealthy.org/oral-health-recommendations",
    },
  },
  {
    id: "encias",
    categoria: "Señales de alerta",
    titulo: "Cuidado de las encías",
    descripcion: "Reconoce señales que merecen una evaluación odontológica.",
    duracion: "Cuidado diario y revisión ante síntomas",
    pasos: [
      "La placa que queda alrededor de los dientes puede irritar las encías y endurecerse hasta formar sarro. El sarro requiere una limpieza profesional.",
      "Para reducir la acumulación de placa, cepíllate dos veces al día con pasta con flúor y limpia entre los dientes todos los días.",
      "Observa si las encías sangran, se hinchan o se retraen. El mal aliento persistente, el dolor al masticar y los dientes flojos también merecen revisión.",
      "Si notas alguna de estas señales, solicita una evaluación odontológica. Una revisión permite identificar la causa y orientar el cuidado.",
    ],
    consejo: "Si ves sangre al cepillarte, observa en qué zona ocurre y cuéntaselo a tu odontólogo durante la evaluación.",
    fuente: {
      nombre: "Instituto Nacional de Investigación Dental y Craneofacial · Enfermedad de las encías",
      url: "https://www.nidcr.nih.gov/espanol/temas-de-salud/la-enfermedad-de-las-encias",
    },
  },
] as const;

export const CATEGORIAS_GUIA = ["Todos", "Higiene diaria", "Prevención", "Señales de alerta"] as const;
