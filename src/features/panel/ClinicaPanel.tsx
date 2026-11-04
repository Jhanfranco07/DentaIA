"use client";
import { useEffect, useState } from "react";
import { useSesion } from "@/features/cuenta/useSesion";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { leerClinicaPropia, ErrorClinicaPanel, type ClinicaPropia } from "./clinica";
import EstadoPanel from "./EstadoPanel";
import styles from "./panel.module.css";

type Estado = { id: string; datos: ClinicaPropia } | { id: string; error: number } | null;
const ESTADOS = { vigente: "Vigente", vencido: "Expirada", revocado: "Revocada" };
export default function ClinicaPanel() {
  const { usuario, cargando, errorSesion } = useSesion(), id = usuario?.id ?? null;
  const [estado, setEstado] = useState<Estado>(null), [intento, setIntento] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let vigente = true;
    setEstado(null);
    if (id) void (async () => {
      try {
        const { data, error } = await getSupabaseBrowserClient().auth.getSession();
        if (error || data.session?.user.id !== id) throw new ErrorClinicaPanel(401);
        const datos = await leerClinicaPropia(data.session.access_token, fetch, controller.signal);
        if (vigente) setEstado({ id, datos });
      } catch (e) { if (vigente) setEstado({ id, error: e instanceof ErrorClinicaPanel ? e.status : 503 }); }
    })();
    return () => { vigente = false; controller.abort(); };
  }, [id, intento]);
  if (cargando) return <EstadoPanel tipo="cargando" titulo="Comprobando acceso clínico…" />;
  if (!id || errorSesion) return null;
  if (!estado || estado.id !== id) return <EstadoPanel tipo="cargando" titulo="Consultando autorizaciones e historial propios…" />;
  if ("error" in estado) return <EstadoPanel tipo="error" titulo="Lectura clínica no disponible." accion={<button type="button" className={styles.boton} onClick={() => setIntento(n => n + 1)}>Reintentar lectura clínica</button>}>
    {estado.error === 401 ? "La sesión debe verificarse de nuevo en Mi cuenta." : estado.error === 403 ? "Tu sesión no tiene permiso para esta lectura." : estado.error === 404 || estado.error === 503 ? "El servicio está cerrado o no disponible en este entorno. No se muestran datos simulados." : "No se pudo comprobar la respuesta del servicio."}
  </EstadoPanel>;
  return <section className={styles.resumen} aria-labelledby="clinica-propia-titulo">
    <h2 id="clinica-propia-titulo">Autorizaciones e historial académico</h2>
    <p>Datos sintéticos leídos de Supabase con permisos reales. No son el reporte preventivo de demostración ni el historial de solicitudes.</p>
    <h3>Autorizaciones clínicas</h3>
    {estado.datos.autorizaciones.length ? <ul>{estado.datos.autorizaciones.map(a => <li key={a.id}>{ESTADOS[a.estado]} · vence <time dateTime={a.vence}>{new Date(a.vence).toLocaleDateString("es-PE")}</time></li>)}</ul> : <p>No tienes autorizaciones registradas.</p>}
    <h3>Atenciones propias</h3>
    {estado.datos.atenciones.length ? <ul>{estado.datos.atenciones.map(a => <li key={a.id}>{a.clinica} · <time dateTime={a.fecha}>{new Date(a.fecha).toLocaleDateString("es-PE")}</time></li>)}</ul> : <p>No hay atenciones registradas.</p>}
    {estado.datos.hayMas && <p>Se muestran hasta 50 elementos por sección; existen más registros.</p>}
  </section>;
}
