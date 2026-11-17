import AccesoRol from "@/features/autorizacion/AccesoRol";
import DirectorioLista from "@/features/directorio/DirectorioLista";
import { qaPreviewPermitido } from "@/features/directorio/qa-preview";

export default function DirectorioPacientePage() {
  return <AccesoRol rolesRequeridos={["paciente"]} modulo="el directorio odontológico del paciente"><DirectorioLista modoPaciente qaPreview={qaPreviewPermitido(process.env)} /></AccesoRol>;
}
