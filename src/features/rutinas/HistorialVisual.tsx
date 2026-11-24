"use client";

import { useMemo, useState } from "react";
import { Icono } from "@/components/Identidad";
import type { MarcaRutina, ProgresoRutina } from "./modelo";
import type { PlanCatalogo } from "./contrato";
import styles from "./rutinas.module.css";

type EntradaHistorial = { fecha: string; progreso: ProgresoRutina | null };
type Props = {
  fecha: string;
  hoy: string;
  registros: readonly MarcaRutina[];
  catalogo: readonly PlanCatalogo[];
  historial: readonly EntradaHistorial[];
  onFecha: (fecha: string) => void;
};

const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const fechaLocal = (fecha: string) => new Date(fecha + "T12:00:00-05:00");
const fechaClave = (fecha: Date) => {
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const moverDias = (fecha: string, dias: number) => {
  const d = fechaLocal(fecha);
  d.setDate(d.getDate() + dias);
  return fechaClave(d);
};

export default function HistorialVisual({ fecha, hoy, registros, catalogo, historial, onFecha }: Props) {
  const [semana, setSemana] = useState(fecha);
  const primerDia = useMemo(() => {
    const d = fechaLocal(semana);
    const lunes = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - lunes);
    return fechaClave(d);
  }, [semana]);
  const fechasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => moverDias(primerDia, i)), [primerDia]);
  const progresoPorFecha = useMemo(() => new Map(historial.map(h => [h.fecha, h.progreso])), [historial]);
  const nombres = useMemo(() => new Map(catalogo.flatMap(plan =>
    plan.activities.flatMap(a => a.id ? [[a.id, a.title] as const] : []))), [catalogo]);
  const registrosRecientes = useMemo(() => {
    const vistos = new Set<string>();
    return [...registros].sort((a, b) => b.completion_date.localeCompare(a.completion_date))
      .filter(marca => {
        const clave = marca.completion_date + ":" + marca.activity_id;
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      }).slice(0,4);
  }, [registros]);
  const mes = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "America/Lima" })
    .format(fechaLocal(fechasSemana[3]));
  const proximaSemana = moverDias(primerDia, 7);
  return <aside className={styles.historial} aria-labelledby="historial-titulo">
    <span className={styles.sobrelinea}><Icono nombre="reporte" size={16} /> SEGUIMIENTO PERSONAL</span>
    <h2 id="historial-titulo">Historial</h2>
    <p>Consulta y revisa tus actividades recientes.</p>
    <div className={styles.miniCalendario}>
      <div className={styles.calendarioCabecera}>
        <button type="button" aria-label="Semana anterior" onClick={() => setSemana(moverDias(primerDia,-7))}>‹</button>
        <strong>{mes}</strong>
        <button type="button" aria-label="Semana siguiente" disabled={proximaSemana > hoy} onClick={() => setSemana(proximaSemana)}>›</button>
      </div>
      <div className={styles.calendarioDias}>
        {fechasSemana.map((dia, i) => {
          const registro = progresoPorFecha.get(dia);
          const completo = Boolean(registro && registro.total > 0 && registro.completadas === registro.total);
          const parcial = Boolean(registro?.completadas && !completo);
          return <button key={dia} type="button" disabled={dia > hoy}
            aria-label={`${dia}. ${registro ? registro.completadas + " de " + registro.total + " actividades" : "Sin registros"}`}
            aria-pressed={dia===fecha}
            className={dia === fecha ? styles.calendarioSeleccionado : styles.calendarioDia}
            onClick={() => { onFecha(dia); setSemana(dia); }}>
            <small>{diasSemana[i]}</small>
            <strong>{Number(dia.slice(8))}</strong>
            <span aria-hidden="true" className={completo ? styles.marcaCompleta : parcial ? styles.marcaParcial : styles.marcaVacia}>
              {completo ? "✓" : parcial ? "•" : ""}
            </span>
          </button>;
        })}
      </div>
    </div>
    <div className={styles.actividadRecienteTitulo}>
      <h3>Actividad reciente</h3>
      <button type="button" onClick={() => { onFecha(hoy); setSemana(hoy); }}>Ver hoy <span aria-hidden="true">→</span></button>
    </div>
    {registrosRecientes.length===0
      ? <p className={styles.historialVacio}>Cuando registres tu primera actividad aparecerá aquí, junto con el calendario de tu progreso.</p>
      : <ul className={styles.listaReciente}>
        {registrosRecientes.map(marca => <li key={marca.completion_date + marca.activity_id}>
          <button type="button" onClick={() => { onFecha(marca.completion_date); setSemana(marca.completion_date); }}>
            <span className={styles.actividadRecienteIcono}><Icono nombre="diente" size={19}/></span>
            <span className={styles.actividadRecienteTexto}>
              <strong>{nombres.get(marca.activity_id) ?? "Actividad registrada"}</strong>
              <small>{marca.completion_date === hoy ? "Hoy" : new Intl.DateTimeFormat("es-PE", { day:"numeric", month:"short",timeZone:"America/Lima" }).format(fechaLocal(marca.completion_date))}</small>
            </span>
            <span className={styles.insigniaRegistrada}><Icono nombre="check" size={12}/> Registrada</span>
          </button>
        </li>)}
      </ul>}
    <p className={styles.historialNota}>El historial utiliza tus registros reales; no se generan actividades ni horarios ficticios.</p>
  </aside>;
}
