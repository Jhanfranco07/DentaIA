import "./globals.css";
import type { Metadata } from "next";
import Encabezado from "@/components/Encabezado";
import Pie from "@/components/Pie";
export const metadata: Metadata = {title:"DentaIA | Cuida tu sonrisa",description:"Orientación educativa para tu salud bucal y un directorio odontológico de demostración.",robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><a className="skip-link" href="#contenido">Ir al contenido</a><Encabezado /><main id="contenido" tabIndex={-1}>{children}</main><Pie /></body></html>;}
