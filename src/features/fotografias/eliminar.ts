import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Cliente = SupabaseClient<Database>;
type TipoError = "sesion" | "permisos" | "storage" | "base_datos";
const BUCKET = "dental-photos";

export class ErrorEliminacionFoto extends Error {
  tipo: TipoError;
  archivoAusente: boolean;

  constructor(tipo: TipoError, mensaje: string, archivoAusente = false) {
    super(mensaje);
    this.name = "ErrorEliminacionFoto";
    this.tipo = tipo;
    this.archivoAusente = archivoAusente;
  }
}

function traducirError(error: unknown, etapa: TipoError, archivoAusente: boolean) {
  if (error instanceof ErrorEliminacionFoto) return error;
  const dato = error as { code?: string; error?: string; status?: number; statusCode?: string } | null;
  const codigo = dato?.code ?? dato?.error;
  const estado = Number(dato?.status ?? dato?.statusCode);
  const pendiente = archivoAusente ? " El archivo ya no está en Storage; queda pendiente limpiar su registro. Puedes reintentar sin volver a subirlo." : "";
  if (etapa === "sesion" || estado === 401 || ["InvalidJWT", "PGRST301", "PGRST303"].includes(codigo ?? "")) {
    return new ErrorEliminacionFoto("sesion", "Tu sesión ya no es válida o cambió. Inicia sesión nuevamente." + pendiente, archivoAusente);
  }
  if (estado === 403 || ["42501", "AccessDenied", "Unauthorized"].includes(codigo ?? "")) {
    return new ErrorEliminacionFoto("permisos", "No tienes permiso para completar la eliminación." + pendiente, archivoAusente);
  }
  return new ErrorEliminacionFoto(etapa, etapa === "storage"
    ? "No se pudo confirmar la eliminación del archivo en Storage. Se conserva el registro para reintentar."
    : "No se pudo completar la operación en la base de datos." + pendiente, archivoAusente);
}

/** RLS sigue siendo la autorización del servidor; se valida la sesión, nunca el estado de React. */
export async function eliminarFotografia(client: Cliente, usuarioEsperado: string | null, fotoId: string): Promise<"eliminada" | "no_disponible"> {
  let etapa: TipoError = "sesion";
  let archivoAusente = false;
  async function verificarSesion() {
    etapa = "sesion";
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!usuarioEsperado || !data.user || data.user.id !== usuarioEsperado) {
      throw new Error("Sesión ausente o diferente.");
    }
    return data.user.id;
  }
  try {
    const usuario = await verificarSesion();
    etapa = "base_datos";
    const { data: foto, error: lecturaError } = await client.from("dental_photos")
      .select("id,user_id,bucket_id,consent_id,object_path")
      .eq("id", fotoId).eq("user_id", usuario).maybeSingle();
    if (lecturaError) throw lecturaError;
    // Ausente o invisible por RLS: no se toca Storage ni se afirma que se eliminó una foto ajena.
    if (!foto) return "no_disponible";

    const partes = foto.object_path.split("/");
    if (foto.user_id !== usuario || foto.bucket_id !== BUCKET || partes.length !== 3 ||
        partes[0] !== usuario || partes[1] !== foto.consent_id ||
        !/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(partes[2])) {
      throw new ErrorEliminacionFoto("permisos", "La ruta de la fotografía no corresponde al propietario y consentimiento autorizados.");
    }

    await verificarSesion();
    etapa = "storage";
    const storage = client.storage.from(BUCKET);
    // remove() admite objetos ausentes, pero un HTTP 200 con [] también puede no borrar nada.
    const { error: storageError } = await storage.remove([foto.object_path]);
    if (storageError) throw storageError;
    const { data: restantes, error: listaError } = await storage.list(partes.slice(0, 2).join("/"), {
      search: partes[2], limit: 100, offset: 0,
    });
    if (listaError) throw listaError;
    // Con las políticas vigentes SELECT permite listar todos los archivos del propietario.
    // Una respuesta incompleta o el objeto aún visible nunca confirman una eliminación.
    if (!restantes || restantes.length >= 100 || restantes.some((item) => item.name === partes[2])) {
      throw new ErrorEliminacionFoto("storage", "Storage no confirmó la ausencia del archivo. Revisa los permisos e inténtalo nuevamente; el registro se conserva.");
    }
    archivoAusente = true;

    await verificarSesion();
    etapa = "base_datos";
    const { data: borrada, error: borradoError } = await client.from("dental_photos").delete()
      .eq("id", foto.id).eq("user_id", usuario).eq("object_path", foto.object_path)
      .select("id").maybeSingle();
    if (borradoError) throw borradoError;
    if (!borrada) {
      // DELETE sin error no garantiza filas afectadas: distinguir denegación de un borrado concurrente.
      const { data: restante, error: comprobacionError } = await client.from("dental_photos")
        .select("id").eq("id", foto.id).eq("user_id", usuario).maybeSingle();
      if (comprobacionError) throw comprobacionError;
      if (restante) throw new ErrorEliminacionFoto("permisos", "No se pudo eliminar el registro autorizado. El archivo ya no está en Storage; reintenta la limpieza del registro.", true);
    }
    await verificarSesion();
    return "eliminada";
  } catch (error) {
    throw traducirError(error, etapa, archivoAusente);
  }
}
