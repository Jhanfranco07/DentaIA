import DentistaDetalle from "@/features/directorio/DentistaDetalle";
import { qaPreviewPermitido } from "@/features/directorio/qa-preview";

export default async function DetalleDentistaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="module-shell"><DentistaDetalle id={id} qaPreview={qaPreviewPermitido(process.env)} /></div>;
}