import type { CasoDemo } from "./casos";

const PAGINA = { ancho: 595, alto: 842 };
const COLORES = {
  tinta: "0.063 0.165 0.263",
  secundario: "0.322 0.396 0.467",
  turquesa: "0.031 0.494 0.545",
  claro: "0.910 0.969 0.965",
  fondo: "0.965 0.976 0.988",
  borde: "0.855 0.898 0.922",
};
const DIRECTORIO = "https://dent-ai-five.vercel.app/directorio";

/** PDF A4 autónomo: no consulta cuentas, historiales ni servicios externos. */
export function crearPDF(caso: CasoDemo, fecha: Date, imagenJpeg: Uint8Array, ancho: number, alto: number): Uint8Array {
  if (!Number.isFinite(fecha.getTime()) || imagenJpeg[0] !== 0xff || imagenJpeg[1] !== 0xd8 || !Number.isInteger(ancho) || !Number.isInteger(alto) || ancho < 1 || alto < 1) {
    throw new Error("No se pudo preparar el reporte.");
  }
  // Los archivos se codifican con WinAnsi, incluido el texto en español.
  const bytes = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0) <= 255 ? c.charCodeAt(0) : c === "•" ? 149 : c === "—" || c === "–" ? 150 : 63);
  const unir = (partes: Uint8Array[]) => {
    const salida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
    let posicion = 0;
    for (const parte of partes) { salida.set(parte, posicion); posicion += parte.length; }
    return salida;
  };
  const seguro = (s: string) => s.replace(/[\r\n\t]/g, " ").replace(/([\\()])/g, "\\$1");
  const comandos: string[] = [];
  const texto = (s: string, x: number, y: number, tamano = 10, negrita = false, color = COLORES.tinta) => {
    comandos.push(`BT /${negrita ? "F2" : "F1"} ${tamano} Tf ${color} rg ${x} ${PAGINA.alto - y} Td (${seguro(s)}) Tj ET`);
  };
  const caja = (x: number, y: number, w: number, h: number, color: string) => comandos.push(`${color} rg ${x} ${PAGINA.alto - y - h} ${w} ${h} re f`);
  const linea = (x: number, y: number, w: number, color = COLORES.borde) => comandos.push(`${color} RG .6 w ${x} ${PAGINA.alto - y} m ${x + w} ${PAGINA.alto - y} l S`);
  // Anchuras conservadoras de Helvetica para impedir desbordamientos, sin cortar palabras.
  const medida = (s: string, tamano: number) => [...s].reduce((total, c) => total + (/[ilI.,:;'!| ]/.test(c) ? .28 : /[MW@%]/.test(c) ? .9 : /[A-ZÁÉÍÓÚÑ]/.test(c) ? .68 : .54) * tamano, 0);
  const envolver = (s: string, w: number, tamano: number) => {
    const resultado: string[] = []; let actual = "";
    for (const palabra of s.split(/\s+/)) {
      if (actual && medida(`${actual} ${palabra}`, tamano) > w) { resultado.push(actual); actual = palabra; }
      else actual = actual ? `${actual} ${palabra}` : palabra;
    }
    if (actual) resultado.push(actual);
    return resultado;
  };
  const parrafo = (s: string, x: number, y: number, w: number, tamano = 10, interlineado = 14, negrita = false, color = COLORES.secundario) => {
    for (const l of envolver(s, w, tamano)) { texto(l, x, y, tamano, negrita, color); y += interlineado; }
    return y;
  };
  const fechaTexto = fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Lima" });
  const numeroCaso = String(Math.max(1, ["cuidado-habitual", "atencion-preventiva", "cuidado-encias"].indexOf(caso.id) + 1)).padStart(2, "0");
  const referenciaPendiente = (caso as CasoDemo & { tipoImagen?: string }).tipoImagen === "referencia-pendiente";
  const credito = caso.atribucion;
  const enlaces: { url: string; rect: string }[] = [{ url: DIRECTORIO, rect: "38 101 557 135" }];
  if (!referenciaPendiente && caso.fuente) enlaces.push({ url: caso.fuente, rect: "38 9 127 25" });
  if (!referenciaPendiente && caso.licenciaUrl) enlaces.push({ url: caso.licenciaUrl, rect: "147 9 319 25" });

  caja(0, 0, 595, 842, "1 1 1");
  caja(0, 0, 595, 8, COLORES.turquesa);
  caja(38, 34, 29, 29, COLORES.turquesa);
  texto("D", 46, 55, 19, true, "1 1 1");
  texto("DentaIA", 77, 55, 23, true);
  texto("Una guía para cuidar tu sonrisa", 78, 72, 8.5, false, COLORES.secundario);
  texto(`DEMOSTRACIÓN / ${numeroCaso}`, 391, 45, 8.5, true, COLORES.turquesa);
  texto(fechaTexto, 391, 62, 8.5, false, COLORES.secundario);
  linea(38, 88, 519);
  texto("Reporte preventivo", 38, 123, 28, true);
  texto("Tu ejemplo, explicado con claridad.", 39, 144, 11, false, COLORES.secundario);
  caja(38, 158, 519, 25, COLORES.claro);
  texto("Resultado simulado para fines académicos", 49, 174, 9.5, true, COLORES.turquesa);

  // Contain mantiene toda la fotografía y su proporción, incluso para muestras verticales.
  const vertical = alto > ancho;
  const foto = { x: 38, y: 198, w: vertical ? 169 : 326, h: 201 };
  const contexto = { x: vertical ? 229 : 382, w: vertical ? 322 : 169 };
  caja(foto.x, foto.y, foto.w, foto.h, COLORES.fondo);
  const escala = Math.min(foto.w / ancho, foto.h / alto);
  const imagenW = ancho * escala, imagenH = alto * escala;
  const imagenX = foto.x + (foto.w - imagenW) / 2, imagenY = foto.y + (foto.h - imagenH) / 2;
  comandos.push(`q ${imagenW.toFixed(3)} 0 0 ${imagenH.toFixed(3)} ${imagenX.toFixed(3)} ${(PAGINA.alto - imagenY - imagenH).toFixed(3)} cm /Im1 Do Q`);
  // Las regiones se dibujan una sola vez. Mismas coordenadas normalizadas que la interfaz.
  for (const region of caso.regiones) {
    if (![region.x, region.y, region.rx, region.ry].every(Number.isFinite) || region.rx <= 0 || region.ry <= 0 || region.x - region.rx < 0 || region.y - region.ry < 0 || region.x + region.rx > 1 || region.y + region.ry > 1) throw new Error("La región de ejemplo no es válida.");
    const x = imagenX + region.x * imagenW, y = PAGINA.alto - imagenY - region.y * imagenH;
    const rx = region.rx * imagenW, ry = region.ry * imagenH, k = .55228475;
    comandos.push(`q 1 .79 .28 RG 1.8 w ${x + rx} ${y} m ${x + rx} ${y + k * ry} ${x + k * rx} ${y + ry} ${x} ${y + ry} c ${x - k * rx} ${y + ry} ${x - rx} ${y + k * ry} ${x - rx} ${y} c ${x - rx} ${y - k * ry} ${x - k * rx} ${y - ry} ${x} ${y - ry} c ${x + k * rx} ${y - ry} ${x + rx} ${y - k * ry} ${x + rx} ${y} c S Q`);
  }
  texto(`EJEMPLO ${numeroCaso}`, contexto.x, 211, 8, true, COLORES.turquesa);
  let contextoY = parrafo(caso.titulo, contexto.x, 234, contexto.w, 14, 18, true, COLORES.tinta) + 6;
  contextoY = parrafo(caso.resumen, contexto.x, contextoY, contexto.w, 9.4, 13) + 8;
  linea(contexto.x, contextoY, contexto.w);
  contextoY += 17;
  contextoY = parrafo(caso.regiones.length ? "El contorno señala una referencia visual educativa. No confirma una enfermedad." : "Ejemplo sin regiones señaladas. No determina el estado de salud de una persona.", contexto.x, contextoY, contexto.w, 9, 12.5);
  if (vertical) parrafo("La fotografía es una referencia educativa reutilizada con su licencia. Las observaciones están preparadas de antemano; no se realiza inferencia clínica.", contexto.x, contextoY + 11, contexto.w, 9, 12.5);
  texto(referenciaPendiente ? "Referencia editorial. Fotografía clínica pendiente de autorización." : "Fotografía de referencia. No pertenece a un paciente de DentaIA.", 38, 412, 7.6, false, COLORES.secundario);

  texto("01", 38, 441, 9, true, COLORES.turquesa);
  texto("Qué muestra este ejemplo", 61, 441, 14, true);
  let observacionY = 463;
  for (const observacion of caso.observaciones) {
    caja(39, observacionY - 4, 3, 3, COLORES.turquesa);
    observacionY = parrafo(observacion, 51, observacionY, 502, 9.5, 13) + 7;
  }
  if (observacionY > 523) throw new Error("Las observaciones exceden el espacio disponible.");
  texto("02", 38, 537, 9, true, COLORES.turquesa);
  texto("Pequeños hábitos, mejor cuidado", 61, 537, 14, true);
  for (let i = 0; i < caso.recomendaciones.length; i++) {
    if (i > 2) throw new Error("El reporte admite tres recomendaciones por ejemplo.");
    const x = 38 + i * 178;
    caja(x, 552, 163, 96, COLORES.fondo);
    texto(`0${i + 1}`, x + 12, 572, 9, true, COLORES.turquesa);
    const finalY = parrafo(caso.recomendaciones[i], x + 12, 591, 139, 9.2, 12.8);
    if (finalY > 647) throw new Error("Una recomendación excede el espacio disponible.");
  }
  caja(38, 665, 519, 76, COLORES.claro);
  texto("Tu siguiente paso es una elección", 51, 685, 12, true);
  texto("Mantén tus hábitos y considera una evaluación odontológica si lo necesitas.", 51, 703, 9.2, false, COLORES.secundario);
  texto("Explorar odontólogos de demostración", 51, 724, 10, true, COLORES.turquesa);
  texto("dent-ai-five.vercel.app/directorio", 360, 724, 8, false, COLORES.turquesa);
  linea(38, 758, 519);
  texto("No representa un diagnóstico ni reemplaza una evaluación odontológica.", 38, 776, 8.5, true);
  texto(`Caso: ${caso.id} | DentaIA`, 38, 792, 7.5, false, COLORES.secundario);
  texto("1 / 1", 534, 792, 8, false, COLORES.secundario);
  if (credito) {
    const cambiosPDF = referenciaPendiente ? "" : ` · En este PDF: reescalado${caso.regiones.length ? " y contorno educativo" : ""}.`;
    const lineas = envolver(`${referenciaPendiente ? "Imagen" : "Fotografía"}: ${credito}${cambiosPDF}`, 519, 6.4);
    if (lineas.length > 2) throw new Error("La atribución fotográfica excede el pie del reporte.");
    lineas.forEach((l, i) => texto(l, 38, 808 + i * 8, 6.4, false, COLORES.secundario));
  }

  if (!referenciaPendiente && caso.fuente) texto("Fuente original", 38, 827, 7.2, true, COLORES.turquesa);
  if (!referenciaPendiente && caso.licenciaUrl) texto("Licencia de la fotografía", 147, 827, 7.2, true, COLORES.turquesa);

  const contenido = bytes(comandos.join("\n"));
  const objetos: Uint8Array[] = [
    bytes("<< /Type /Catalog /Pages 2 0 R >>"),
    bytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 7 0 R /Annots [${enlaces.map((_, i) => `${8 + i} 0 R`).join(" ")}] >>`),
    bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
    bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),
    unir([bytes(`<< /Type /XObject /Subtype /Image /Width ${ancho} /Height ${alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imagenJpeg.length} >>\nstream\n`), imagenJpeg, bytes("\nendstream")]),
    unir([bytes(`<< /Length ${contenido.length} >>\nstream\n`), contenido, bytes("\nendstream")]),
    ...enlaces.map(enlace => bytes(`<< /Type /Annot /Subtype /Link /Rect [${enlace.rect}] /Border [0 0 0] /A << /S /URI /URI (${seguro(enlace.url)}) >> >>`)),
  ];
  const partes = [bytes("%PDF-1.4\n%âãÏÓ\n")], offsets = [0];
  let offset = partes[0].length;
  objetos.forEach((objeto, i) => {
    offsets.push(offset);
    const bloque = unir([bytes(`${i + 1} 0 obj\n`), objeto, bytes("\nendobj\n")]);
    partes.push(bloque); offset += bloque.length;
  });
  partes.push(bytes(`xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
  return unir(partes);
}

/** Una sola fuente de bytes para la vista previa y la descarga. */
export async function prepararReporte(caso: CasoDemo, fecha = new Date()): Promise<Uint8Array> {
  const imagen = new Image();
  imagen.src = caso.imagen;
  await imagen.decode();
  const escala = Math.min(1, 1600 / Math.max(imagen.naturalWidth, imagen.naturalHeight));
  const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
  const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));
  const canvas = document.createElement("canvas"); canvas.width = ancho; canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El reporte no está disponible en este navegador.");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, ancho, alto); ctx.drawImage(imagen, 0, 0, ancho, alto);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("No se pudo preparar la imagen del reporte.")), "image/jpeg", .94));
  return crearPDF(caso, fecha, new Uint8Array(await blob.arrayBuffer()), ancho, alto);
}

export async function descargarReporte(caso: CasoDemo, contenido?: Uint8Array): Promise<void> {
  const pdf = contenido ?? await prepararReporte(caso);
  const url = URL.createObjectURL(new Blob([Uint8Array.from(pdf).buffer], { type: "application/pdf" }));
  const enlace = document.createElement("a");
  enlace.href = url; enlace.download = `DentaIA-${caso.id}.pdf`;
  document.body.append(enlace); enlace.click(); enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
