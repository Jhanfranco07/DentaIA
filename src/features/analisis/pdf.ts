import type { CasoDemo } from "./casos";

// PDF 1.4 con Helvetica/WinAnsi e imagen JPEG. Se comparte entre navegador y pruebas.
// Solo recibe casos verificados; no consulta servicios, cuentas ni historiales.
export function crearPDF(caso: CasoDemo, fecha: Date, imagenJpeg: Uint8Array, ancho: number, alto: number): Uint8Array {
  if (!Number.isFinite(fecha.getTime()) || imagenJpeg[0] !== 0xff || imagenJpeg[1] !== 0xd8 || !Number.isInteger(ancho) || !Number.isInteger(alto) || ancho < 1 || alto < 1) throw new Error("No se pudo preparar el reporte.");
  const bytes = (texto: string) => Uint8Array.from(texto, c => c.charCodeAt(0) <= 255 ? c.charCodeAt(0) : c === "•" ? 149 : c === "—" || c === "–" ? 45 : 63);
  const unir = (partes: Uint8Array[]) => { const salida = new Uint8Array(partes.reduce((n,p) => n+p.length,0)); let pos=0; for(const p of partes){salida.set(p,pos);pos+=p.length;}return salida; };
  const seguro = (s: string) => s.replace(/[\r\n\t]/g," ").replace(/([\\()])/g,"\\$1");
  const comandos: string[] = [];
  const texto=(s:string,x:number,y:number,tamano=11,negrita=false,color="0.10 0.20 0.28") => comandos.push(`BT /${negrita?"F2":"F1"} ${tamano} Tf ${color} rg ${x} ${842-y} Td (${seguro(s)}) Tj ET`);
  const lineas=(s:string,max=88)=>{const ls:string[]=[];let l="";for(const palabra of s.split(" ")){if((l+" "+palabra).trim().length>max){ls.push(l);l=palabra;}else l=(l+" "+palabra).trim();}if(l)ls.push(l);return ls;};
  comandos.push("0.96 0.98 0.99 rg 0 0 595 842 re f", "1 1 1 rg 28 28 539 786 re f", "0.03 0.50 0.51 rg 44 771 32 32 re f");
  texto("D",53,61,18,true,"1 1 1"); texto("DentaIA",86,61,23,true);texto("REPORTE PREVENTIVO DE DEMOSTRACIÓN",44,96,9,true,"0.03 0.43 0.46");
  texto(caso.titulo,44,128,20,true); texto(`Generado el ${fecha.toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric",timeZone:"America/Lima"})}`,44,150,10);
  texto("Resultado simulado para fines académicos",44,174,11,true,"0.03 0.43 0.46");
  const imgH=507*alto/ancho;
  comandos.push(`q 507 0 0 ${imgH.toFixed(2)} 44 ${(842-194-imgH).toFixed(2)} cm /Im1 Do Q`);
  let y=194+imgH+24;
  texto("OBSERVACIONES ILUSTRATIVAS",44,y,10,true);y+=20;
  for(const p of caso.observaciones){for(const l of lineas(p)){texto(l,44,y,10);y+=14;}y+=4;}
  y+=10;texto("PARA TU CUIDADO COTIDIANO",44,y,10,true);y+=21;
  for(let i=0;i<caso.recomendaciones.length;i++){for(const l of lineas(`${i+1}. ${caso.recomendaciones[i]}`)){texto(l,44,y,10);y+=14;}y+=5;}
  if(y>744)throw new Error("El contenido del reporte excede el espacio disponible.");
  texto("Encontrar un odontólogo: dent-ai-five.vercel.app/directorio",44,735,10,true,"0.03 0.43 0.46");
  texto("No representa un diagnóstico ni reemplaza una evaluación odontológica.",44,771,9,true);texto(`Caso: ${caso.id} | DentaIA`,44,791,9);
  const contenido=bytes(comandos.join("\n"));
  const objetos:Uint8Array[]=[bytes("<< /Type /Catalog /Pages 2 0 R >>"),bytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),bytes("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 7 0 R /Annots [8 0 R] >>"),bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),unir([bytes(`<< /Type /XObject /Subtype /Image /Width ${ancho} /Height ${alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imagenJpeg.length} >>\nstream\n`),imagenJpeg,bytes("\nendstream")]),unir([bytes(`<< /Length ${contenido.length} >>\nstream\n`),contenido,bytes("\nendstream")]),bytes("<< /Type /Annot /Subtype /Link /Rect [44 95 551 121] /Border [0 0 0] /A << /S /URI /URI (https://dent-ai-five.vercel.app/directorio) >> >>")];
  const partes=[bytes("%PDF-1.4\n%âãÏÓ\n")];const offsets=[0];let offset=partes[0].length;
  objetos.forEach((obj,i)=>{offsets.push(offset);const bloque=unir([bytes(`${i+1} 0 obj\n`),obj,bytes("\nendobj\n")]);partes.push(bloque);offset+=bloque.length;});
  partes.push(bytes(`xref\n0 ${objetos.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")}trailer\n<< /Size ${objetos.length+1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`));return unir(partes);
}

export async function descargarReporte(caso: CasoDemo): Promise<void> {
  const imagen=new Image();imagen.src=caso.imagen;await imagen.decode();
  const canvas=document.createElement("canvas");canvas.width=1400;canvas.height=840;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("El reporte no está disponible en este navegador.");
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,1400,840);ctx.drawImage(imagen,0,0,1400,840);
  for(const r of caso.regiones){ctx.beginPath();ctx.ellipse(r.x*1400,r.y*840,r.rx*1400,r.ry*840,0,0,Math.PI*2);ctx.fillStyle="rgba(201,136,35,.16)";ctx.fill();ctx.strokeStyle="#a36512";ctx.lineWidth=5;ctx.stroke();}
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("No se pudo preparar la imagen del reporte.")),"image/jpeg",.94));
  const pdf=crearPDF(caso,new Date(),new Uint8Array(await blob.arrayBuffer()),1400,840);
  const url=URL.createObjectURL(new Blob([Uint8Array.from(pdf).buffer],{type:"application/pdf"}));
  const enlace=document.createElement("a");enlace.href=url;enlace.download=`DentaIA-${caso.id}.pdf`;document.body.append(enlace);enlace.click();enlace.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
