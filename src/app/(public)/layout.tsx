import Encabezado from "@/components/Encabezado";
import Pie from "@/components/Pie";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <><Encabezado /><main id="contenido" tabIndex={-1}>{children}</main><Pie /></>;
}
