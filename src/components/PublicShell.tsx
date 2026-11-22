import type { ReactNode } from "react";
import Encabezado from "./Encabezado";
import Pie from "./Pie";

export default function PublicShell({ children }: { children: ReactNode }) {
  return <div className="public-site">
    <Encabezado />
    <main id="contenido" tabIndex={-1}>{children}</main>
    <Pie />
  </div>;
}
