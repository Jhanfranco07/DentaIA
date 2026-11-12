import AccesoRol from "@/features/autorizacion/AccesoRol";
import DentistaDetalle from "@/features/directorio/DentistaDetalle";

export default async function DetalleOdontologoPaciente({params}: {params: Promise<{id: string}>}) {
  const {id}=await params;
  return <AccesoRol rolesRequeridos={["paciente"]} modulo="la ficha odontológica del paciente"><DentistaDetalle id={id} baseDirectorio="/panel/odontologos" /></AccesoRol>;
}
