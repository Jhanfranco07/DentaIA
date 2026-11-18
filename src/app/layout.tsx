import "./globals.css";
import "./tema.css";
import type { Metadata } from "next";
import { TemaProvider } from "@/components/Tema";
export const metadata: Metadata = {title:"DentaIA | Cuida tu sonrisa",description:"Tu espacio de cuidado dental: cuenta personal, directorio odontológico y herramientas para profesionales autorizados.",robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es" data-tema="claro"><body><TemaProvider><a className="skip-link" href="#contenido">Ir al contenido</a>{children}</TemaProvider></body></html>;}
