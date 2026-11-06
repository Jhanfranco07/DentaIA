import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {title:"DentaIA | Cuida tu sonrisa",description:"Orientación educativa para tu salud bucal y un directorio odontológico de demostración.",robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><a className="skip-link" href="#contenido">Ir al contenido</a>{children}</body></html>;}
