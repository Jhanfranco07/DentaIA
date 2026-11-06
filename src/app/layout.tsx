import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {title:"DentaIA | Cuida tu sonrisa",description:"Tu espacio de cuidado dental: cuenta personal, directorio odontológico y herramientas para profesionales autorizados.",robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><a className="skip-link" href="#contenido">Ir al contenido</a>{children}</body></html>;}
