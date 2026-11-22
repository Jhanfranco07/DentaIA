export const BM25 = { k1: 1.2, b: 0.75 } as const;
export const MAX_CONSULTA = 160;
export const MAX_PAGINA_BUSQUEDA = 1000;
const PALABRAS_VACIAS = new Set("a al con de del el en es la las lo los o para por que se un una unos unas y".split(" "));
const VARIANTES: Readonly<Record<string, string>> = {
  ortodoncista: "ortodoncia", ortodoncistas: "ortodoncia",
  odontopediatra: "odontopediatria", odontopediatras: "odontopediatria",
};

export function tokenizar(texto: string): string[] {
  const palabras = texto.normalize("NFKC").toLowerCase().replace(/ñ/g, "\uE000")
    .normalize("NFD").replace(/\p{M}/gu, "").replace(/\uE000/g, "ñ").match(/[\p{L}\p{N}]+/gu) ?? [];
  return palabras.filter(palabra => !PALABRAS_VACIAS.has(palabra)).map(palabra => {
    if (Object.hasOwn(VARIANTES, palabra)) return VARIANTES[palabra];
    if (palabra.length > 4 && /[aeiou]s$/.test(palabra)) return palabra.slice(0, -1);
    return palabra;
  });
}

export function idf(total: number, frecuencia: number) {
  return Math.log1p((total - frecuencia + 0.5) / (frecuencia + 0.5));
}

type Campo = { texto: string; peso: number };

/** Colecciones pequeñas que ya forman parte de la aplicación, como las seis guías. */
export function crearIndiceBm25<T>(documentos: readonly T[], campos: (documento: T) => readonly Campo[],
  { k1, b }: { k1: number; b: number } = BM25) {
  const invertido = new Map<string, Map<number, number>>();
  const longitudes = documentos.map((documento, indice) => {
    let longitud = 0;
    for (const { texto, peso } of campos(documento)) {
      const terminos = tokenizar(texto);
      longitud += terminos.length;
      for (const termino of terminos) {
        const frecuencias = invertido.get(termino) ?? new Map<number, number>();
        frecuencias.set(indice, (frecuencias.get(indice) ?? 0) + peso);
        invertido.set(termino, frecuencias);
      }
    }
    return longitud;
  });
  const promedio = longitudes.reduce((total, longitud) => total + longitud, 0) / (documentos.length || 1);

  return (consulta: string, cumple: (documento: T) => boolean = () => true, todosLosTerminos = false): T[] => {
    if (!consulta.trim()) return documentos.filter(cumple);
    const puntuaciones = new Map<number, number>();
    const coincidencias = new Map<number, number>();
    const terminos = [...new Set(tokenizar(consulta.slice(0, MAX_CONSULTA)))].slice(0, 12);
    for (const termino of terminos) {
      const frecuencias = invertido.get(termino);
      if (!frecuencias) continue;
      const rareza = idf(documentos.length, frecuencias.size);
      for (const [indice, tf] of frecuencias) {
        if (!cumple(documentos[indice])) continue;
        if (todosLosTerminos) coincidencias.set(indice, (coincidencias.get(indice) ?? 0) + 1);
        const ajuste = k1 * (1 - b + b * longitudes[indice] / promedio);
        puntuaciones.set(indice, (puntuaciones.get(indice) ?? 0) + rareza * tf * (k1 + 1) / (tf + ajuste));
      }
    }
    return [...puntuaciones].filter(([indice]) => !todosLosTerminos || coincidencias.get(indice) === terminos.length)
      .sort(([a, puntosA], [b, puntosB]) => puntosB - puntosA || a - b)
      .map(([indice]) => documentos[indice]);
  };
}
