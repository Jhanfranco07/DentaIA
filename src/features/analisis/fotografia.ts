export const TAMANO_MAXIMO_FOTOGRAFIA = 8 * 1024 * 1024;
export const TIPOS_FOTOGRAFIA_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"] as const;

export type ArchivoFotografico = Pick<File, "type" | "size">;
export type ResultadoValidacionFotografia =
  | { valido: true }
  | { valido: false; motivo: "faltante" | "formato" | "vacio" | "tamano" };

export function validarFotografia(archivo: ArchivoFotografico | null | undefined): ResultadoValidacionFotografia {
  if (!archivo) return { valido: false, motivo: "faltante" };
  if (!(TIPOS_FOTOGRAFIA_PERMITIDOS as readonly string[]).includes(archivo.type)) {
    return { valido: false, motivo: "formato" };
  }
  if (!Number.isFinite(archivo.size) || archivo.size < 1) return { valido: false, motivo: "vacio" };
  if (archivo.size > TAMANO_MAXIMO_FOTOGRAFIA) return { valido: false, motivo: "tamano" };
  return { valido: true };
}

export function mensajeValidacionFotografia(motivo: Exclude<ResultadoValidacionFotografia, { valido: true }>["motivo"]): string {
  switch (motivo) {
    case "faltante": return "Selecciona una fotografía antes de continuar.";
    case "formato": return "Elige una imagen JPG, PNG o WebP.";
    case "vacio": return "El archivo está vacío o no tiene un tamaño válido.";
    case "tamano": return "La fotografía debe pesar 8 MB o menos.";
  }
}

export function mensajeErrorCamara(nombre: string): string {
  if (nombre === "NotAllowedError" || nombre === "PermissionDeniedError") return "No se concedió permiso para usar la cámara. Puedes habilitarlo en el navegador o subir una fotografía.";
  if (nombre === "NotFoundError" || nombre === "DevicesNotFoundError") return "No encontramos una cámara disponible. Puedes subir una fotografía.";
  if (nombre === "NotReadableError" || nombre === "TrackStartError") return "La cámara está ocupada o no se pudo iniciar. Ciérrala en otra aplicación e inténtalo nuevamente.";
  if (nombre === "SecurityError") return "El navegador bloqueó la cámara porque esta página no usa un contexto seguro.";
  return "No se pudo iniciar la cámara. Puedes subir una fotografía o intentarlo de nuevo.";
}

export function restriccionesCamara() {
  return { audio: false as const, video: { facingMode: { ideal: "environment" as const }, width: { ideal: 1920 }, height: { ideal: 1080 } } };
}

export type EstadoAnalisisDental = "pendiente" | "procesando" | "completado" | "fallido";

/** Contrato de frontend para el futuro servicio de inferencia; no implica que exista ni que se invoque hoy. */
export type ResultadoAnalisisDental = {
  id: string;
  imageId: string;
  status: EstadoAnalisisDental;
  modelVersion: string | null;
  processedAt: string | null;
  observations: string[];
  highlightedAreas: Array<{ label: string; x: number; y: number; width: number; height: number }>;
  recommendations: string[];
  limitations: string[];
  errorCode: string | null;
};
