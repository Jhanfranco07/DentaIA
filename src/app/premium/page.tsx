import { PLAN_PREMIUM } from "@/lib/stripe/plan";

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
    </main>
  );
}