"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { MAX_CONSULTA, MAX_PAGINA_BUSQUEDA } from "@/lib/busqueda/bm25";
import { useConsultaEstable } from "@/lib/busqueda/useConsultaEstable";
import { buscarDirectorio, buscarDirectorioDemo, type OrdenDirectorio, type PaginaDirectorio } from "./busqueda";
import { formatearPrecio, textoOpcional } from "./formato";
import type { MarcadorDemo } from "./tipos";
import { distanciaEnKm, formatearDistancia, mensajeErrorUbicacion, obtenerUbicacionActual, type PuntoGeografico } from "./geolocalizacion";
import styles from "./directorio.module.css";
import mapStyles from "./mapa-directorio.module.css";
import { Icono } from "@/components/Identidad";
import { crearMarcadores, ubicacionMasCercana } from "./ubicaciones";
import { crearMarcadorDemo } from "./demo";
import { AVISO_PERFILES_DEMO } from "./catalogo-demo";
import AvatarOdontologo, { tratamientoDemo } from "./AvatarOdontologo";
import HeroDirectorioPaciente from "./HeroDirectorioPaciente";
import { esPerfilQa, marcadoresQa } from "./qa-preview";

const MapaDirectorio = dynamic(() => import("./MapaDirectorio"), {
  ssr: false,
  loading: () => <div className={mapStyles.contenedorMapa} role="status">Cargando mapa interactivo…</div>,
});

type Vista = "lista" | "mapa";

export default function DirectorioLista({ modoPaciente = false, qaPreview = false }: { modoPaciente?: boolean; qaPreview?: boolean } = {}) {
  const [carga, setCarga] = useState<PaginaDirectorio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const texto = useConsultaEstable(busqueda);
  const [distrito, setDistrito] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [ubicacion, setUbicacion] = useState<PuntoGeografico | null>(null);
  const [errorUbicacion, setErrorUbicacion] = useState("");
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const [radarActivo, setRadarActivo] = useState(false);
  const [radioKm, setRadioKm] = useState("");
  const [orden, setOrden] = useState<OrdenDirectorio>("nombre");
  const [vistaMovil, setVistaMovil] = useState<Vista>("lista");
  const [seleccionado, setSeleccionado] = useState("");
  const [mostrarDemo, setMostrarDemo] = useState(true);
  const busquedaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCargando(true);
    if (texto === undefined) return;
    const controller = new AbortController();
    const consulta = { texto, distrito, especialidad, orden, pagina, ubicacion, radio: ubicacion && radioKm ? Number(radioKm) : undefined };
    async function cargar() {
      try {
        const resultado = await buscarDirectorio(getSupabaseBrowserClient(), consulta, controller.signal);
        if (!controller.signal.aborted) setCarga(resultado);
      } catch {
        if (!controller.signal.aborted) setCarga(buscarDirectorioDemo(consulta));
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }
    void cargar();
    return () => controller.abort();
  }, [texto, distrito, especialidad, orden, pagina, ubicacion, radioKm, intento]);

  const visibles = useMemo(() => cargando || texto === undefined ? [] : carga?.dentistas ?? [], [carga, cargando, texto]);
  const distritos = useMemo(() => [...(carga?.distritos ?? [])].sort((a, b) => a.localeCompare(b, "es")), [carga]);
  const especialidades = useMemo(() => [...(carga?.especialidades ?? [])].sort((a, b) => a.localeCompare(b, "es")), [carga]);
  const paginas = carga ? Math.max(1, Math.ceil(carga.total / carga.tamano)) : 1;
  const cercanos = useMemo(() => ubicacion ? visibles.flatMap(d => {
    const p = esPerfilQa(d.id) ? null : ubicacionMasCercana(d.ubicaciones, ubicacion);
    return p && p.distancia !== null ? [{ id: d.id, km: p.distancia, name: p.ubicacion.practice_name }] : [];
  }).sort((a,b) => a.km - b.km).slice(0, 3) : [], [visibles, ubicacion]);
  useEffect(() => {
    if (!radarActivo) return;
    const timeout = window.setTimeout(() => setRadarActivo(false), 3300);
    return () => window.clearTimeout(timeout);
  }, [radarActivo, ubicacion]);

  const idsCercanos = useMemo(() => cercanos.map(c => c.id), [cercanos]);
  const ubicacionesVisibles = useMemo(() => crearMarcadores(visibles.filter(d => !esPerfilQa(d.id))), [visibles]);
  const marcadoresDemo = useMemo(() => carga
    ? carga.demos.map(crearMarcadorDemo).filter((marcador): marcador is MarcadorDemo => marcador !== null)
      .flatMap(marcador => {
        const perfil = visibles.find(d => d.is_demo && d.slug === marcador.slug && d.ubicaciones.some(punto => punto.id === marcador.id));
        return perfil ? [{ ...marcador, dentist_id: perfil.id }] : [];
      })
    : [], [carga, visibles]);
  const qaMarkers = useMemo(() => qaPreview ? marcadoresQa().filter(p => visibles.some(d => d.id === p.dentist_id)) : [], [qaPreview, visibles]);
  const ubicacionesMapa = useMemo(() => [...ubicacionesVisibles, ...(mostrarDemo ? [...marcadoresDemo, ...qaMarkers] : [])], [ubicacionesVisibles, marcadoresDemo, qaMarkers, mostrarDemo]);

  async function usarUbicacion() {
    setErrorUbicacion("");
    setRadarActivo(false);
    if (!navigator.geolocation) { setErrorUbicacion(mensajeErrorUbicacion("incompatible")); return; }
    setCargandoUbicacion(true);
    try {
      const resultado = await obtenerUbicacionActual(navigator.geolocation);
      setUbicacion(resultado);
      if (modoPaciente) { setRadarActivo(true); setVistaMovil("mapa"); }
      setRadioKm("");
      setPagina(1);
      if (orden === "nombre") setOrden("cercania");
    } catch (error) {
      const codigo = error && typeof error === "object" && "code" in error ? error.code : "";
      setErrorUbicacion(mensajeErrorUbicacion(codigo === "precision" ? "precision" : typeof codigo === "number" ? codigo : 0));
      setUbicacion(null);
      setRadarActivo(false);
    } finally { setCargandoUbicacion(false); }
  }

  function filtrar(cambio: () => void) {
    cambio();
    setPagina(1);
  }

  function limpiarFiltros() {
    setBusqueda(""); setDistrito(""); setEspecialidad(""); setRadioKm(""); setOrden("nombre");
    setPagina(1);
    busquedaRef.current?.focus();
  }

  function mostrarEnMapa(id: string) {
    setSeleccionado(id);
    setVistaMovil("mapa");
  }

  return <section className={styles.pagina} data-vista={modoPaciente ? "paciente" : "publica"}>
    {modoPaciente ? <HeroDirectorioPaciente /> : <header className="public-intro">
      <div>
        <p className="eyebrow">Directorio odontológico</p>
        <h1>Encuentra odontólogos</h1>
        <p>Busca por nombre, especialidad o distrito y consulta las ubicaciones publicadas.</p>
        <span className={styles.avisoDemo}>{AVISO_PERFILES_DEMO}</span>
      </div>
      <Image src="/landing/equipo.webp" alt="" width={1300} height={867} sizes="(max-width: 760px) 100vw, 520px" />
    </header>}

    {!carga && <div className={styles.carga} role="status" aria-live="polite"><span>Cargando odontólogos…</span><div className={styles.esqueleto} aria-hidden="true"><i /><i /><i /></div></div>}
    {carga && !carga.catalogoDisponible && <div className={`${styles.aviso} ${styles.avisoError}`} role="alert"><strong>Mostramos el catálogo de demostración.</strong><p>El catálogo publicado no está disponible en este momento. Puedes explorar las fichas de ejemplo o reintentar la carga.</p><button type="button" className={styles.boton} disabled={cargando} onClick={() => setIntento(n => n + 1)}>Reintentar</button></div>}
    {!modoPaciente && marcadoresDemo.length > 0 && <section className={styles.tarjetaDemo} aria-label="Información sobre las ubicaciones de referencia">
      <div><h2>Ubicaciones geográficas de referencia</h2>
        <p>Los centros y direcciones se basan en registros públicos. Los nombres de profesionales de ejemplo son ficticios y no están vinculados con esos centros.</p>
      </div>
      <button type="button" aria-pressed={mostrarDemo} className={styles.botonDemo} onClick={() => setMostrarDemo(value => !value)}>{mostrarDemo ? "Ocultar referencias" : "Mostrar referencias"}</button>
    </section>}
    {carga && <>
      {modoPaciente ? <div className={styles.localizadorPremium}>
        <span className={styles.localizadorEmblema} aria-hidden="true"><Icono nombre="ubicacion" size={24}/></span>
        <div className={styles.localizadorTexto}>
          <strong>Descubre qué referencias están cerca de ti</strong>
          <span>Compara ubicaciones y ordénalas por distancia real en línea recta.</span>
        </div>
        <button type="button" onClick={() => void usarUbicacion()} disabled={cargandoUbicacion} className={styles.localizadorBoton}><Icono nombre="ubicacion" size={17}/>{cargandoUbicacion ? "Localizando…" : ubicacion ? "Actualizar ubicación" : "Activar radar de cercanía"}</button>
        <details className={styles.localizadorPrivacidad}><summary><Icono nombre="privacidad" size={15}/> Privacidad</summary><p>Solo solicitamos permiso al pulsar el botón. DentaIA usa tu posición de forma temporal para calcular distancias en línea recta. El mapa solicita las teselas necesarias al proveedor.</p></details>
      </div> : <div className={styles.accionesMapa}><button type="button" onClick={() => void usarUbicacion()} disabled={cargandoUbicacion} className={styles.botonUbicacion}><Icono nombre="buscar" size={16} />{cargandoUbicacion ? "Buscando ubicación…" : ubicacion ? "Actualizar mi ubicación" : "Usar mi ubicación"}</button><span>El permiso solo se solicita al pulsar el botón. DentaIA usa el punto de forma temporal para calcular distancias. El proveedor de mapas recibe solicitudes de teselas para el área visible.</span></div>}
      {errorUbicacion && <p className={styles.errorUbicacion} role="alert">{errorUbicacion}</p>}
      {ubicacion && !modoPaciente && <p className={styles.privacidadUbicacion} role="status">Ubicación temporal recibida (precisión aproximada de {Math.round(ubicacion.accuracy ?? 0)} m). Se usa para ordenar y calcular distancias en línea recta.</p>}
      {modoPaciente && ubicacion && <div className={styles.proximidadPremium} role="status" aria-live="polite">
        <div className={styles.proximidadIcono} aria-hidden="true"><Icono nombre="ubicacion" size={20}/><span className={radarActivo ? styles.proximidadPulso : ""}/></div>
        <div className={styles.proximidadTexto}><strong>{radarActivo ? "Radar activo: localizando referencias…" : "Estas son las referencias más próximas"}</strong><small>Precisión del dispositivo: aprox. {Math.round(ubicacion.accuracy ?? 0)} m. Distancias en línea recta, no rutas.</small></div>
        <div className={styles.proximidadOpciones}>
          {cercanos.map((c,i) => <button key={c.id} type="button" onClick={() => mostrarEnMapa(c.id)} className={styles.proximidadOpcion} title={`Ver ${c.name} en el mapa`}><span>{i+1}</span><strong>{c.name}</strong><small>{formatearDistancia(c.km)}</small></button>)}
          {cercanos.length === 0 && <span>Sin ubicaciones cercanas disponibles</span>}
        </div>
      </div>}
      {modoPaciente && <div className={styles.encabezadoResultados} id="resultados-directorio">
        <h2>Explora los perfiles</h2>
        <span className={styles.conteo} aria-live="polite">{cargando ? "Buscando…" : `${carga.total} de ${carga.totalCatalogo} perfiles`}</span>
      </div>}
      {modoPaciente && <div className={styles.accesosEspecialidades} role="group" aria-label="Filtrar por especialidad">
        <button type="button" className={!especialidad ? styles.accesoActivo : ""} aria-pressed={!especialidad} onClick={() => filtrar(() => setEspecialidad(""))}>Todas las especialidades</button>
        {["Odontología general", "Ortodoncia", "Endodoncia", "Odontopediatría"].filter(opcion => especialidades.includes(opcion)).map(opcion => (
          <button key={opcion} type="button" className={especialidad === opcion ? styles.accesoActivo : ""} aria-pressed={especialidad === opcion} onClick={() => filtrar(() => setEspecialidad(actual => actual === opcion ? "" : opcion))}>{opcion}</button>
        ))}
        {(busqueda || distrito || especialidad || radioKm) && <button type="button" className={styles.limpiarPremium} onClick={limpiarFiltros}>Limpiar filtros</button>}
      </div>}
      <div className={styles.filtros}>
        <div className={styles.campo}><label htmlFor="dir-busqueda">Buscar por nombre o especialidad</label><input id="dir-busqueda" ref={busquedaRef} type="search" placeholder="Ej.: ortodoncia, Dra. …" value={busqueda} maxLength={MAX_CONSULTA} onChange={e => filtrar(() => setBusqueda(e.target.value))} /></div>
        <div className={styles.campo}><label htmlFor="dir-distrito">Distrito</label><select id="dir-distrito" value={distrito} onChange={e => filtrar(() => setDistrito(e.target.value))}><option value="">Todos los distritos</option>{distritos.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        <div className={styles.campo}><label htmlFor="dir-especialidad">Especialidad</label><select id="dir-especialidad" value={especialidad} onChange={e => filtrar(() => setEspecialidad(e.target.value))}><option value="">Todas las especialidades</option>{especialidades.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
        <div className={styles.campo}><label htmlFor="dir-distancia">Distancia aproximada</label><select id="dir-distancia" value={radioKm} onChange={e => filtrar(() => setRadioKm(e.target.value))} disabled={!ubicacion || (!radioKm && !carga.hayUbicaciones)}><option value="">Cualquier distancia</option><option value="5">Hasta 5 km</option><option value="10">Hasta 10 km</option><option value="25">Hasta 25 km</option></select></div>
        <div className={styles.campo}><label htmlFor="dir-orden">Ordenar por</label><select id="dir-orden" value={orden} onChange={e => filtrar(() => setOrden(e.target.value as OrdenDirectorio))}><option value="nombre">Nombre</option><option value="cercania" disabled={!ubicacion || !carga.hayUbicaciones}>Cercanía</option><option value="calificacion" disabled={!carga.hayResenas}>Calificación publicada</option></select></div>
      </div>
      {ubicacion && !carga.hayUbicaciones && <p className={styles.privacidadUbicacion}>Aún no hay consultorios con coordenadas registradas. Puedes seguir buscando por nombre, especialidad o distrito.</p>}
      {!modoPaciente && <p className={styles.conteo} aria-live="polite">{cargando ? "Buscando…" : `Mostrando ${visibles.length} de ${carga.total} profesionales`}</p>}
      {paginas > 1 && <nav aria-label="Paginación del directorio" className={styles.accionesMapa}>
        <button type="button" className={styles.boton} disabled={cargando || carga.pagina <= 1} onClick={() => setPagina(carga.pagina - 1)}>Anterior</button>
        <span>Página {carga.pagina} de {paginas}</span>
        <button type="button" className={styles.boton} disabled={cargando || carga.pagina >= Math.min(paginas, MAX_PAGINA_BUSQUEDA)} onClick={() => setPagina(carga.pagina + 1)}>Siguiente</button>
      </nav>}
      <div className={styles.alternarVista} role="tablist" aria-label="Vista del directorio"><button type="button" role="tab" aria-selected={vistaMovil === "lista"} onClick={() => setVistaMovil("lista")}>Lista</button><button type="button" role="tab" aria-selected={vistaMovil === "mapa"} onClick={() => setVistaMovil("mapa")}>Mapa</button></div>
      <div className={styles.explorador}>
        <section className={`${styles.resultados} ${vistaMovil === "mapa" ? styles.ocultarEnMovil : ""}`} aria-label="Resultados del directorio">
          {cargando ? <div className={styles.carga} role="status">Buscando odontólogos…</div> : visibles.length === 0 ? <div className={styles.aviso} role="status"><strong>No hay profesionales que coincidan.</strong><p>Prueba otro filtro. Si usas distancia, solo se incluyen consultorios con coordenadas registradas.</p><button type="button" className={styles.boton} onClick={limpiarFiltros}>Limpiar filtros</button></div> : <ul className={styles.grilla}>
            {visibles.map(d => {
              const resumen = carga.resenas[d.id];
              const punto = esPerfilQa(d.id) ? null : ubicacionMasCercana(d.ubicaciones, ubicacion);
              const km = punto?.distancia ?? null;
              return <li key={d.id} className={`${styles.tarjeta} ${seleccionado === d.id ? styles.seleccionada : ""}`}>
                <div className={styles.tarjetaAvatarMarco}><AvatarOdontologo id={d.id} name={d.name} initials={d.initials} avatarColor={d.avatar_color} /></div>
                <div className={styles.cuerpo}>{d.is_demo && <span className={styles.ficticio}>Perfil de demostración · No ofrece atención real</span>}<h2>{modoPaciente ? tratamientoDemo(d.id) : ""}{textoOpcional(d.name, "Nombre no disponible")}</h2><p className={styles.especialidad}>{textoOpcional(d.specialty, "Especialidad no indicada")}</p>
                  <div className={styles.meta}><span><Icono nombre="clinica" size={15} />{textoOpcional(d.district, "Distrito no indicado")}</span><span>{punto ? `${punto.ubicacion.practice_name} · ${punto.ubicacion.practice_address}` : carga.catalogoDisponible ? (d.is_demo ? `Sin consultorio publicado en ${d.district}` : "Ubicación no registrada") : "Ubicaciones no disponibles en este entorno"}</span>{punto && ubicacion && <span>{formatearDistancia(km)}</span>}{!d.is_demo && <span>{formatearPrecio(d.consultation_price, d.currency)}</span>}</div>
                  {(!modoPaciente || (resumen?.total ?? 0)>0) && <p className={styles.rating} aria-label={resumen?.promedio === null || !resumen ? "Sin reseñas publicadas" : `${resumen.promedio.toFixed(1)} de cinco, ${resumen.total} reseñas`}>
                    {resumen?.promedio === null || !resumen ? "Sin reseñas publicadas" : <>★ {resumen.promedio.toFixed(1)} · {resumen.total} {resumen.total === 1 ? "reseña" : "reseñas"}</>}
                    {!carga.catalogoDisponible && <span>Calificaciones no disponibles en este entorno</span>}
                  </p>}
                  <div className={styles.accionesTarjeta}><Link href={`${modoPaciente ? "/panel/odontologos" : "/directorio"}/${encodeURIComponent(d.id)}`} className={styles.enlace}>Ver perfil <span aria-hidden="true">→</span></Link>{!d.is_demo && <Link href={`/solicitudes?odontologo=${encodeURIComponent(d.id)}`} className={styles.solicitar}>Solicitar orientación</Link>}{!esPerfilQa(d.id) && d.ubicaciones.some(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) && <button type="button" className={styles.verMapa} onClick={() => mostrarEnMapa(d.id)}>Ver en mapa</button>}</div>
                </div>
              </li>;
            })}
          </ul>}
        </section>
        <section className={`${styles.mapaPanel} ${vistaMovil === "lista" ? styles.ocultarEnMovil : ""}`} aria-label="Mapa de consultorios">
          {modoPaciente && <div className={styles.mapaPremiumEncabezado}><div><span className={styles.mapaPremiumIcono}><Icono nombre="ubicacion" size={20}/></span><span><strong>Explora el mapa</strong><small>{ubicacion ? "Puntos ordenados por cercanía" : "Encuentra centros por distrito y especialidad"}</small></span></div><span className={styles.mapaPremiumIndicador}><i aria-hidden="true"/> Mapa interactivo</span></div>}
          {!cargando && ubicacionesMapa.length === 0 && <p className={styles.avisoMapa}>{carga.catalogoDisponible ? "No hay ubicaciones registradas para estos resultados." : "El servicio de ubicaciones no está disponible en este entorno. El directorio por lista sigue disponible."}</p>}
          <MapaDirectorio ubicaciones={ubicacionesMapa} ubicacion={ubicacion} seleccionado={seleccionado} visible={vistaMovil === "mapa"} alSeleccionar={setSeleccionado} modoPaciente={modoPaciente} radarActivo={radarActivo} idsCercanos={idsCercanos} basePerfil={modoPaciente ? "/panel/odontologos" : "/directorio"} />
          {modoPaciente && <div className={styles.mapaPremiumLeyenda}><span><b className={styles.mapaPinDiente}>🦷</b> Centros de referencia</span>{ubicacion && <span><b className={styles.mapaPinUsuario}/> Tu ubicación temporal</span>}<small>Ubicaciones orientativas · no indican vinculación laboral</small></div>}
        </section>
      </div>
    </>}
  </section>;
}
