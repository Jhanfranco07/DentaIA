import PanelPaciente from "@/features/panel/PanelPaciente";
import AccesoRol from "@/features/autorizacion/AccesoRol";

export default function PanelPage() {
  return <AccesoRol rolesRequeridos={["paciente"]} modulo="el panel del paciente"><PanelPaciente /></AccesoRol>;
}
