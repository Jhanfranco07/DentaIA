export const PLAN_PREMIUM = {
  id: "premium-demo",
  name: "DentAI Premium (demostración)",
  amount: 2000, // pago único legacy de prueba, USD 20
  currency: "usd",
} as const;

/** Suscripción recurrente de prueba. Mantener separada del pago único legacy. */
export const PLAN_PREMIUM_MENSUAL = {
  name: "DentaIA Premium mensual (Sandbox)",
  amount: 1490, // S/ 14.90 expresado en céntimos
  currency: "pen",
} as const;
