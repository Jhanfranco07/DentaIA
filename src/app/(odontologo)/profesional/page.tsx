import ProfesionalClinico from "@/features/profesional/ProfesionalClinico";
import { qaPreviewPermitido } from "@/features/directorio/qa-preview";
import AccesoRol from "@/features/autorizacion/AccesoRol";

export default function ProfesionalPage() {
  return <AccesoRol rolesRequeridos={["odontologo"]} modulo="el panel profesional"><ProfesionalClinico qaPreview={qaPreviewPermitido(process.env)} /></AccesoRol>;
}
