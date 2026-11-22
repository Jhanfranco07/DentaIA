/** Únicamente números autorizados, sin parámetros provenientes de la URL. */
export function normalizarWhatsapp(valor: string): string | null {
  const limpio = valor.trim().replace(/[\s().-]/g, "");
  const candidato = /^[9][0-9]{8}$/.test(limpio) ? "+51" + limpio : limpio;
  return /^[+][1-9][0-9]{7,14}$/.test(candidato) ? candidato : null;
}

export function enlaceWhatsappProfesional(valor: string, nombre: string): string | null {
  const telefono = normalizarWhatsapp(valor);
  if (!telefono) return null;
  const saludo = `Hola, encontré tu perfil profesional en DentaIA y quisiera consultar sobre tus servicios y disponibilidad. Gracias.`;
  void nombre; // No añadir datos privados o clínicos a la consulta externa.
  return `https://wa.me/${telefono.slice(1)}?text=${encodeURIComponent(saludo)}`;
}
