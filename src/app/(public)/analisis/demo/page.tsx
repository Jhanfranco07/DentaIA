import { redirect } from "next/navigation";

// Mantiene antiguos enlaces compartidos sin volver a exponer el recorrido educativo retirado.
export default function DemoPage() { redirect("/analisis"); }
