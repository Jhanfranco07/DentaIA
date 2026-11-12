"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatearPrecio, inicialesDe, normalizar, textoOpcional } from "./formato";
import type { DemoLocationPublica, DentistaDirectorio, MarcadorDemo, UbicacionPublica } from "./tipos";
import { distanciaEnKm, formatearDistancia, mensajeErrorUbicacion, obtenerUbicacionActual, type PuntoGeografico } from "./geolocalizacion";
import { resumirResenas } from "./resenas";
import styles from "./directorio.module.css";
import mapStyles from "./mapa-directorio.module.css";
import { Icono } from "@/components/Identidad";
import type { ResenaPublica } from "./resenas";
import { crearMarcadores, tieneUbicacionDentroDelRadio, ubicacionMasCercana } from "./ubicaciones";
import { adjuntarUbicaciones, normalizarResenas } from "./compatibilidad-esquema";
import { crearMarcadorDemo } from "./demo";
import { AVISO_PERFILES_DEMO, CATALOGO_DEMO, unirCatalogoDemo } from "./catalogo-demo";
import AvatarOdontologo, { tratamientoDemo } from "./AvatarOdontologo";

const MapaDirectorio = dynamic(() => import("./MapaDirectorio"), {
  ssr: false,
  loading: () => <div className={mapStyles.contenedorMapa} role="status">Cargando mapa interactivo…</div>,
});

type Orden = "nombre" | "cercania" | "calificacion";
type Vista = "lista" | "mapa";
type Carga =
  | { estado: "cargando" }
  | { estado: "error" }
  | { estado: "listo"; dentistas: DentistaDirectorio[]; demos: DemoLocationPublica[]; demoDisponible: boolean; resenas: Record<string, ReturnType<typeof resumirResenas>>; resenasDisponibles: boolean; ubicacionesDisponibles: boolean };

export default function DirectorioLista({ modoPaciente = false }: { modoPaciente?: boolean } = {}) {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [distrito, setDistrito] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [ubicacion, setUbicacion] = useState<PuntoGeografico | null>(null);
  const [errorUbicacion, setErrorUbicacion] = useState("");
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const [radarActivo, setRadarActivo] = useState(false);
  const [radioKm, setRadioKm] = useState("");
  const [orden, setOrden] = useState<Orden>("nombre");
  const [vistaMovil, setVistaMovil] = useState<Vista>("lista");
  const [seleccionado, setSeleccionado] = useState("");
  const [mostrarDemo, setMostrarDemo] = useState(true);
  const busquedaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const client = getSupabaseBrowserClient();
        const { data, error } = await client.from("dentists").select("*").eq("is_active", true).order("name");
        if (cancelado) return;
        if (error) { setCarga({ estado: "error" }); return; }
        const baseDentistas = data ?? [];
        const ids = baseDentistas.map(d => d.id);
        let respuestaUbicaciones: { data: UbicacionPublica[] | null; error: unknown | null } = { data: [], error: null };
        if (ids.length) {
          respuestaUbicaciones = await client.from("dentist_public_locations")
            .select("id,dentist_id,practice_name,practice_address,latitude,longitude,created_at")
            .in("dentist_id", ids);
        }
        const ubicacionesResultado = adjuntarUbicaciones(baseDentistas, respuestaUbicaciones);
        const dentistasReales = ubicacionesResultado.dentistas as DentistaDirectorio[];
        let respuestaResenas: { data: ResenaPublica[] | null; error: unknown | null } = { data: [], error: null };
        if (ids.length) {
          respuestaResenas = await client.from("dentist_reviews").select("id,dentist_id,rating,comment,created_at").in("dentist_id", ids);
        }
        const resenasResultado = normalizarResenas(respuestaResenas);
        const resenas = resenasResultado.resenas as ResenaPublica[];
        const respuestaDemo = await client.from("directory_demo_locations")
          .select("id,slug,name,district,city,country,latitude,longitude,is_demo,is_published,requests_enabled,public_label")
          .eq("is_demo", true).eq("is_published", true).eq("requests_enabled", false);
        const demos = (respuestaDemo.data ?? []) as DemoLocationPublica[];
        if (cancelado) return;
        const dentistas = [...dentistasReales.filter(d => !CATALOGO_DEMO.some(p => p.id === d.id)), ...unirCatalogoDemo(demos)];
        const sumarios = Object.fromEntries(dentistas.map(dentista => [dentista.id, resumirResenas(resenas.filter(r => r.dentist_id === dentista.id))]));
        setCarga({ estado: "listo", dentistas, demos, demoDisponible: !respuestaDemo.error, resenas: sumarios, resenasDisponibles: resenasResultado.disponibles, ubicacionesDisponibles: ubicacionesResultado.disponibles });
      } catch { if (!cancelado) setCarga({ estado: "error" }); }
    }
    void cargar();
    return () => { cancelado = true; };
  }, [intento]);

  const dentistas = carga.estado === "listo" ? carga.dentistas : [];
  const distritos = useMemo(() => [...new Set(dentistas.map(d => d.district.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [dentistas]);
  const especialidades = useMemo(() => [...new Set(dentistas.map(d => d.specialty.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [dentistas]);
  const conUbicacion = dentistas.filter(d => d.ubicaciones.length > 0);
  const cercanos = useMemo(() => ubicacion ? dentistas.flatMap(d => {
    const p = ubicacionMasCercana(d.ubicaciones, ubicacion);
    return p ? [{ id: d.id, km: p.distancia, name: p.ubicacion.practice_name }] : [];
  }).sort((a,b) => a.km - b.km).slice(0, 3) : [], [dentistas,ubicacion]);
  useEffect(() => {
    if (!radarActivo) return;
    const timeout = window.setTimeout(() => setRadarActivo(false), 3300);
    return () => window.clearTimeout(timeout);
  }, [radarActivo, ubicacion]);

  const visibles = useMemo(() => {
    const query = normalizar(busqueda);
    let filtrados = dentistas.filter(dentista => {
      const coincideTexto = !query || normalizar(dentista.name).includes(query) || normalizar(dentista.specialty).includes(query);
      return coincideTexto && (!distrito || dentista.district.trim() === distrito)
        && (!especialidad || dentista.specialty.trim() === especialidad);
    });
    if (ubicacion && radioKm) filtrados = filtrados.filter(d => tieneUbicacionDentroDelRadio(d.ubicaciones, ubicacion, Number(radioKm)));
    if (ubicacion && orden === "cercania") filtrados.sort((a, b) =>
      (ubicacionMasCercana(a.ubicaciones, ubicacion)?.distancia ?? Number.POSITIVE_INFINITY)
      - (ubicacionMasCercana(b.ubicaciones, ubicacion)?.distancia ?? Number.POSITIVE_INFINITY));
    if (orden === "calificacion" && carga.estado === "listo") {
      filtrados.sort((a, b) => (carga.resenas[b.id]?.promedio ?? -1) - (carga.resenas[a.id]?.promedio ?? -1));
    }
    return filtrados;
  }, [busqueda, carga, dentistas, distrito, especialidad, orden, radioKm, ubicacion]);

  const idsCercanos = useMemo(() => cercanos.map(c => c.id), [cercanos]);
  const ubicacionesVisibles = useMemo(() => crearMarcadores(visibles), [visibles]);
  const marcadoresDemo = useMemo(() => carga.estado === "listo"
    ? carga.demos.map(crearMarcadorDemo).filter((marcador): marcador is MarcadorDemo => marcador !== null)
      .filter(marcador => CATALOGO_DEMO.some(perfil => perfil.slug === marcador.slug && visibles.some(d => d.slug === marcador.slug)))
      .map(marcador => ({ ...marcador, dentist_id: visibles.find(d => d.is_demo && d.slug === marcador.slug)?.id }))
    : [], [carga, visibles]);
  const ubicacionesMapa = useMemo(() => [...ubicacionesVisibles, ...(mostrarDemo ? marcadoresDemo : [])], [ubicacionesVisibles, marcadoresDemo, mostrarDemo]);

  async function usarUbicacion() {
    setErrorUbicacion("");
    setRadarActivo(false);
    if (!navigator.geolocation) { setErrorUbicacion(mensajeErrorUbicacion("incompatible")); return; }
    setCargandoUbicacion(true);
    try {
      const resultado = await obtenerUbicacionActual(navigator.geolocation);
      setUbicacion(resultado);
      if (modoPaciente) setRadarActivo(true);
      setRadioKm("");
      if (orden === "nombre") setOrden("cercania");
    } catch (error) {
      const codigo = error && typeof error === "object" && "code" in error ? error.code : "";
      setErrorUbicacion(mensajeErrorUbicacion(codigo === "precision" ? "precision" : typeof codigo === "number" ? codigo : 0));
      setUbicacion(null);
      setRadarActivo(false);
    } finally { setCargandoUbicacion(false); }
  }

  function limpiarFiltros() {
    setBusqueda(""); setDistrito(""); setEspecialidad(""); setRadioKm(""); setOrden("nombre");
    busquedaRef.current?.focus();
  }

  function mostrarEnMapa(id: string) {
    setSeleccionado(id);
    setVistaMovil("mapa");
  }

  return <section className={styles.pagina} data-vista={modoPaciente ? "paciente" : "publica"}>
    {modoPaciente ? <header className={styles.heroPaciente}>
      <div className={styles.heroTexto}>
        <span className={styles.heroEtiqueta}><Icono nombre="diente" size={20}/> ODONTÓLOGOS</span>
        <h1>Encuentra orientación odontológica <em>cerca de ti</em></h1>
        <p>Explora perfiles y centros de referencia en Lima. Busca por especialidad, distrito o ubicación y consulta su ficha.</p>
        <span className={styles.heroNota}>Los 20 perfiles ilustrados son ficticios. Los centros geográficos son referencias independientes, sin relación laboral ni reservas desde DentaIA.</span>
      </div>
      <div className={styles.heroProfesionales} aria-hidden="true">
        <div className={styles.heroAura}/>
        <AvatarOdontologo id={CATALOGO_DEMO[0].id} name={CATALOGO_DEMO[0].name} hero />
        <AvatarOdontologo id={CATALOGO_DEMO[1].id} name={CATALOGO_DEMO[1].name} hero />
        <span className={styles.heroBrillo}>✦</span>
      </div>
      <div className={styles.heroResumen}>
        <div><Icono nombre="usuarios" size={19}/><span><strong>Directorio informativo</strong><small>Perfiles y especialidades publicados</small></span></div>
        <div><Icono nombre="ubicacion" size={19}/><span><strong>Centros de referencia</strong><small>Explora las ubicaciones en el mapa</small></span></div>
        <div><Icono nombre="escudo" size={19}/><span><strong>Información responsable</strong><small>Distancias calculadas con tu permiso</small></span></div>
      </div>
    </header> : <header className={styles.cabecera}>
      <span className={styles.etiqueta}>Directorio odontológico</span>
      <h1>Encuentra orientación odontológica</h1>
      <p>Busca por nombre, especialidad o distrito. Los centros de referencia cuentan con direcciones y coordenadas publicadas. Los perfiles de odontólogos de ejemplo son ficticios.</p>
      <span className={styles.avisoDemo}>{AVISO_PERFILES_DEMO}. Las ubicaciones son referencias independientes, sin vinculación profesional ni citas mediante DentaIA.</span>
    </header>}

    {carga.estado === "cargando" && <div className={styles.carga} role="status" aria-live="polite"><span>Cargando odontólogos…</span><div className={styles.esqueleto} aria-hidden="true"><i /><i /><i /></div></div>}
    {carga.estado === "error" && <div className={`${styles.aviso} ${styles.avisoError}`} role="alert"><strong>No pudimos cargar el directorio.</strong><p>Comprueba la conexión y vuelve a intentarlo.</p><button type="button" className={styles.boton} onClick={() => { setCarga({ estado: "cargando" }); setIntento(n => n + 1); }}>Reintentar</button></div>}
    {!modoPaciente && carga.estado === "listo" && marcadoresDemo.length > 0 && <section className={styles.tarjetaDemo} aria-label="Información sobre las ubicaciones de referencia">
      <div><h2>Ubicaciones geográficas de referencia</h2>
        <p>Los centros y direcciones se basan en registros públicos. Los nombres de profesionales de ejemplo son ficticios y no están vinculados con esos centros.</p>
      </div>
      <button type="button" aria-pressed={mostrarDemo} className={styles.botonDemo} onClick={() => setMostrarDemo(value => !value)}>{mostrarDemo ? "Ocultar referencias" : "Mostrar referencias"}</button>
    </section>}
    {carga.estado === "listo" && dentistas.length === 0 && marcadoresDemo.length === 0 && <div className={styles.aviso} role="status">Por ahora no hay odontólogos activos ni ubicaciones publicadas en el directorio.</div>}

    {carga.estado === "listo" && (dentistas.length > 0 || marcadoresDemo.length > 0) && <>
      <div className={styles.accionesMapa}><button type="button" onClick={() => void usarUbicacion()} disabled={cargandoUbicacion} className={styles.botonUbicacion}><Icono nombre="buscar" size={16} />{cargandoUbicacion ? "Buscando ubicación…" : ubicacion ? "Actualizar mi ubicación" : "Usar mi ubicación"}</button><span>El permiso solo se solicita al pulsar el botón. El punto se mantiene en esta sesión y no se guarda; el proveedor de mapas recibe solicitudes normales de teselas para el área visible.</span></div>
      {errorUbicacion && <p className={styles.errorUbicacion} role="alert">{errorUbicacion}</p>}
      {ubicacion && <p className={styles.privacidadUbicacion} role="status">Ubicación temporal recibida (precisión aproximada de {Math.round(ubicacion.accuracy ?? 0)} m). Se usa para ordenar y calcular distancias en línea recta.</p>}
      {modoPaciente && radarActivo && <div className={styles.radarEstado} role="status" aria-live="polite"><span className={styles.radarPunto} aria-hidden="true"/> Explorando las referencias cercanas desde tu ubicación…</div>}
      {modoPaciente && ubicacion && !radarActivo && cercanos.length > 0 && <div className={styles.cercanos} role="status"><Icono nombre="ubicacion" size={16}/><span>Referencias más cercanas: <strong>{cercanos.map(c => c.name).join(" · ")}</strong>. Distancia en línea recta, no recorrido vial.</span></div>}
      <div className={styles.filtros}>
        <div className={styles.campo}><label htmlFor="dir-busqueda">Buscar por nombre o especialidad</label><input id="dir-busqueda" ref={busquedaRef} type="search" placeholder="Ej.: ortodoncia, Dra. …" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
        <div className={styles.campo}><label htmlFor="dir-distrito">Distrito</label><select id="dir-distrito" value={distrito} onChange={e => setDistrito(e.target.value)}><option value="">Todos los distritos</option>{distritos.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        <div className={styles.campo}><label htmlFor="dir-especialidad">Especialidad</label><select id="dir-especialidad" value={especialidad} onChange={e => setEspecialidad(e.target.value)}><option value="">Todas las especialidades</option>{especialidades.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
        <div className={styles.campo}><label htmlFor="dir-distancia">Distancia aproximada</label><select id="dir-distancia" value={radioKm} onChange={e => setRadioKm(e.target.value)} disabled={!ubicacion || conUbicacion.length === 0}><option value="">Cualquier distancia</option><option value="5">Hasta 5 km</option><option value="10">Hasta 10 km</option><option value="25">Hasta 25 km</option></select></div>
        <div className={styles.campo}><label htmlFor="dir-orden">Ordenar por</label><select id="dir-orden" value={orden} onChange={e => setOrden(e.target.value as Orden)}><option value="nombre">Nombre</option><option value="cercania" disabled={!ubicacion || conUbicacion.length === 0}>Cercanía</option><option value="calificacion" disabled={!carga.resenasDisponibles || !dentistas.some(d => (carga.resenas[d.id]?.total ?? 0) > 0)}>Calificación publicada</option></select></div>
      </div>
      {ubicacion && conUbicacion.length === 0 && <p className={styles.privacidadUbicacion}>Aún no hay consultorios con coordenadas registradas. Puedes seguir buscando por nombre, especialidad o distrito.</p>}
      <p className={styles.conteo} aria-live="polite">{modoPaciente ? <>Profesionales y centros <span>({visibles.length} resultados de {dentistas.length})</span></> : <>Mostrando {visibles.length} de {dentistas.length} profesionales</>}</p>
      <div className={styles.alternarVista} role="tablist" aria-label="Vista del directorio"><button type="button" role="tab" aria-selected={vistaMovil === "lista"} onClick={() => setVistaMovil("lista")}>Lista</button><button type="button" role="tab" aria-selected={vistaMovil === "mapa"} onClick={() => setVistaMovil("mapa")}>Mapa</button></div>
      <div className={styles.explorador}>
        <section className={`${styles.resultados} ${vistaMovil === "mapa" ? styles.ocultarEnMovil : ""}`} aria-label="Resultados del directorio">
          {visibles.length === 0 ? <div className={styles.aviso} role="status"><strong>No hay profesionales que coincidan.</strong><p>Prueba otro filtro. Si usas distancia, solo se incluyen consultorios con coordenadas registradas.</p><button type="button" className={styles.boton} onClick={limpiarFiltros}>Limpiar filtros</button></div> : <ul className={styles.grilla}>
            {visibles.map(d => {
              const resumen = carga.resenas[d.id];
              const punto = ubicacionMasCercana(d.ubicaciones, ubicacion);
              const km = punto?.distancia ?? null;
              return <li key={d.id} className={`${styles.tarjeta} ${seleccionado === d.id ? styles.seleccionada : ""}`}>
                <AvatarOdontologo id={d.id} name={d.name} initials={d.initials} avatarColor={d.avatar_color} />
                <div className={styles.cuerpo}>{d.is_demo && <span className={styles.ficticio}>Perfil de ejemplo · ficticio</span>}<h2>{modoPaciente ? tratamientoDemo(d.id) : ""}{textoOpcional(d.name, "Nombre no disponible")}</h2><p className={styles.especialidad}>{textoOpcional(d.specialty, "Especialidad no indicada")}</p>
                  <div className={styles.meta}><span><Icono nombre="clinica" size={15} />{textoOpcional(d.district, "Distrito no indicado")}</span><span>{punto ? `${punto.ubicacion.practice_name} · ${punto.ubicacion.practice_address}` : carga.ubicacionesDisponibles ? "Ubicación no registrada" : "Ubicaciones no disponibles en este entorno"}</span>{punto && ubicacion && <span>{formatearDistancia(km)}</span>}{!d.is_demo && <span>{formatearPrecio(d.consultation_price, d.currency)}</span>}</div>
                  <p className={styles.rating} aria-label={resumen?.promedio === null || !resumen ? "Sin reseñas publicadas" : `${resumen.promedio.toFixed(1)} de cinco, ${resumen.total} reseñas`}>
                    {resumen?.promedio === null || !resumen ? "Sin reseñas publicadas" : <>★ {resumen.promedio.toFixed(1)} · {resumen.total} {resumen.total === 1 ? "reseña" : "reseñas"}</>}
                    {!carga.resenasDisponibles && <span>Calificaciones no disponibles en este entorno</span>}
                  </p>
                  <div className={styles.accionesTarjeta}><Link href={`${modoPaciente ? "/panel/odontologos" : "/directorio"}/${encodeURIComponent(d.id)}`} className={styles.enlace}>Ver perfil <span aria-hidden="true">→</span></Link>{!d.is_demo && <Link href={`/solicitudes?odontologo=${encodeURIComponent(d.id)}`} className={styles.solicitar}>Solicitar orientación</Link>}{d.ubicaciones.some(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) && <button type="button" className={styles.verMapa} onClick={() => mostrarEnMapa(d.id)}>Ver en mapa</button>}</div>
                </div>
              </li>;
            })}
          </ul>}
        </section>
        <section className={`${styles.mapaPanel} ${vistaMovil === "lista" ? styles.ocultarEnMovil : ""}`} aria-label="Mapa de consultorios">
          {conUbicacion.length === 0 && marcadoresDemo.length === 0 && <p className={styles.avisoMapa}>{carga.estado === "listo" && carga.ubicacionesDisponibles ? "No hay consultorios con ubicación registrada. El mapa no asigna puntos a perfiles sin coordenadas verificadas." : "El servicio de ubicaciones no está disponible en este entorno. El directorio por lista sigue disponible."}</p>}
          <MapaDirectorio ubicaciones={ubicacionesMapa} ubicacion={ubicacion} seleccionado={seleccionado} visible={vistaMovil === "mapa"} alSeleccionar={setSeleccionado} modoPaciente={modoPaciente} radarActivo={radarActivo} idsCercanos={idsCercanos} basePerfil={modoPaciente ? "/panel/odontologos" : "/directorio"} />
        </section>
      </div>
    </>}
  </section>;
}
