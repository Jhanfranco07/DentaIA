import DirectorioLista from "@/features/directorio/DirectorioLista";
import { qaPreviewPermitido } from "@/features/directorio/qa-preview";

export default function DirectoryPage() {
  return <div className="module-shell"><DirectorioLista qaPreview={qaPreviewPermitido(process.env)} /></div>;
}