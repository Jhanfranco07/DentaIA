const FORMATO_PEN = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

/**Formatea el precio con Intl.NumberFormat es-PE. Si el dato no es válido, no inventa un precio como tal */
export function formatearPrecio(valor: number | null | undefined, moneda: string | null | undefined): string {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "Precio no disponible";
  const codigo = (moneda ?? "").trim().toUpperCase();
  if (!codigo || codigo === "PEN") return FORMATO_PEN.format(valor);
  try {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: codigo }).format(valor);
  } catch {
    // Código de moneda inválido en la BD: se usa PEN, que es lo que define la guía del equipo.
    return FORMATO_PEN.format(valor);
  }
}

/** Minúsculas y sin tildes, para que "odontopediatria" encuentre "Odontopediatría". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Devuelve el texto o una alternativa si viene vacío. */
export function textoOpcional(valor: string | null | undefined, alternativa: string): string {
  const limpio = valor?.trim();
  return limpio ? limpio : alternativa;
}

/** Iniciales para el avatar: usa la columna initials y, si está vacía, las deriva del nombre. */
export function inicialesDe(iniciales: string | null | undefined, nombre: string): string {
  const propias = iniciales?.trim();
  if (propias) return propias;
  const letras = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("");
  return letras.toUpperCase() || "?";
}





type Filtrable = { name: string; specialty: string; district: string };

/** Distritos únicos, sin vacíos y en orden alfabético. */
export function listarDistritos(lista: Filtrable[]): string[] {
  const unicos = new Set(lista.map(d => d.district.trim()).filter(Boolean));
  return [...unicos].sort((a, b) => a.localeCompare(b, "es"));
}

/** Filtra por texto (nombre o especialidad, sin tildes) y por distrito exacto. */
export function filtrarDentistas<T extends Filtrable>(lista: T[], busqueda: string, distrito: string): T[] {
  const q = normalizar(busqueda);
  return lista.filter(d => {
    const coincideTexto = !q || normalizar(d.name).includes(q) || normalizar(d.specialty).includes(q);
    const coincideDistrito = !distrito || d.district.trim() === distrito;
    return coincideTexto && coincideDistrito;
  });
}