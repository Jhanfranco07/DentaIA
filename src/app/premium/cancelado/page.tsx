import Link from "next/link";

export default function CanceladoPage() {
  return (
    <main className="module-shell">
      <div className="page-intro">
        <span className="pill">PAGO DE PRUEBA</span>
        <h1>Cancelaste el pago</h1>
        <p>No se realizó ningún cargo. Puedes intentarlo de nuevo cuando quieras.</p>
      </div>
      <Link className="action" href="/premium">
        Volver a Premium
      </Link>
    </main>
  );
}