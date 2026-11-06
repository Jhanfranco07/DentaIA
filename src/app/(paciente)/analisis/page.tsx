import AccesoRol from "@/features/autorizacion/AccesoRol";
import AnalisisDental from "@/features/analisis/AnalisisDental";

export default function AnalisisDentalPage() {
  return <AccesoRol rolesRequeridos={["paciente"]} modulo="el análisis dental del paciente"><AnalisisDental /></AccesoRol>;
}
