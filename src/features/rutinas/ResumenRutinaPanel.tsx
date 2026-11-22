"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSesion } from "@/features/cuenta/useSesion";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { leerRutinaDelDia, type EstadoDiaRutina } from "@/features/rutinas/datos";
import { fechaHoyLima } from "@/features/rutinas/modelo";

export default function ResumenRutinaPanel() {
  const { usuario } = useSesion();
  const [estado, setEstado] = useState<EstadoDiaRutina | null>(null);
  const [situacion, setSituacion] = useState<"cargando" | "listo" | "error">("cargando");

  useEffect(() => {
    let vigente = true;
    setEstado(null);
    if (!usuario?.id) { setSituacion("error"); return; }
    const refrescar = async () => {
      try {
        const resultado = await leerRutinaDelDia(getSupabaseBrowserClient(), usuario.id, fechaHoyLima());
        if (vigente) { setEstado(resultado); setSituacion("listo"); }
      } catch { if (vigente) { setEstado(null); setSituacion("error"); } }
    };
    setSituacion("cargando");
    void refrescar();
    const visible = () => { if (document.visibilityState === "visible") void refrescar(); };
    window.addEventListener("focus", visible);
    window.addEventListener("dentaia:rutina-actualizada", visible);
    return () => {
      vigente = false;
      window.removeEventListener("focus", visible);
      window.removeEventListener("dentaia:rutina-actualizada", visible);
    };
  }, [usuario?.id]);

  const total = estado?.actividades.length ?? 0;
  const hechas = estado?.actividades.filter(a => estado.completadas.includes(a.id)).length ?? 0;
  const porcentaje = total > 0 ? Math.round(hechas / total * 100) : 0;
  return <section aria-label="Resumen de tu rutina dental" style={{
    border: "1px solid #cde4e6", borderRadius: 18, background: "linear-gradient(120deg,#f2faf9,#fff)",
    padding: 20, color: "#163e4c", marginBottom: 18,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 12 }}>
      <div><span style={{ color: "#087f8c", fontWeight: 800, fontSize: 11, letterSpacing: ".08em" }}>MI CUIDADO DENTAL</span>
        <h2 style={{ margin: "6px 0", fontSize: 20 }}>Tu rutina de hoy</h2>
        {situacion === "cargando" ? <p role="status">Consultando tus actividades…</p> :
          situacion === "error" ? <p>No pudimos consultar tus actividades en este momento.</p> :
            total === 0 ? <p>No hay un plan preventivo disponible para hoy.</p> :
              <p>{hechas === total ? "¡Todas tus actividades están registradas!" : `Has registrado ${hechas} de ${total} actividades.`}</p>}
      </div>
      <Link href="/paciente/rutinas" style={{ background: "#086f7c", color: "#fff", padding: "11px 15px", borderRadius: 11, textDecoration: "none", fontWeight: 750, fontSize: 12 }}>Ver mis rutinas ↗</Link>
    </div>
    {situacion === "listo" && total > 0 && <div style={{ marginTop: 14 }}>
      <div role="progressbar" aria-label="Progreso de la rutina de hoy" aria-valuemin={0} aria-valuemax={total} aria-valuenow={hechas}
        style={{ background: "#dcecea", height: 9, borderRadius: 20, overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(90deg,#087f8c,#4cb6ac)", width: `${porcentaje}%`, height: "100%" }} />
      </div>
      <small style={{ display: "block", color: "#4d6c78", marginTop: 7 }}>{porcentaje}% registrado · rutina preventiva general</small>
    </div>}
  </section>;
}
