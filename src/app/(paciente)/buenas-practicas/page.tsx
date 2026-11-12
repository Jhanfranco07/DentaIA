import AccesoRol from "@/features/autorizacion/AccesoRol";
import BuenasPracticas from "@/features/buenas-practicas/BuenasPracticas";

export default function BuenasPracticasPage() {
  return <AccesoRol rolesRequeridos={["paciente"]} modulo="buenas prácticas de salud bucal"><BuenasPracticas /></AccesoRol>;
}
