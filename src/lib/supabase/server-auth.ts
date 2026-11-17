import "server-only";
import { crearClienteIdentidadServidor } from "./server";

export function getAccessTokenFromRequest(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization || authorization.length > 8192) return null;
  return /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(authorization)?.[1] ?? null;
}

/** Verifica el bearer con Auth usando el cliente público aislado del servidor. */
export async function getUserFromRequest(req: Request) {
  const token = getAccessTokenFromRequest(req);
  if (!token) return null;
  const { data, error } = await crearClienteIdentidadServidor().auth.getUser(token);
  return error ? null : data.user;
}
