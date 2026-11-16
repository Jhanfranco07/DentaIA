import AccesoRol from "@/features/autorizacion/AccesoRol";
import RutinasPaciente from "@/features/rutinas/RutinasPaciente";

export default function RutinasPacientePage() {
  return <AccesoRol rolesRequeridos={["paciente"]} modulo="tus rutinas de cuidado bucal"><RutinasPaciente /></AccesoRol>;
}
