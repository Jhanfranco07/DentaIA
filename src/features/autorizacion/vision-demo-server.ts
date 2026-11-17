import "server-only";
import { crearClienteIdentidadServidor } from "@/lib/supabase/server";
import { authorizeVisionDemo } from "./vision-demo";

export function authorizeVisionDemoRequest(headers: Headers) {
  return authorizeVisionDemo(headers, crearClienteIdentidadServidor);
}
