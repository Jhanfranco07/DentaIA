import { PLAN_PREMIUM } from "@/lib/stripe/plan";

const precio = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: PLAN_PREMIUM.currency.toUpperCase(),
}).format(PLAN_PREMIUM.amount / 100);

export default function PremiumPage() {
  return (
    <main className="module-shell">
      <div className="page-intro">
        <p>
          Plan de demostración con el recorrido premium: reporte educativo A4 y
          recomendaciones. Es un plan ficticio para probar el flujo de pago.
        </p>
        <span className="pill">PLAN PREMIUM</span>
        <h1>DentAI Premium</h1>
      </div>

        <section className="surface panel">
        <h2>{PLAN_PREMIUM.name}</h2>
        <p className="precio">{precio}</p>
      </section>

        <p className="notice">
        <strong>Modo prueba</strong>
        No se cobra dinero real. Usa la tarjeta 4242 4242 4242 4242, cualquier
        fecha futura y cualquier CVC.
      </p>
    </main>
  );
}