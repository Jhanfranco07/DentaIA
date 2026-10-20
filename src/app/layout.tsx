import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {title:"DentAI | Orientación bucal para pacientes",description:"Prototipo académico de orientación preventiva bucal y búsqueda de odontólogos.",robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>;}
