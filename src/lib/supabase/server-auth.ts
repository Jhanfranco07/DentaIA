import "server-only";
import { crearClienteIdentidadServidor } from "./server";

/** Verifica el bearer con Auth usando el cliente público aislado del servidor. */
export async function getUserFromRequest(req: Request) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!match) return null;
  const { data, error } = await crearClienteIdentidadServidor().auth.getUser(match[1]);
  return error ? null : data.user;
}
