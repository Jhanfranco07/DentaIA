"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { GUIAS_BUCALES } from "@/features/buenas-practicas/contenido";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { responderOrientacion, type ObservacionAsistente, type RespuestaAsistente } from "./motor";
import styles from "./asistente.module.css";
import MascotaDenti from "./MascotaDenti";

type Mensaje = { id: number; pregunta?: string; respuesta: RespuestaAsistente; origen?: "llm" | "guiado" | "seguridad" };
type Precio = { id: string; nombre: string; profesional: string; distrito: string; especialidad: string; demo: boolean; monto: number | null; moneda: string; slug: string };
type Fila = { id: string; name: string; price_amount: number | null; currency_code: string; dentist_id: string;
  dentists: { name: string; district: string; specialty: string; is_demo: boolean; is_active: boolean; slug: string } | null };
const EJEMPLOS = ["¿Qué guías me recomiendas?", "Ver odontólogos y precios", "¿Qué puedo hacer con mis resultados?", "Ayúdame con mi rutina"];
const SALUDO: RespuestaAsistente = {
  texto: "¡Hola! Soy el asistente de DentaIA. Te acompaño en tu cuidado bucal: guías verificables, servicios publicados y navegación por tus módulos. Si compartes una evaluación desde su pantalla, podré orientarte sobre esas observaciones. No doy diagnósticos.",
  guias: ["cepillado", "controles"], especialidad: null, alerta: false,
  enlaces: [{ href: "/analisis", etiqueta: "Preparar fotografía" }, { href: "/paciente/rutinas", etiqueta: "Mis rutinas" }],
};
const filtrar = (texto: string) => texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function AsistentePaciente() {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [usarIA, setUsarIA] = useState(false);
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
    if (!limpia) return;
    const respuesta = responderOrientacion(limpia, observacion);
    const id = contador.current++;
    const historial = mensajes.filter(m => m.pregunta).slice(-3).flatMap(m => [
      { rol: "usuario" as const, texto: m.pregunta ?? "" },
      { rol: "asistente" as const, texto: m.respuesta.texto },
    ]);
    setMensajes(prev => [...prev.slice(-19), { id, pregunta: limpia, respuesta, origen: "guiado" }]);
    setTexto("");
    if (respuesta.especialidad && /precio|costo|tarifa|cuanto|odontologo|dentista|profesional|limpieza|ortodoncia/.test(filtrar(limpia))) {
      void consultarPrecios();
    }
    // Symptoms indicating an emergency must retain deterministic guidance.
    if (!usarIA || respuesta.alerta || pensando) return;
    setPensando(true);
    try {
      const { data, error } = await getSupabaseBrowserClient().auth.getSession();
      if (error || !data.session) return;
      const res = await fetch("/api/asistente/chat", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ pregunta: limpia, historial, observacion }),
        signal: AbortSignal.timeout(16000),
      });
      if (!res.ok) return;
      const body: { texto?: unknown; origen?: unknown } = await res.json();
      if (typeof body.texto !== "string" || body.texto.length > 1200 || !["llm", "guiado", "seguridad"].includes(String(body.origen))) return;
      setMensajes(prev => prev.map(m => m.id === id ? { ...m, respuesta: { ...m.respuesta, texto: body.texto as string }, origen: body.origen as Mensaje["origen"] } : m));
    } catch { /* Keep safe local guidance on rate limit, offline or server error. */ }
    finally { setPensando(false); }
  }
  function submit(evento: FormEvent<HTMLFormElement>) { evento.preventDefault(); void enviar(texto); }
  const ultimo = mensajes.at(-1);
  const recomendados = precios.filter(p => !ultimo?.respuesta.especialidad
    || ultimo.respuesta.especialidad === "general"
    || filtrar(p.especialidad).includes(ultimo.respuesta.especialidad === "ortodoncia" ? "ortodoncia" : "periodoncia")).slice(0, 5);
  return <>
    <button ref={activador} type="button" className={styles.activador} onClick={() => setAbierto(a => !a)}
      aria-expanded={abierto} aria-controls="asistente-dentaia" aria-label={abierto ? "Cerrar asistente DentaIA" : "Abrir asistente DentaIA"}>
      <MascotaDenti pequeno /><span>Denti te acompaña</span>
    </button>
    {abierto && <section id="asistente-dentaia" className={styles.panel} role="dialog" aria-label="Asistente de cuidado bucal" aria-modal="false">
      <header className={styles.encabezado}><MascotaDenti pequeno pensando={pensando} /><div><strong>Denti · Tu asistente</strong><small>{pensando ? "Preparando una respuesta…" : usarIA ? "Modo IA activo · orientación educativa" : "Modo guiado · sin diagnósticos"}</small></div>
        <button type="button" aria-label="Cerrar asistente" onClick={() => setAbierto(false)}>✕</button>
      </header>
      <div className={styles.cuerpo} ref={cuerpo} role="log" aria-live="polite" aria-relevant="additions">
        {mensajes.map(m => <div className={styles.intercambio} key={m.id}>
          {m.pregunta && <p className={styles.pregunta}>{m.pregunta}</p>}
          <div className={m.respuesta.alerta ? styles.alerta : styles.respuesta}>
            <p>{m.respuesta.texto}</p>{m.origen === "llm" && <small className={styles.origen}>Respuesta elaborada con IA a partir de contenido educativo</small>}
            {m.respuesta.guias.length > 0 && <div className={styles.recursos}>
              <small>Guías del catálogo de DentaIA</small>
              {m.respuesta.guias.map(id => {
                const g = GUIAS_BUCALES.find(item => item.id === id);
                return g ? <div key={id} className={styles.guia}><strong>{g.titulo}</strong>
                  <span>{g.descripcion}</span><Link href="/buenas-practicas">Leer guía</Link>
                  <a href={g.fuente.url} target="_blank" rel="noopener noreferrer">Fuente: {g.fuente.nombre}</a></div> : null;
              })}
            </div>}
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
        <label className={styles.opcionIA}><input type="checkbox" checked={usarIA} onChange={event => setUsarIA(event.target.checked)} /><span>Conversar con IA</span></label>
        <div className={styles.sugerencias}>{EJEMPLOS.map(e => <button key={e} type="button" onClick={() => void enviar(e)}>{e}</button>)}</div>
        <form onSubmit={submit} className={styles.formulario}><label htmlFor="pregunta-asistente" className={styles.sr}>Escribe tu pregunta</label>
          <input ref={entrada} id="pregunta-asistente" value={texto} maxLength={500} onChange={e => setTexto(e.target.value)}
            placeholder="¿Qué puedo hacer por mi sonrisa?" />
          <button type="submit" disabled={!texto.trim()} aria-label="Enviar pregunta">➤</button>
        </form>
        <small>{usarIA ? "Al activar IA, tu pregunta y un historial breve se envían a OpenAI para elaborar la respuesta. Las fotos no se envían; los resúmenes visuales solo se incluyen cuando tú los compartes. No se guarda conversación en DentaIA." : "Modo privado guiado: no se envían preguntas a modelos externos. Activa IA solo si deseas usar el servicio."}</small>
      </div>
    </section>}
  </>;
}
