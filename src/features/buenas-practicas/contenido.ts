export type CategoriaGuia = "Higiene diaria" | "Prevención" | "Señales de alerta";
export type GuiaBucal = {
  id: string; categoria: CategoriaGuia; titulo: string; descripcion: string;
  duracion: string; pasos: readonly string[]; consejo: string;
  fuente: { nombre: string; url: string };
};
export const GUIAS_BUCALES: readonly GuiaBucal[] = [
  {id:"cepillado",categoria:"Higiene diaria",titulo:"Cepillado correcto",descripcion:"Dos minutos, dos veces al día, con pasta dental fluorada.",duracion:"2 minutos · 2 veces al día",
   pasos:["Elige un cepillo de cerdas suaves y una pasta dental con flúor.","Coloca el cepillo a unos 45° hacia las encías y muévelo suavemente.","Limpia las caras exteriores, interiores y las superficies de masticación.","Reemplaza el cepillo cada 3 o 4 meses, o antes si las cerdas se deterioran."],
   consejo:"Cepillar con demasiada fuerza puede irritar las encías. La técnica suave es más importante que la presión.",
   fuente:{nombre:"American Dental Association · Cepillado",url:"https://www.mouthhealthy.org/all-topics-a-z/brushing-your-teeth/"}},
  {id:"hilo",categoria:"Higiene diaria",titulo:"Limpieza interdental",descripcion:"Cuida los espacios que tu cepillo no alcanza.",duracion:"Una vez al día",
   pasos:["Usa hilo dental o un limpiador interdental adecuado para ti.","Deslízalo con delicadeza entre los dientes, sin golpear las encías.","Rodea cada diente y limpia con suavidad el borde cercano a la encía.","Si usas ortodoncia o tienes prótesis, consulta qué herramienta te conviene."],
   consejo:"El objetivo es retirar la placa entre los dientes. No es necesario aplicar fuerza.",
   fuente:{nombre:"American Dental Association · Hilo dental",url:"https://www.mouthhealthy.org/all-topics-a-z/flossing/"}},
  {id:"alimentacion",categoria:"Prevención",titulo:"Alimentación y azúcar",descripcion:"Pequeñas decisiones que ayudan a proteger tu sonrisa.",duracion:"Hábitos cotidianos",
   pasos:["Elige agua con más frecuencia frente a bebidas azucaradas.","Limita la cantidad y frecuencia de bocadillos con azúcar añadida.","Mantén una alimentación variada y equilibrada.","Complementa estos hábitos con higiene oral y controles odontológicos."],
   consejo:"No se trata de prohibirte alimentos, sino de reducir la exposición frecuente al azúcar.",
   fuente:{nombre:"American Dental Association · Recomendaciones",url:"https://www.mouthhealthy.org/oral-health-recommendations"}},
  {id:"fluor",categoria:"Prevención",titulo:"Protección con flúor",descripcion:"Ayuda a proteger el esmalte y prevenir caries.",duracion:"En cada cepillado",
   pasos:["Busca una pasta dental que contenga flúor.","Cepíllate durante dos minutos, por la mañana y por la noche.","Recuerda que los enjuagues no sustituyen el cepillado.","Si necesitas cuidados específicos, consulta con tu odontólogo."],
   consejo:"Esta guía es para adultos. Los niños requieren cantidades de pasta y supervisión adecuadas a su edad.",
   fuente:{nombre:"American Dental Association · Flúor",url:"https://www.mouthhealthy.org/all-topics-a-z/fluoride"}},
  {id:"controles",categoria:"Prevención",titulo:"Controles preventivos",descripcion:"La prevención también empieza con una revisión profesional.",duracion:"Según indicación odontológica",
   pasos:["Acude a controles periódicos según tu situación personal.","Consulta si aparecen molestias, sensibilidad o cambios persistentes.","Comenta con el profesional medicamentos y antecedentes relevantes.","Solicita una revisión si detectas un problema, aunque parezca pequeño."],
   consejo:"La periodicidad de las visitas depende de tus necesidades; un profesional puede orientarte.",
   fuente:{nombre:"American Dental Association · Recomendaciones",url:"https://www.mouthhealthy.org/oral-health-recommendations"}},
  {id:"encias",categoria:"Señales de alerta",titulo:"Cuidado de las encías",descripcion:"Aprende qué señales merecen una evaluación.",duracion:"Ante síntomas persistentes",
   pasos:["Presta atención al sangrado al cepillarte o usar hilo dental.","Observa si hay hinchazón, dolor o mal aliento persistente.","Solicita evaluación odontológica si tus encías sangran con frecuencia.","Busca atención odontológica urgente si tienes inflamación intensa o dientes flojos."],
   consejo:"Esta guía no diagnostica enfermedades. Si tienes síntomas, un odontólogo debe evaluarlos.",
   fuente:{nombre:"NHS · Enfermedad de las encías",url:"https://www.nhs.uk/conditions/gum-disease/"}}
] as const;
export const CATEGORIAS_GUIA = ["Todos","Higiene diaria","Prevención","Señales de alerta"] as const;
