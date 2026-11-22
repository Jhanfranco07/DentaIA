"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { leerRutinaDelDia } from "@/features/rutinas/datos";
import { fechaHoyLima } from "@/features/rutinas/modelo";
import { avisoRutinaDenti, type AvisoDenti } from "./avisos";
import { GUIAS_BUCALES } from "@/features/buenas-practicas/contenido";
import { claveVentanaAviso, leerHorarioAvisos, leerPreferenciaAvisos, momentoAviso } from "@/features/rutinas/configuracionAvisos";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { detectarDestinoDenti, responderOrientacion, type DestinoDenti, type ObservacionAsistente, type RespuestaAsistente } from "./motor";
import styles from "./asistente.module.css";
import MascotaDenti from "./MascotaDenti";

type Mensaje = { id: number; pregunta?: string; respuesta: RespuestaAsistente; origen?: "llm" | "guiado" | "seguridad"; intentoIA?: boolean; destino?: DestinoDenti };
type Precio = { id: string; nombre: string; profesional: string; distrito: string; especialidad: string; demo: boolean; monto: number | null; moneda: string; slug: string };
type Fila = { id: string; name: string; price_amount: number | null; currency_code: string; dentist_id: string;
  dentists: { name: string; district: string; specialty: string; is_demo: boolean; is_active: boolean; slug: string } | null };
const EJEMPLOS = ["Guía de cepillado", "¿Cómo uso hilo dental?", "Preparar fotografía", "¿Por qué tengo dientes amarillos?"];
const SALUDO: RespuestaAsistente = {
  texto: "¡Hola! Soy Denti. Puedo llevarte a una guía o módulo con tu permiso, o responder aquí tus dudas generales sobre salud bucal. ¿Qué necesitas?",
  guias: [], especialidad: null, alerta: false, enlaces: [],
};
const filtrar = (texto: string) => texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function AsistentePaciente() {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [usarIA, setUsarIA] = useState(false);
  const [usuarioIA, setUsuarioIA] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoDenti | null>(null);
  const [pensando, setPensando] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([{ id: 0, respuesta: SALUDO }]);
  const [observacion, setObservacion] = useState<ObservacionAsistente | null>(null);
  const [precios, setPrecios] = useState<Precio[]>([]);
  const [preciosEstado, setPreciosEstado] = useState<"inicial" | "cargando" | "listo" | "error">("inicial");
  const cuerpo = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const activador = useRef<HTMLButtonElement>(null);
  const contador = useRef(1);
  const consultaActual = useRef(0);
  useEffect(() => {
    let activo = true;
    const cliente = getSupabaseBrowserClient();
    async function recuperarConsentimiento() {
      try {
        const { data } = await cliente.auth.getUser();
        if (!activo) return;
        const id = data.user?.id ?? null;
        setUsuarioIA(id);
        setUsarIA(id ? window.localStorage.getItem(`dentaia:denti:ia-consent:${id}`) === "true" : false);
      } catch { if (activo) { setUsuarioIA(null); setUsarIA(false); } }
    }
    void recuperarConsentimiento();
    const { data: escucha } = cliente.auth.onAuthStateChange(() => { void recuperarConsentimiento(); });
    return () => { activo = false; escucha.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let vigente = true;
    const cargarAviso = async () => {
      if (abierto) return;
      try {
        const cliente = getSupabaseBrowserClient();
        const { data } = await cliente.auth.getUser();
        if (!vigente || !data.user) return;
        if (!leerPreferenciaAvisos(data.user.id)) { setAviso(null); return; }
        const fecha = fechaHoyLima();
        const ahoraLima = new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Lima",
        }).format(new Date());
        const hora = Number(ahoraLima.slice(0, 2));
        const horario = leerHorarioAvisos(data.user.id);
        const momento = momentoAviso(ahoraLima, horario);
        let estado = null;
        try { estado = await leerRutinaDelDia(cliente, data.user.id, fecha); }
        catch { /* No mostramos progreso sin datos verificados. */ }
        if (!vigente) return;
        const siguiente = avisoRutinaDenti(hora, fecha, estado);
        const completada = Boolean(estado?.plan && estado.actividades.length > 0
          && estado.actividades.every(a => estado?.completadas.includes(a.id)));
        // Sin actividades, el saludo puede mostrarse una vez al día.
        // Con actividades pendientes, respetamos los horarios configurados.
        if (estado?.plan && estado.actividades.length > 0 && !completada && !momento) return;
        const claveLocal = estado?.plan && estado.actividades.length > 0
          ? claveVentanaAviso(fecha, horario, momento ?? "fin", completada)
          : "saludo:" + fecha;
        const clave = "denti:aviso:" + data.user.id + ":" + claveLocal;
        if (window.sessionStorage.getItem(clave) === "visto") return;
        window.sessionStorage.setItem(clave, "visto");
        setAviso(siguiente);
      } catch { /* Nunca mostramos datos de otro usuario. */ }
    };
    void cargarAviso();
    const alVolver = () => { if (document.visibilityState === "visible") void cargarAviso(); };
    window.addEventListener("focus", alVolver);
    window.addEventListener("dentaia:preferencia-avisos", alVolver);
    window.addEventListener("dentaia:rutina-actualizada", alVolver);
    const intervalo = window.setInterval(alVolver, 60_000);
    return () => { vigente = false; window.removeEventListener("focus", alVolver); window.removeEventListener("dentaia:preferencia-avisos", alVolver); window.removeEventListener("dentaia:rutina-actualizada", alVolver); window.clearInterval(intervalo); };
  }, [abierto]);
  function configurarIA(activar: boolean) {
    if (usuarioIA) {
      if (activar) window.localStorage.setItem(`dentaia:denti:ia-consent:${usuarioIA}`, "true");
      else window.localStorage.removeItem(`dentaia:denti:ia-consent:${usuarioIA}`);
    }
    setUsarIA(activar && !!usuarioIA);
  }

  useEffect(() => {
    const recibir = (evento: Event) => {
      const detalle = (evento as CustomEvent<ObservacionAsistente>).detail;
      if (!detalle || typeof detalle.evaluable !== "boolean"
        || ![detalle.variacionesColor, detalle.posiblesAusencias, detalle.posiblesApiñamientos].every(n => Number.isInteger(n) && n >= 0 && n <= 30)) return;
      setObservacion(detalle);
      setAbierto(true);
      setMensajes(prev => [...prev, { id: contador.current++, pregunta: "Orientarme con el resultado que acabo de compartir",
        respuesta: responderOrientacion("mis resultados de la evaluación", detalle) }]);
    };
    window.addEventListener("dentaia:asistente-resultado", recibir);
    return () => window.removeEventListener("dentaia:asistente-resultado", recibir);
  }, []);
  useEffect(() => {
    if (abierto) {
      entrada.current?.focus();
      cuerpo.current?.scrollTo({ top: cuerpo.current.scrollHeight, behavior: "smooth" });
    }
  }, [abierto]);
  useEffect(() => { if (abierto) cuerpo.current?.scrollTo({ top: cuerpo.current.scrollHeight, behavior: "smooth" }); }, [abierto, mensajes, preciosEstado]);

  async function consultarPrecios() {
    const secuencia = ++consultaActual.current;
    setPreciosEstado("cargando");
    try {
      const { data, error } = await getSupabaseBrowserClient().from("dentist_services")
        .select("id,name,price_amount,currency_code,dentist_id,dentists!inner(name,district,specialty,is_demo,is_active,slug)")
        .eq("is_active", true).eq("dentists.is_active", true).order("name").limit(60);
      if (error) throw error;
      if (secuencia !== consultaActual.current) return;
      const filas = (data ?? []) as unknown as Fila[];
      setPrecios(filas.filter(f => f.dentists?.is_active).map(f => ({
        id:f.id, nombre:f.name, profesional:f.dentists!.name, distrito:f.dentists!.district,
        especialidad:f.dentists!.specialty, demo:f.dentists!.is_demo, monto:f.price_amount,
        moneda:f.currency_code, slug:f.dentists!.slug,
      })));
      setPreciosEstado("listo");
    } catch {
      if (secuencia === consultaActual.current) setPreciosEstado("error");
    }
  }
  async function enviar(pregunta: string) {
    const limpia = pregunta.trim().slice(0, 500);
    if (!limpia || pensando) return;
    const destino = detectarDestinoDenti(limpia);
    const respuesta: RespuestaAsistente = destino
      ? { texto: `Encontré ${destino.tipo === "guia" ? "una guía" : "un espacio de DentaIA"} para ayudarte: ${destino.titulo}. ¿Quieres que te lleve allí?`, guias: [], enlaces: [], especialidad: null, alerta: false }
      : responderOrientacion(limpia, observacion);
    const id = contador.current++;
    const historial = mensajes.filter(m => m.pregunta).slice(-3).flatMap(m => [
      { rol: "usuario" as const, texto: m.pregunta ?? "" },
      { rol: "asistente" as const, texto: m.respuesta.texto },
    ]);
    const consultarIA = usarIA && !respuesta.alerta && !destino;
    // La respuesta de emergencia es inmediata y determinista. Para las consultas
    // con IA no mostramos una respuesta genérica y luego la reemplazamos.
    const temporal = consultarIA
      ? { ...respuesta, texto: "Estoy preparando una explicación para ti…", guias: [], enlaces: [] }
      : respuesta;
    setMensajes(prev => [...prev.slice(-19), { id, pregunta: limpia, respuesta: temporal, origen: consultarIA ? undefined : "guiado", intentoIA: consultarIA, destino: destino ?? undefined }]);
    setTexto("");
    if (respuesta.especialidad && /precio|costo|tarifa|cuanto|odontologo|dentista|profesional|limpieza|ortodoncia/.test(filtrar(limpia))) {
      void consultarPrecios();
    }
    if (!consultarIA) return;
    setPensando(true);
    const actualizar = (textoFinal: string, origen: Mensaje["origen"]) =>
      setMensajes(prev => prev.map(m => m.id === id
        ? { ...m, respuesta: { ...respuesta, texto: textoFinal }, origen } : m));
    try {
      const { data, error } = await getSupabaseBrowserClient().auth.getSession();
      if (error || !data.session) {
        actualizar(respuesta.texto, "guiado");
        return;
      }
      const res = await fetch("/api/asistente/chat", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ pregunta: limpia, historial, observacion }),
        signal: AbortSignal.timeout(16000),
      });
      if (!res.ok) {
        actualizar(respuesta.texto, "guiado");
        return;
      }
      const body: { texto?: unknown; origen?: unknown } = await res.json();
      if (typeof body.texto === "string" && body.texto.length > 0 && body.texto.length <= 1200
        && ["llm", "guiado", "seguridad"].includes(String(body.origen))) {
        actualizar(body.texto, body.origen as Mensaje["origen"]);
      } else {
        actualizar(respuesta.texto, "guiado");
      }
    } catch {
      // Si el modelo, la red o la cuota fallan, el usuario recibe orientación
      // educativa local. Nunca presentamos esa respuesta como generada por IA.
      actualizar(respuesta.texto, "guiado");
    } finally {
      setPensando(false);
    }
  }
  function submit(evento: FormEvent<HTMLFormElement>) { evento.preventDefault(); void enviar(texto); }
  const ultimo = mensajes.at(-1);
  const recomendados = precios.filter(p => !ultimo?.respuesta.especialidad
    || ultimo.respuesta.especialidad === "general"
    || filtrar(p.especialidad).includes(ultimo.respuesta.especialidad === "ortodoncia" ? "ortodoncia" : "periodoncia")).slice(0, 5);
  return <>
    <button ref={activador} type="button" className={styles.activador} onClick={() => { setAviso(null); setAbierto(a => !a); }}
      aria-expanded={abierto} aria-controls="asistente-dentaia" aria-label={abierto ? "Cerrar asistente DentaIA" : "Abrir asistente DentaIA"}>
      <MascotaDenti pequeno /><span>Habla con Denti</span>
    </button>
    {!abierto && aviso && <aside className={styles.avisoFlotante} role="status" aria-label="Aviso de Denti">
      <div className={styles.avisoIcono}><MascotaDenti pequeno /></div>
      <div className={styles.avisoTexto}>
        <strong>{aviso.titulo}</strong>
        <p>{aviso.texto}</p>
        {aviso.href && <Link href={aviso.href} onClick={() => setAviso(null)}>{aviso.accion ?? "Ver más"} <span aria-hidden="true">↗</span></Link>}
      </div>
      <button type="button" className={styles.cerrarAviso} aria-label="Descartar aviso de Denti" onClick={() => setAviso(null)}>✕</button>
    </aside>}
    {abierto && <section id="asistente-dentaia" className={styles.panel} role="dialog" aria-label="Asistente de cuidado bucal" aria-modal="false">
      <header className={styles.encabezado}><MascotaDenti pequeno pensando={pensando} /><div><strong>Denti ✦ Asistente inteligente</strong><small>{pensando ? "Preparando tu respuesta…" : "Tu guía personal dentro de DentaIA"}</small></div>
        <button type="button" aria-label="Cerrar asistente" onClick={() => setAbierto(false)}>✕</button>
      </header>
      <div className={styles.cuerpo} ref={cuerpo} role="log" aria-live="polite" aria-relevant="additions">
        {mensajes.map(m => <div className={styles.intercambio} key={m.id}>
          {m.pregunta && <p className={styles.pregunta}>{m.pregunta}</p>}
          <div className={m.respuesta.alerta ? styles.alerta : styles.respuesta}>
            {m.destino && <span className={styles.etiquetaDestino}>{m.destino.tipo === "guia" ? "GUÍA RECOMENDADA" : "ESPACIO RECOMENDADO"}</span>}
            <p>{m.respuesta.texto}</p>
            {m.destino && <div className={styles.accionesDestino}>
              <Link href={m.destino.href} onClick={() => setAbierto(false)}>Sí, ir ahora <span aria-hidden="true">↗</span></Link>
              <button type="button" onClick={() => setMensajes(prev => prev.map(item => item.id === m.id ? { ...item, destino: undefined, respuesta: { ...item.respuesta, texto: "Perfecto, seguimos aquí. ¿Qué más deseas consultar?" } } : item))}>Ahora no</button>
            </div>}
            {m.origen === "llm" && <small className={styles.origen}>Respuesta de IA · información educativa</small>}
            {m.origen === "guiado" && m.pregunta && m.intentoIA && !m.respuesta.alerta && <small className={styles.origen}>Respuesta local de respaldo: IA no disponible en esta consulta</small>}
            {m.respuesta.guias.length > 0 && <details className={styles.fuentes}>
              <summary>Ver fuentes de esta respuesta (opcional)</summary>
              <div className={styles.listaFuentes}>
                {m.respuesta.guias.map(id => {
                  const g = GUIAS_BUCALES.find(item => item.id === id);
                  return g ? <div className={styles.fuente} key={id}>
                    <strong>{g.titulo}</strong>
                    <a href={g.fuente.url} target="_blank" rel="noopener noreferrer">{g.fuente.nombre} ↗</a>
                  </div> : null;
                })}
                <Link href="/buenas-practicas" onClick={() => setAbierto(false)}>Consultar todas las guías (opcional) ↗</Link>
              </div>
            </details>}
            {m.respuesta.enlaces.length > 0 && <div className={styles.enlaces}>{m.respuesta.enlaces.map(enlace =>
              <Link key={enlace.href} href={enlace.href} onClick={() => setAbierto(false)}>{enlace.etiqueta} ↗</Link>)}</div>}
          </div>
        </div>)}
        {ultimo?.respuesta.especialidad && preciosEstado === "cargando" && <p className={styles.nota}>Consultando servicios publicados…</p>}
        {ultimo?.respuesta.especialidad && preciosEstado === "error" && <p className={styles.nota} role="alert">No pude cargar precios ahora. Consulta el directorio y verifica con cada profesional.</p>}
        {ultimo?.respuesta.especialidad && preciosEstado === "listo" && <div className={styles.recursos}>
          <strong>Servicios publicados</strong>
          <small>Precios informativos, sin confirmación de disponibilidad o reserva.</small>
          {recomendados.length ? recomendados.map(p => <div className={styles.guia} key={p.id}>
            <strong>{p.nombre}</strong><span>{p.profesional} · {p.distrito} · {p.especialidad}</span>
            <span>{p.monto === null ? "Precio a consultar" : p.moneda === "PEN" ? `S/ ${p.monto.toFixed(2)}` : `${p.moneda} ${p.monto.toFixed(2)}`}</span>
            {p.demo ? <small>Perfil de demostración; no es un profesional verificado ni admite citas reales.</small>
              : <Link href={`/directorio/${encodeURIComponent(p.slug)}`} onClick={() => setAbierto(false)}>Ver perfil</Link>}
          </div>) : <p className={styles.nota}>No hay servicios publicados para mostrar. No inventaré precios ni profesionales.</p>}
        </div>}
      </div>
      <div className={styles.pie}>
        {usarIA
          ? <div className={styles.estadoIA}><span aria-label="IA activada">✦ Conversación IA activada</span>
              <button type="button" disabled={pensando} onClick={() => configurarIA(false)}>Usar modo privado</button></div>
          : <div className={styles.invitacionIA}>
              <div><strong>Denti activo · IA conversacional</strong>
                <p>Los saludos y recordatorios ya funcionan. Para respuestas con OpenAI, autoriza enviar tus preguntas y últimos mensajes. No enviamos fotos.</p></div>
              <button type="button" onClick={() => configurarIA(true)}>✦ Activar</button>
            </div>}
        <div className={styles.sugerencias}>{EJEMPLOS.map(e => <button key={e} type="button" onClick={() => void enviar(e)}>{e}</button>)}</div>
        <form onSubmit={submit} className={styles.formulario}><label htmlFor="pregunta-asistente" className={styles.sr}>Escribe tu pregunta</label>
          <input ref={entrada} id="pregunta-asistente" value={texto} maxLength={500} onChange={e => setTexto(e.target.value)}
            placeholder="Pregunta o busca una guía…" />
          <button type="submit" disabled={!texto.trim()} aria-label="Enviar pregunta">➤</button>
        </form>
                <small>{usarIA ? "IA educativa, no diagnóstico. Si la IA no está disponible, Denti responderá con orientación local." : "Denti te acompaña automáticamente. OpenAI solo recibe preguntas si activas la conversación con IA."}</small>
      </div>
    </section>}
  </>;
}
