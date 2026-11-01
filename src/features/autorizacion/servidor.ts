import "server-only";
import { crearClienteIdentidadServidor } from "@/lib/supabase/server";
import { autorizarSolicitudAdministrativa, responderComprobacionAdministrativa } from "./autorizacion";

// Cada futura operación administrativa debe volver a exigir esta comprobación.
// No reutilizarla como permiso clínico ni confiar en una comprobación previa del navegador.
export function exigirAccesoAdministrativo(headers: Headers) {
  return autorizarSolicitudAdministrativa(headers, crearClienteIdentidadServidor);
}

export function comprobarAccesoAdministrativo(request: Request) {
  return responderComprobacionAdministrativa(request, crearClienteIdentidadServidor);
}
