import Link from "next/link";
import PublicShell from "@/components/PublicShell";

export default function CanceladoPage() {
  return (
    <PublicShell><div className="module-shell">
      <div className="page-intro">
        <span className="pill">PAGO DE PRUEBA</span>
        <h1>Cancelaste el pago</h1>
        <p>No se realizó ningún cargo. Puedes intentarlo de nuevo cuando quieras.</p>
      </div>
      <Link className="action" href="/premium">
        Volver a Premium
      </Link>
    </div></PublicShell>
  );
}
