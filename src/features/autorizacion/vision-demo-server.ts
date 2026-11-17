import "server-only";
import { crearClienteIdentidadServidor } from "@/lib/supabase/server";
import { authorizeVisionDemo, consumeVisionAnalysisLimit } from "./vision-demo";

export function authorizeVisionDemoRequest(headers: Headers) {
  return authorizeVisionDemo(headers, crearClienteIdentidadServidor);
}

export function consumeVisionAnalysisRequestLimit(userId: string) {
  return consumeVisionAnalysisLimit(userId, process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN);
}
