import Link from "next/link";
import EstadoPlanPremium from "@/components/EstadoPlanPremium";
import PublicShell from "@/components/PublicShell";

export default function ExitoPage() {
  return (
    <PublicShell><div className="module-shell">
      <div className="page-intro">
        <span className="pill">STRIPE SANDBOX · SUSCRIPCIÓN</span>
        <h1>Regresaste de Stripe</h1>
        <p>La redirección no confirma por sí sola un pago. El plan se activa tras la notificación verificada de Stripe.</p>
      </div>
      <EstadoPlanPremium />
      <p className="notice">Si aún aparece Basic, espera la sincronización del webhook y utiliza «Volver a consultar» o visita tu plan.</p>
      <Link href="/premium" className="action">Ver mi suscripción</Link>
    </div></PublicShell>
  );
}
