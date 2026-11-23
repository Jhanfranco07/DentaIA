import "./globals.css";
import "./tema.css";
import "./publico.css";
import "./accesibilidad.css";
import Accesibilidad from "@/components/Accesibilidad";
import { INICIAR_ACCESIBILIDAD } from "@/lib/accesibilidad/preferencias";
import type { Metadata } from "next";
import { TemaProvider } from "@/components/Tema";
export const metadata: Metadata = {title:"DentaIA | Cuida tu sonrisa",description:"Tu espacio de cuidado dental: cuenta personal, directorio odontológico y herramientas para profesionales autorizados.",robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es" data-tema="claro" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: INICIAR_ACCESIBILIDAD }} /></head><body><Accesibilidad><TemaProvider><a className="skip-link" href="#contenido">Ir al contenido</a>{children}</TemaProvider></Accesibilidad></body></html>;}
