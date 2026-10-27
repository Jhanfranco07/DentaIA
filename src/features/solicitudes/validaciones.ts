
export type DatosSolicitud = {
  odontologoId: string;
  nombre: string;
  correo: string;
  fecha: string;
  mensaje: string;
};

function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const [anio, mes, dia] = fecha.split("-").map(Number);

  const fechaComprobada = new Date(0);
  fechaComprobada.setFullYear(anio, mes - 1, dia);

  return (
    fechaComprobada.getFullYear() === anio &&
    fechaComprobada.getMonth() === mes - 1 &&
    fechaComprobada.getDate() === dia
  );
}

export function validarSolicitud(
  datos: DatosSolicitud,
  fechaActual: string
): string | null {
  if (!datos.odontologoId.trim()) {
    return "Selecciona un odontólogo.";
  }

  if (!datos.nombre.trim()) {
    return "Ingresa tu nombre completo.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo.trim())) {
    return "Ingresa un correo electrónico válido.";
  }

  if (!esFechaValida(datos.fecha)) {
    return "Selecciona una fecha válida.";
  }

  if (datos.fecha < fechaActual) {
    return "La fecha no puede ser anterior a hoy.";
  }

  if (datos.mensaje.trim().length > 1000) {
    return "El mensaje no puede superar los 1000 caracteres.";
  }

  return null;
}

export function puedeCancelarSolicitud(estado: string): boolean {
  return estado === "requested";
}
