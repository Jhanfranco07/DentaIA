// Traducción de errores para pacientes. No cambia autorizaciones ni decisiones de borrado.
export function mensajeFotografia(error: unknown, alternativa: string): string {
  const dato = error as { tipo?: string; archivoAusente?: boolean; status?: number } | null;
  if (dato?.tipo === "sesion" || dato?.status === 401) return "Tu sesión cambió o ha terminado. Inicia sesión de nuevo en Mi cuenta.";
  if (dato?.tipo === "permisos" || dato?.status === 403) return "No pudimos autorizar esta acción. Comprueba tu sesión y vuelve a intentarlo.";
  if (dato?.archivoAusente) return "La imagen ya se eliminó, pero falta confirmar la limpieza de su registro. Pulsa Eliminar de nuevo para terminar.";
  if (dato?.tipo === "storage") return "No pudimos confirmar la eliminación de la imagen. La operación sigue pendiente; vuelve a intentarlo.";
  if (dato?.tipo === "base_datos") return "No pudimos completar la operación. Revisa tu conexión y vuelve a intentarlo.";
  const validaciones: Record<string, string> = {
    "Solo se permiten imágenes JPG, PNG o WebP.": "Elige una imagen JPG, PNG o WebP.",
    "La imagen debe tener un tamaño entre 1 byte y 8 MB.": "Elige una imagen de hasta 8 MB que no esté vacía.",
    "El archivo no se puede decodificar como una imagen válida.": "No pudimos abrir esa imagen. Prueba con otro archivo.",
  };
  return error instanceof Error && Object.hasOwn(validaciones, error.message) ? validaciones[error.message] : alternativa;
}
