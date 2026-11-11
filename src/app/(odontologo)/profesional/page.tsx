import ProfesionalClinico from "@/features/profesional/ProfesionalClinico";
import AccesoRol from "@/features/autorizacion/AccesoRol";

export default function ProfesionalPage() {
  return <AccesoRol rolesRequeridos={["odontologo"]} modulo="el panel profesional"><ProfesionalClinico /></AccesoRol>;
}
