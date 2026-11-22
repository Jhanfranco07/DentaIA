"use client";

import Link from "next/link";
import { guardarPreferenciaAvisos, leerPreferenciaAvisos, leerHorarioAvisos, guardarHorarioAvisos, normalizarHorario, type HorarioAvisos } from "./configuracionAvisos";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icono } from "@/components/Identidad";
import { useSesion } from "@/features/cuenta/useSesion";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { marcarActividadRutina, leerHistorialRutinas, leerRutinaDelDia, type EstadoDiaRutina } from "./datos";
import { fechaHoyLima, progresoDelDia, progresoHistorial, type MarcaRutina, type IntervaloAsignacion } from "./modelo";
import type { PlanCatalogo } from "./contrato";
import SeguimientoRutinasPaciente from "./SeguimientoRutinasPaciente";
import styles from "./rutinas.module.css";

const MOMENTOS = [
  { clave: "morning", titulo: "Por la mañana" },
  { clave: "daytime", titulo: "Durante el día" },
  { clave: "evening", titulo: "Por la noche" },
] as const;
const formateadorFecha = new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeZone: "America/Lima" });

export default function RutinasPaciente() {
  const { usuario } = useSesion();
  const [hoy, setHoy] = useState(() => fechaHoyLima());
  const [fecha, setFecha] = useState(hoy);
  const [dia, setDia] = useState<EstadoDiaRutina | null>(null);
  const [marcas, setMarcas] = useState<MarcaRutina[]>([]);
  const [catalogo, setCatalogo] = useState<PlanCatalogo[]>([]);
  const [asignaciones, setAsignaciones] = useState<IntervaloAsignacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [avisosHabilitados, setAvisosHabilitados] = useState(true);
  const [horarioAvisos, setHorarioAvisos] = useState<HorarioAvisos>(() => normalizarHorario(null));
  useEffect(() => { if (usuario?.id) { setAvisosHabilitados(leerPreferenciaAvisos(usuario.id)); setHorarioAvisos(leerHorarioAvisos(usuario.id)); } }, [usuario?.id]);
  const esHoy = fecha === hoy;
  const pendientes = (dia?.actividades ?? []).filter(a => !dia?.completadas.includes(a.id));
  const siguiente = pendientes[0];
  const guiaPorActividad = (clave: string) => clave.includes("interdental") || clave.includes("hilo") ? "hilo" : clave.includes("cepillado") ? "cepillado" : null;
  useEffect(() => {
    const actualizar = () => setHoy(fechaHoyLima());
    window.addEventListener("focus", actualizar);
    window.addEventListener("visibilitychange", actualizar);
    const intervalo = window.setInterval(actualizar, 60000);
    return () => {
      window.removeEventListener("focus", actualizar);
      window.removeEventListener("visibilitychange", actualizar);
      window.clearInterval(intervalo);
    };
  }, []);

  const cargar = useCallback(async (activo: () => boolean = () => true) => {
    if (!usuario?.id) { if (activo()) { setDia(null); setMarcas([]); setCatalogo([]); setAsignaciones([]); setCargando(false); } return; }
    setCargando(true); setError(""); setDia(null); setMarcas([]); setCatalogo([]); setAsignaciones([]);
    try {
      const cliente = getSupabaseBrowserClient();
      const [estado, historial] = await Promise.all([
        leerRutinaDelDia(cliente, usuario.id, fecha),
        leerHistorialRutinas(cliente, usuario.id),
      ]);
      if (activo()) { setDia(estado); setMarcas(historial.marcas); setCatalogo(historial.catalogo); setAsignaciones(historial.asignaciones); }
    } catch {
      if (activo()) { setDia(null); setError("No pudimos cargar tus rutinas. Comprueba tu conexión e inténtalo otra vez."); }
    } finally { if (activo()) setCargando(false); }
  }, [usuario?.id, fecha, intento]);

  useEffect(() => {
    let activo = true;
    void cargar(() => activo);
    return () => { activo = false; };
  }, [cargar]);

  const progreso = progresoDelDia(dia?.actividades.length ?? 0,
    (dia?.actividades ?? []).filter(actividad => dia?.completadas.includes(actividad.id))
      .map(actividad => ({ activity_id: actividad.id, plan_id: dia?.plan?.id ?? "", completion_date: fecha })));
  const historial = useMemo(() => progresoHistorial(catalogo, marcas, asignaciones), [catalogo, marcas, asignaciones]);
  const diasCompletos = historial.filter(d => d.progreso && d.progreso.total > 0 && d.progreso.completadas === d.progreso.total).length;

  async function alternar(actividadId: string, completada: boolean) {
    if (!usuario || !dia?.plan || !esHoy || guardando) return;
    setGuardando(actividadId); setError("");
    try {
      await marcarActividadRutina(getSupabaseBrowserClient(), usuario.id, dia.plan.id, actividadId, completada);
      await cargar();
      window.dispatchEvent(new Event("dentaia:rutina-actualizada"));
    } catch {
      setError("No se pudo guardar el cambio. Tu progreso no se actualizó; puedes volver a intentarlo.");
    } finally { setGuardando(null); }
  }

  return <section className={styles.pagina} aria-labelledby="rutinas-titulo">
    <header className={styles.encabezado}>
      <span className={styles.etiqueta}><Icono nombre="escudo" size={17} /> MI CUIDADO DENTAL</span>
      <h1 id="rutinas-titulo">Mis rutinas</h1>
      <p>Registra tus hábitos, aprende con las guías y revisa tu progreso. Las propuestas educativas se activan únicamente después de tu aceptación; no reemplazan un tratamiento odontológico.</p>
    </header>

    <div className={styles.resumen} aria-label="Resumen de actividades">
      <div><span>Avance de hoy</span><strong>{!cargando && dia?.plan && esHoy ? progreso.porcentaje + "%" : "—"}</strong><small>Actividades registradas</small></div>
      <div><span>Días con registros</span><strong>{cargando ? "—" : historial.length}</strong><small>Historial disponible</small></div>
      <div><span>Días completos</span><strong>{cargando ? "—" : diasCompletos}</strong><small>Según cada plan vigente</small></div>
    </div>
    {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => setIntento(n => n + 1)}>Volver a cargar</button></div>}
    <div className={styles.columnas}>
      <div className={styles.principal}>
        <section className={styles.tarjeta} aria-labelledby="rutina-dia-titulo">
          <div className={styles.tituloFila}>
            <div><span className={styles.sobrelinea}>{dia?.origen === "personalizado" ? "PLAN EDUCATIVO ACEPTADO" : "HÁBITOS PREVENTIVOS"}</span><h2 id="rutina-dia-titulo">{dia?.plan?.title ?? "Rutina del día"}</h2></div>
            <div className={styles.fechaAcciones}>
            {!esHoy && <button type="button" className={styles.volverHoy} onClick={() => setFecha(hoy)}>Volver a hoy</button>}
            <label className={styles.selectorFecha}>Fecha
              <input type="date" value={fecha} max={hoy} onChange={evento => setFecha(evento.target.value)} aria-label="Elegir fecha de rutina" />
            </label></div>
          </div>
          {cargando ? <p className={styles.estado} role="status">Cargando tus actividades…</p> : error ?
            <p className={styles.estado} role="status">Tus actividades no están disponibles hasta recuperar la conexión.</p> : !dia?.plan ?
            <div className={styles.vacio}><strong>No hay una rutina disponible para esta fecha.</strong><p>Vuelve a consultar más tarde o elige otro día del historial.</p><button type="button" onClick={() => setIntento(n => n + 1)}>Reintentar</button></div> : <>
              <p className={styles.descripcion}>{dia.plan.description}</p>
              <div className={styles.progreso} aria-label={`Progreso diario: ${progreso.completadas} de ${progreso.total} actividades`}>
                <div className={styles.progresoTexto}><strong>Tu progreso</strong><span>{progreso.completadas} de {progreso.total} actividades · {progreso.porcentaje}%</span></div>
                <div className={styles.barra} role="progressbar" aria-valuemin={0} aria-valuemax={Math.max(progreso.total, 1)} aria-valuenow={progreso.completadas} aria-valuetext={`${progreso.porcentaje}% completado`}><span style={{ width: `${progreso.porcentaje}%` }} /></div>
              </div>
              {esHoy && <div className={styles.siguiente}>
                <div><span className={styles.sobrelinea}>SIGUIENTE PASO</span>
                  <strong>{siguiente ? siguiente.title : "¡Rutina completada!"}</strong>
                  <p>{siguiente ? "Te quedan " + pendientes.length + " actividades por registrar. Márcalas solo después de realizarlas." : "Todas las actividades de hoy están registradas."}</p>
                </div>
                {siguiente && guiaPorActividad(siguiente.activity_key) && <Link href={"/buenas-practicas?guia=" + guiaPorActividad(siguiente.activity_key)}>Ver cómo hacerlo ↗</Link>}
              </div>}
              {!esHoy && <p className={styles.soloLectura} role="status">El historial se consulta en modo de solo lectura.</p>}
              {MOMENTOS.map(momento => {
                const actividades = dia.actividades.filter(actividad => actividad.time_of_day === momento.clave);
                if (!actividades.length) return null;
                return <section className={styles.grupo} key={momento.clave} aria-labelledby={`grupo-${momento.clave}`}>
                  <h3 id={`grupo-${momento.clave}`}>{momento.titulo}</h3>
                  <ul>{actividades.map(actividad => {
                    const marcada = dia.completadas.includes(actividad.id);
                    return <li key={actividad.id} className={marcada ? styles.actividadHecha : styles.actividad}>
                      <label><input type="checkbox" checked={marcada} disabled={!esHoy || !!guardando || cargando}
                        onChange={evento => void alternar(actividad.id, evento.target.checked)} aria-label={`${marcada ? "Desmarcar" : "Marcar"}: ${actividad.title}`} />
                        <span className={styles.actividadTexto}><strong>{actividad.title}</strong><span>{actividad.description}</span></span>
                      </label>
                      {guiaPorActividad(actividad.activity_key) && <Link className={styles.enlaceGuia} href={"/buenas-practicas?guia=" + guiaPorActividad(actividad.activity_key)}>Consultar guía ↗</Link>}
                      {guardando === actividad.id && <span className={styles.guardando} role="status">Guardando…</span>}
                    </li>;
                  })}</ul>
                </section>;
              })}
            </>}
        </section>
        <SeguimientoRutinasPaciente />
        <section className={styles.ajustesAvisos} aria-labelledby="avisos-rutina-titulo">
          <div><h2 id="avisos-rutina-titulo">Avisos de Denti</h2>
            <p>Permite que Denti te salude y recuerde tus actividades cuando utilices DentaIA. No enviamos notificaciones fuera de la aplicación.</p>
          </div>
          <label><input type="checkbox" checked={avisosHabilitados} onChange={evento => {
            setAvisosHabilitados(evento.target.checked);
            if (usuario?.id) guardarPreferenciaAvisos(usuario.id, evento.target.checked);
          }} /> Activar avisos flotantes</label>
          {avisosHabilitados && <div className={styles.horariosAvisos}>
            <p>Configura desde qué hora Denti puede mostrarte recordatorios. Solo aparecen cuando usas DentaIA.</p>
            {([["manana", "Mañana"], ["tarde", "Tarde"], ["noche", "Noche"]] as const).map(([momento, titulo]) => <label key={momento}>{titulo}
              <input type="time" value={horarioAvisos[momento]} onChange={evento => {
                const nuevo = normalizarHorario({ ...horarioAvisos, [momento]: evento.target.value });
                setHorarioAvisos(nuevo);
                if (usuario?.id) guardarHorarioAvisos(usuario.id, nuevo);
              }} />
            </label>)}
            <label>Frecuencia
              <select value={horarioAvisos.frecuencia} onChange={evento => {
                const nuevo = { ...horarioAvisos, frecuencia: evento.target.value as HorarioAvisos["frecuencia"] };
                setHorarioAvisos(nuevo);
                if (usuario?.id) guardarHorarioAvisos(usuario.id, nuevo);
              }}>
                <option value="por_momento">Una vez por momento del día</option>
                <option value="una_vez">Una vez al día</option>
              </select>
            </label>
          </div>}
        </section>
        <p className={styles.nota}>Las rutinas se basan en actividades preventivas. La selección aceptada por ti no constituye tratamiento ni se genera automáticamente a partir de fotografías.</p>
      </div>

      <aside className={styles.historial} aria-labelledby="historial-titulo">
        <span className={styles.sobrelinea}>SEGUIMIENTO PERSONAL</span><h2 id="historial-titulo">Historial</h2>
        <p>Consulta los días en que registraste actividades.</p>
        {cargando && marcas.length === 0 ? <p className={styles.estado} role="status">Cargando historial…</p> : historial.length === 0 ?
          <p className={styles.historialVacio}>Todavía no hay actividades registradas. Cuando marques una, aparecerá aquí.</p> :
          <ul>{historial.map(({ fecha: diaHistorial, progreso: dato }) => <li key={diaHistorial}>
            <button type="button" className={fecha === diaHistorial ? styles.historialActivo : styles.historialDia}
              aria-pressed={fecha === diaHistorial} onClick={() => setFecha(diaHistorial)}>
              <span><strong>{formateadorFecha.format(new Date(`${diaHistorial}T12:00:00-05:00`))}</strong><small>{dato ? `${dato.completadas} de ${dato.total} actividades` : "Versión del plan no disponible"}</small></span><b>{dato ? `${dato.porcentaje}%` : "—"}</b>
            </button>
          </li>)}</ul>}
      </aside>
    </div>
  </section>;
}
