import AccesoRol from "@/features/autorizacion/AccesoRol";
import MisResultados from "@/features/analisis/MisResultados";

export default function ResultadosPage() {
  return <AccesoRol rolesRequeridos={["paciente"]} modulo="los resultados de análisis del paciente"><MisResultados /></AccesoRol>;
}
