import AccesoRol from "@/features/autorizacion/AccesoRol";
import DirectorioLista from "@/features/directorio/DirectorioLista";

export default function DirectorioPacientePage() {
  return <AccesoRol rolesRequeridos={["paciente"]} modulo="el directorio odontológico del paciente"><DirectorioLista modoPaciente /></AccesoRol>;
}
