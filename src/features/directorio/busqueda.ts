import type { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { crearIndiceBm25 } from "@/lib/busqueda/bm25";
import { CATALOGO_DEMO, completarCatalogoDemo } from "./catalogo-demo";
import type { PuntoGeografico } from "./geolocalizacion";
import { perfilesQa } from "./qa-preview";
import type { DemoLocationPublica, Dentista, DentistaDirectorio, UbicacionPublica } from "./tipos";

export type OrdenDirectorio = "nombre" | "cercania" | "calificacion";
type Consulta = {
  texto: string; distrito: string; especialidad: string; orden: OrdenDirectorio;
  pagina: number; ubicacion: PuntoGeografico | null; radio: number | undefined;
};
type Fila = {
  id: string; dentista: Dentista | null; referencia: DemoLocationPublica | null;
  ubicaciones: UbicacionPublica[]; promedio: number | null; totalResenas: number;
};
type Respuesta = {
  items: Fila[]; distritos: string[]; especialidades: string[]; totalCatalogo: number;
  total: number; pagina: number; tamano: number; hayUbicaciones: boolean; hayResenas: boolean;
};
export type PaginaDirectorio = Omit<Respuesta, "items"> & {
  dentistas: DentistaDirectorio[];
  demos: DemoLocationPublica[];
  resenas: Record<string, { total: number; promedio: number | null }>;
  catalogoDisponible: boolean;
};

const TAMANO = 24;
const demosLocales = [...completarCatalogoDemo([]), ...perfilesQa()].sort((a, b) => a.name.localeCompare(b.name, "es"));
const metadatosDemo = new Map(CATALOGO_DEMO.map(d => [d.id, d]));
const buscarDemos = crearIndiceBm25(demosLocales, d => {
  const meta = metadatosDemo.get(d.id);
  return [{ texto: d.name, peso: 3 }, { texto: d.specialty, peso: 2.5 },
    { texto: meta?.serviciosIlustrativos.join(" ") ?? "", peso: 2 },
    { texto: [d.district, meta?.practice_address].filter(Boolean).join(" "), peso: 1 }];
});

export function buscarDirectorioDemo(consulta: Consulta): PaginaDirectorio {
  const resultados = buscarDemos(consulta.texto, d => !consulta.radio
    && (!consulta.distrito || d.district === consulta.distrito)
    && (!consulta.especialidad || d.specialty === consulta.especialidad));
  const pagina = Math.min(consulta.pagina, Math.max(1, Math.ceil(resultados.length / TAMANO)));
  return { total: resultados.length, pagina, tamano: TAMANO, totalCatalogo: demosLocales.length,
    dentistas: resultados.slice((pagina - 1) * TAMANO, pagina * TAMANO), demos: [], resenas: {},
    distritos: [...new Set(demosLocales.map(d => d.district))],
    especialidades: [...new Set(demosLocales.map(d => d.specialty))],
    hayUbicaciones: false, hayResenas: false, catalogoDisponible: false };
}

export async function buscarDirectorio(client: ReturnType<typeof getSupabaseBrowserClient>, consulta: Consulta, signal: AbortSignal): Promise<PaginaDirectorio> {
  const origen = consulta.radio || consulta.orden === "cercania" ? consulta.ubicacion : null;
  const { data, error } = await client.rpc("dentaia_buscar_directorio", {
    p_query: consulta.texto, p_district: consulta.distrito, p_specialty: consulta.especialidad,
    p_order: consulta.orden, p_page: consulta.pagina, p_size: TAMANO,
    p_lat: origen?.latitude, p_lon: origen?.longitude, p_radius: consulta.radio,
  }).abortSignal(AbortSignal.any([signal, AbortSignal.timeout(8000)])).retry(false);
  if (error || !data || typeof data !== "object" || !("items" in data) || !Array.isArray(data.items)) {
    throw new Error("El directorio no está disponible.");
  }
  const { items, ...respuesta } = data as unknown as Respuesta;
  const demos = items.flatMap(item => item.referencia ? [item.referencia] : []);
  const fichas = new Map([...completarCatalogoDemo(demos), ...perfilesQa()].map(d => [d.id, d]));
  const dentistas = items.flatMap(item => item.dentista ? [{ ...item.dentista, ubicaciones: item.ubicaciones }]
    : fichas.has(item.id) ? [fichas.get(item.id)!] : []);
  const resenas = Object.fromEntries(items.map(item => [item.id, { total: item.totalResenas, promedio: item.promedio }]));
  return { ...respuesta, dentistas, demos, resenas, catalogoDisponible: true };
}
