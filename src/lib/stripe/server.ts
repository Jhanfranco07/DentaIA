import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY.");

  if (!key.startsWith("sk_test_")) {
    throw new Error("Este prototipo solo admite claves de prueba (sk_test_).");
  }  

  client = new Stripe(key);
  return client;
}