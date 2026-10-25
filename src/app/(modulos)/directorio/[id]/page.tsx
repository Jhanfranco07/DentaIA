import DentistaDetalle from "@/features/directorio/DentistaDetalle";

export default async function DetalleDentistaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DentistaDetalle id={id} />;
}