"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatearPrecio, inicialesDe, normalizar, textoOpcional } from "./formato";
import type { DentistaDirectorio, UbicacionPublica } from "./tipos";
import { distanciaEnKm, formatearDistancia, mensajeErrorUbicacion, obtenerUbicacionActual, type PuntoGeografico } from "./geolocalizacion";
import { resumirResenas } from "./resenas";
import styles from "./directorio.module.css";
import mapStyles from "./mapa-directorio.module.css";
import { Icono } from "@/components/Identidad";
import type { ResenaPublica } from "./resenas";
import { crearMarcadores, tieneUbicacionDentroDelRadio, ubicacionMasCercana } from "./ubicaciones";

const MapaDirectorio = dynamic(() => import("./MapaDirectorio"), {
  ssr: false,
  loading: () => <div className={mapStyles.contenedorMapa} role="status">Cargando mapa interactivo…</div>,
});

type Orden = "nombre" | "cercania" | "calificacion";
type Vista = "lista" | "mapa";
type Carga =
  | { estado: "cargando" }
  | { estado: "error" }
  | { estado: "listo"; dentistas: DentistaDirectorio[]; resenas: Record<string, ReturnType<typeof resumirResenas>>; resenasDisponibles: boolean; ubicacionesDisponibles: boolean };

export default function DirectorioLista() {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [distrito, setDistrito] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [ubicacion, setUbicacion] = useState<PuntoGeografico | null>(null);
  const [errorUbicacion, setErrorUbicacion] = useState("");
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const [radioKm, setRadioKm] = useState("");
  const [orden, setOrden] = useState<Orden>("nombre");
  const [vistaMovil, setVistaMovil] = useState<Vista>("lista");
  const [seleccionado, setSeleccionado] = useState("");
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
        let ubicacionesDisponibles = true;
        let ubicaciones: UbicacionPublica[] = [];
        if (ids.length) {
          const respuesta = await client.from("dentist_public_locations")
            .select("id,dentist_id,practice_name,practice_address,latitude,longitude,created_at")
            .in("dentist_id", ids);
          if (respuesta.error) ubicacionesDisponibles = false;
          else ubicaciones = (respuesta.data ?? []) as UbicacionPublica[];
        }
        const dentistas: DentistaDirectorio[] = baseDentistas.map(dentista => ({
          ...dentista,
          ubicaciones: ubicaciones.filter(ubicacion => ubicacion.dentist_id === dentista.id),
        }));
        let resenasDisponibles = true;
        let resenas: ResenaPublica[] = [];
        if (ids.length) {
          const respuesta = await client.from("dentist_reviews").select("id,dentist_id,rating,comment,created_at").in("dentist_id", ids);
          if (respuesta.error) resenasDisponibles = false;
          else resenas = (respuesta.data ?? []) as ResenaPublica[];
        }
        if (cancelado) return;
        const sumarios = Object.fromEntries(dentistas.map(dentista => [dentista.id, resumirResenas(resenas.filter(r => r.dentist_id === dentista.id))]));
        setCarga({ estado: "listo", dentistas, resenas: sumarios, resenasDisponibles, ubicacionesDisponibles });
      } catch { if (!cancelado) setCarga({ estado: "error" }); }
    }
    void cargar();
    return () => { cancelado = true; };
  }, [intento]);

  const dentistas = carga.estado === "listo" ? carga.dentistas : [];
  const distritos = useMemo(() => [...new Set(dentistas.map(d => d.district.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [dentistas]);
  const especialidades = useMemo(() => [...new Set(dentistas.map(d => d.specialty.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [dentistas]);
  const conUbicacion = dentistas.filter(d => d.ubicaciones.length > 0);

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

  const ubicacionesVisibles = crearMarcadores(visibles);

  async function usarUbicacion() {
    setErrorUbicacion("");
    if (!navigator.geolocation) { setErrorUbicacion(mensajeErrorUbicacion("incompatible")); return; }
    setCargandoUbicacion(true);
    try {
      const resultado = await obtenerUbicacionActual(navigator.geolocation);
      setUbicacion(resultado);
      setRadioKm("");
      if (orden === "nombre") setOrden("cercania");
    } catch (error) {
      const codigo = error && typeof error === "object" && "code" in error ? error.code : "";
      setErrorUbicacion(mensajeErrorUbicacion(codigo === "precision" ? "precision" : typeof codigo === "number" ? codigo : 0));
      setUbicacion(null);
    } finally { setCargandoUbicacion(false); }
  }

  function limpiarFiltros() {
    setBusqueda(""); setDistrito(""); setEspecialidad(""); setRadioKm(""); setOrden("nombre");
    busquedaRef.current?.focus();
  }

  return <section className={styles.pagina}>
    <header className={styles.cabecera}>
      <span className={styles.etiqueta}>Directorio odontológico</span>
      <h1>Encuentra orientación odontológica</h1>
      <p>Busca por nombre, especialidad o distrito, o consulta la ubicación de profesionales que hayan registrado un consultorio.</p>
      <span className={styles.avisoDemo}>Este directorio es académico. Los perfiles marcados como ficticios no representan profesionales ni consultorios reales; una solicitud no confirma una cita.</span>
    </header>

    {carga.estado === "cargando" && <div className={styles.carga} role="status" aria-live="polite"><span>Cargando odontólogos…</span><div className={styles.esqueleto} aria-hidden="true"><i /><i /><i /></div></div>}
    {carga.estado === "error" && <div className={`${styles.aviso} ${styles.avisoError}`} role="alert"><strong>No pudimos cargar el directorio.</strong><p>Comprueba la conexión y vuelve a intentarlo.</p><button type="button" className={styles.boton} onClick={() => { setCarga({ estado: "cargando" }); setIntento(n => n + 1); }}>Reintentar</button></div>}
    {carga.estado === "listo" && dentistas.length === 0 && <div className={styles.aviso} role="status">Por ahora no hay odontólogos activos en el directorio.</div>}

    {carga.estado === "listo" && dentistas.length > 0 && <>
      <div className={styles.accionesMapa}><button type="button" onClick={() => void usarUbicacion()} disabled={cargandoUbicacion} className={styles.botonUbicacion}><Icono nombre="buscar" size={16} />{cargandoUbicacion ? "Buscando ubicación…" : ubicacion ? "Actualizar mi ubicación" : "Usar mi ubicación"}</button><span>El permiso solo se solicita al pulsar el botón. El punto se mantiene en esta sesión y no se guarda; el proveedor de mapas recibe solicitudes normales de teselas para el área visible.</span></div>
      {errorUbicacion && <p className={styles.errorUbicacion} role="alert">{errorUbicacion}</p>}
      {ubicacion && <p className={styles.privacidadUbicacion} role="status">Ubicación temporal recibida (precisión aproximada de {Math.round(ubicacion.accuracy ?? 0)} m). Se usa para ordenar y calcular distancias en línea recta.</p>}
      <div className={styles.filtros}>
        <div className={styles.campo}><label htmlFor="dir-busqueda">Buscar por nombre o especialidad</label><input id="dir-busqueda" ref={busquedaRef} type="search" placeholder="Ej.: ortodoncia, Dra. …" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
        <div className={styles.campo}><label htmlFor="dir-distrito">Distrito</label><select id="dir-distrito" value={distrito} onChange={e => setDistrito(e.target.value)}><option value="">Todos los distritos</option>{distritos.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        <div className={styles.campo}><label htmlFor="dir-especialidad">Especialidad</label><select id="dir-especialidad" value={especialidad} onChange={e => setEspecialidad(e.target.value)}><option value="">Todas las especialidades</option>{especialidades.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
        <div className={styles.campo}><label htmlFor="dir-distancia">Distancia aproximada</label><select id="dir-distancia" value={radioKm} onChange={e => setRadioKm(e.target.value)} disabled={!ubicacion || conUbicacion.length === 0}><option value="">Cualquier distancia</option><option value="5">Hasta 5 km</option><option value="10">Hasta 10 km</option><option value="25">Hasta 25 km</option></select></div>
        <div className={styles.campo}><label htmlFor="dir-orden">Ordenar por</label><select id="dir-orden" value={orden} onChange={e => setOrden(e.target.value as Orden)}><option value="nombre">Nombre</option><option value="cercania" disabled={!ubicacion || conUbicacion.length === 0}>Cercanía</option><option value="calificacion" disabled={!carga.resenasDisponibles || !dentistas.some(d => (carga.resenas[d.id]?.total ?? 0) > 0)}>Calificación publicada</option></select></div>
      </div>
      {ubicacion && conUbicacion.length === 0 && <p className={styles.privacidadUbicacion}>Aún no hay consultorios con coordenadas registradas. Puedes seguir buscando por nombre, especialidad o distrito.</p>}
      <p className={styles.conteo} aria-live="polite">Mostrando {visibles.length} de {dentistas.length} profesionales</p>
      <div className={styles.alternarVista} role="tablist" aria-label="Vista del directorio"><button type="button" role="tab" aria-selected={vistaMovil === "lista"} onClick={() => setVistaMovil("lista")}>Lista</button><button type="button" role="tab" aria-selected={vistaMovil === "mapa"} onClick={() => setVistaMovil("mapa")}>Mapa</button></div>
      <div className={styles.explorador}>
        <section className={`${styles.resultados} ${vistaMovil === "mapa" ? styles.ocultarEnMovil : ""}`} aria-label="Resultados del directorio">
          {visibles.length === 0 ? <div className={styles.aviso} role="status"><strong>No hay profesionales que coincidan.</strong><p>Prueba otro filtro. Si usas distancia, solo se incluyen consultorios con coordenadas registradas.</p><button type="button" className={styles.boton} onClick={limpiarFiltros}>Limpiar filtros</button></div> : <ul className={styles.grilla}>
            {visibles.map(d => {
              const resumen = carga.resenas[d.id];
              const punto = ubicacionMasCercana(d.ubicaciones, ubicacion);
              const km = punto?.distancia ?? null;
              return <li key={d.id} className={`${styles.tarjeta} ${seleccionado === d.id ? styles.seleccionada : ""}`} onMouseEnter={() => setSeleccionado(d.id)} onFocus={() => setSeleccionado(d.id)}>
                <div className={styles.avatar} style={{ background: d.avatar_color?.trim() || "#e3f6f0" }} aria-hidden="true">{inicialesDe(d.initials, d.name)}</div>
                <div className={styles.cuerpo}>{d.is_demo && <span className={styles.ficticio}>Perfil académico ficticio</span>}<h2>{textoOpcional(d.name, "Nombre no disponible")}</h2><p className={styles.especialidad}>{textoOpcional(d.specialty, "Especialidad no indicada")}</p>
                  <div className={styles.meta}><span><Icono nombre="clinica" size={15} />{textoOpcional(d.district, "Distrito no indicado")}</span><span>{punto ? `${punto.ubicacion.practice_name} · ${punto.ubicacion.practice_address}` : carga.ubicacionesDisponibles ? "Ubicación no registrada" : "Ubicaciones no disponibles en este entorno"}</span>{punto && ubicacion && <span>{formatearDistancia(km)}</span>}<span>{formatearPrecio(d.consultation_price, d.currency)}</span></div>
                  <p className={styles.rating} aria-label={resumen?.promedio === null || !resumen ? "Sin reseñas publicadas" : `${resumen.promedio.toFixed(1)} de cinco, ${resumen.total} reseñas`}>
                    {resumen?.promedio === null || !resumen ? "Sin reseñas publicadas" : <>★ {resumen.promedio.toFixed(1)} · {resumen.total} {resumen.total === 1 ? "reseña" : "reseñas"}</>}
                    {!carga.resenasDisponibles && <span>Calificaciones no disponibles en este entorno</span>}
                  </p>
                  <div className={styles.accionesTarjeta}><Link href={`/directorio/${encodeURIComponent(d.id)}`} className={styles.enlace}>Ver perfil</Link><Link href={`/solicitudes?odontologo=${encodeURIComponent(d.id)}`} className={styles.solicitar}>Solicitar orientación</Link></div>
                </div>
              </li>;
            })}
          </ul>}
        </section>
        <section className={`${styles.mapaPanel} ${vistaMovil === "lista" ? styles.ocultarEnMovil : ""}`} aria-label="Mapa de consultorios">
          {conUbicacion.length === 0 && <p className={styles.avisoMapa}>{carga.estado === "listo" && carga.ubicacionesDisponibles ? "No hay consultorios con ubicación registrada. El mapa no asigna puntos a perfiles sin coordenadas verificadas." : "El servicio de ubicaciones no está disponible en este entorno. El directorio por lista sigue disponible."}</p>}
          <MapaDirectorio ubicaciones={ubicacionesVisibles} ubicacion={ubicacion} alSeleccionar={setSeleccionado} />
        </section>
      </div>
    </>}
  </section>;
}
