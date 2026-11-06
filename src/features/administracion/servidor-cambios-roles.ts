import "server-only";
import { crearClienteIdentidadServidor } from "@/lib/supabase/server";
import { conAccesoAdministrativo } from "../autorizacion/servidor";
import { crearApiCambiosRoles, uuidRolesValido } from "./cambios-roles";
import { crearEscriturasRolesSupabase } from "./escrituras-roles-supabase";

export const gestionarRoles = crearApiCambiosRoles(conAccesoAdministrativo, async (request, actorId) => {
  // Segunda verificación oficial, no decodificación manual. El guard previo permanece intacto.
  const token = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return null;
  const { data, error } = await crearClienteIdentidadServidor().auth.getClaims(token);
  const c = data?.claims;
  if (error || !c || c.sub !== actorId || c.role !== "authenticated" || c.aal !== "aal2" || !uuidRolesValido(c.session_id)
    || typeof c.exp !== "number" || !Number.isSafeInteger(c.exp) || c.exp <= Date.now() / 1000) return null;
  return { actorId, sesionId: c.session_id, expira: c.exp };
}, { ejecutar: async (...args) => {
  // No habilitar escrituras administrativas en Preview ni Production, incluso si una variable se configura por error.
  if (process.env.VERCEL === "1" || process.env.NODE_ENV !== "development" || process.env.DENTAIA_ROLE_WRITES_ENABLED !== "true") return {
    status: 503, codigo: "ESCRITURAS_DESACTIVADAS", resultado: "rechazado", revision: null, asignacion: null,
  };
  return crearEscriturasRolesSupabase().ejecutar(...args);
} });
