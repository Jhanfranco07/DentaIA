import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type ClienteAuth = Pick<
  ReturnType<typeof getSupabaseBrowserClient>["auth"],
  "getSession" | "refreshSession"
>;

export async function provisionarRolPaciente(
  auth: ClienteAuth = getSupabaseBrowserClient().auth,
  solicitar: typeof fetch = fetch,
): Promise<void> {
  const { data, error } = await auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("No hay una sesion activa.");

  const respuesta = await solicitar("/api/cuenta/provision-patient-role", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    cache: "no-store",
  });
  if (!respuesta.ok) throw new Error("No se pudo activar el perfil de paciente.");

  const { data: sesionActualizada, error: errorActualizacion } = await auth.refreshSession();
  if (errorActualizacion) throw errorActualizacion;
  if (!sesionActualizada.session) throw new Error("No se pudo actualizar la sesion del paciente.");
}
