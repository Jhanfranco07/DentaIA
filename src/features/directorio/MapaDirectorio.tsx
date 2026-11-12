"use client";

import { useEffect, useRef, useState } from "react";
import { Map, Marker, NavigationControl, Popup, setWorkerUrl, type Map as MapInstance, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MarcadorConsultorio, MarcadorDemo, MarcadorDirectorio } from "./tipos";
import type { PuntoGeografico } from "./geolocalizacion";
import { ubicacionConCoordenadasValidas } from "./ubicaciones";
import styles from "./mapa-directorio.module.css";
import { perfilDemo } from "./catalogo-demo";

const LIMA = { longitude: -77.0428, latitude: -12.0464 };

function obtenerTeselas() {
  const configurada = process.env.NEXT_PUBLIC_OSM_TILE_URL?.trim();
  return configurada?.startsWith("https://") ? configurada : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
}

export default function MapaDirectorio({ ubicaciones, ubicacion, seleccionado = "", visible = true, alSeleccionar, modoPaciente = false, radarActivo = false, idsCercanos = [], basePerfil = "/directorio" }: {
  ubicaciones: MarcadorDirectorio[];
  ubicacion: PuntoGeografico | null;
  seleccionado?: string;
  visible?: boolean;
  alSeleccionar?: (id: string) => void;
  modoPaciente?: boolean;
  radarActivo?: boolean;
  idsCercanos?: readonly string[];
  basePerfil?: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapInstance | null>(null);
  const marcadores = useRef<Marker[]>([]);
  const marcadoresPorDentista = useRef(new globalThis.Map<string, Marker>());
  const marcadorUsuario = useRef<HTMLElement | null>(null);
  const [listo, setListo] = useState(false);
  const [errorTeselas, setErrorTeselas] = useState(false);

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
    const instancia = new Map({
      container: contenedor.current,
      style: {
        version: 8,
        sources: { openstreetmap: { type: "raster", tiles: [obtenerTeselas()], tileSize: 256, attribution: "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>" } },
        layers: [{ id: "openstreetmap-raster", type: "raster", source: "openstreetmap", minzoom: 0, maxzoom: 19 }],
      } satisfies StyleSpecification,
      center: [LIMA.longitude, LIMA.latitude],
      zoom: 11,
      attributionControl: { compact: true },
    });
    instancia.addControl(new NavigationControl({ showCompass: false }), "top-right");
    instancia.once("load", () => setListo(true));
    instancia.on("error", evento => { if (evento.error) setErrorTeselas(true); });
    instancia.on("sourcedata", evento => { if (evento.sourceId === "openstreetmap" && evento.isSourceLoaded) setErrorTeselas(false); });
    mapa.current = instancia;
    return () => {
      marcadores.current.forEach(marcador => marcador.remove());
      marcadores.current = [];
      instancia.remove();
      mapa.current = null;
      setListo(false);
    };
  }, []);

  useEffect(() => {
    if (!listo || !mapa.current) return;
    marcadores.current.forEach(marcador => marcador.remove());
    marcadores.current = [];
    marcadoresPorDentista.current.clear();
    marcadorUsuario.current = null;
    const ubicacionesValidas = ubicaciones.filter((ubicacion): ubicacion is MarcadorConsultorio => ubicacion.tipo === "consultorio" && ubicacionConCoordenadasValidas(ubicacion));
    const demosValidas = ubicaciones.filter((ubicacion): ubicacion is MarcadorDemo => ubicacion.tipo === "demo" && Number.isFinite(ubicacion.latitude) && Number.isFinite(ubicacion.longitude)
      && ubicacion.latitude >= -90 && ubicacion.latitude <= 90 && ubicacion.longitude >= -180 && ubicacion.longitude <= 180);

    for (const consultorio of ubicacionesValidas) {
      const popupRoot = document.createElement("div");
      const nombre = document.createElement("strong");
      nombre.textContent = consultorio.dentista.name || "Profesional";
      popupRoot.append(nombre);
      const consultorioNombre = document.createElement("p");
      consultorioNombre.textContent = consultorio.practice_name;
      popupRoot.append(consultorioNombre);
      if (consultorio.practice_address) {
        const direccion = document.createElement("p");
        direccion.textContent = consultorio.practice_address;
        popupRoot.append(direccion);
      }
      const enlace = document.createElement("a");
      enlace.href = `${basePerfil}/${encodeURIComponent(consultorio.dentist_id)}`;
      enlace.textContent = "Ver perfil";
      popupRoot.append(enlace);
      const elemento = document.createElement("button");
      elemento.type = "button";
      elemento.className = styles.marcadorDentista;
      elemento.dataset.dentistId = consultorio.dentist_id;
      elemento.setAttribute("aria-label", `Ver odontólogo ${consultorio.dentista.name || "sin nombre"}, ${consultorio.practice_name}`);
      elemento.addEventListener("click", () => alSeleccionar?.(consultorio.dentist_id));
      const marcador = new Marker({ element: elemento, anchor: "bottom" })
        .setLngLat([consultorio.longitude, consultorio.latitude])
        .setPopup(new Popup({ offset: 28 }).setDOMContent(popupRoot))
        .addTo(mapa.current);
      marcadores.current.push(marcador);
      marcadoresPorDentista.current.set(consultorio.dentist_id, marcador);
    }

    for (const demo of demosValidas) {
      const popupRoot = document.createElement("div");
      const nombre = document.createElement("strong");
      const perfil = demo.dentist_id ? perfilDemo(demo.dentist_id) : undefined;
      nombre.textContent = perfil?.name ?? demo.name;
      if (perfil) {
        const especialidad = document.createElement("p");
        especialidad.textContent = perfil.specialty + " · Profesional ficticio";
        popupRoot.append(especialidad);
      }
      popupRoot.append(nombre);
      const etiqueta = document.createElement("p");
      etiqueta.textContent = `Referencia geográfica: ${demo.name}`;
      popupRoot.append(etiqueta);
      const distrito = document.createElement("p");
      distrito.textContent = `${demo.district}, ${demo.city}, ${demo.country}`;
      popupRoot.append(distrito);
      const nota = document.createElement("small");
      nota.textContent = perfil ? `Dirección publicada: ${perfil.practice_address}. Este profesional ficticio no trabaja necesariamente en este centro; no hay reservas por DentaIA.` : "Punto académico no vinculado a profesionales.";
      popupRoot.append(nota);
      if (demo.dentist_id) {
        const enlace = document.createElement("a");
        enlace.href = `${basePerfil}/${encodeURIComponent(demo.dentist_id)}`;
        enlace.textContent = "Ver ficha de ejemplo";
        popupRoot.append(enlace);
      }
      const elemento = document.createElement("button");
      elemento.type = "button";
      elemento.className = styles.marcadorDemo;
      const icono = document.createElement("span");
      icono.className = styles.iconoDiente;
      icono.textContent = "🦷";
      icono.setAttribute("aria-hidden", "true");
      elemento.append(icono);
      elemento.setAttribute("aria-label", `Ver referencia geográfica de ${demo.name} en ${demo.district}`);
      if (demo.dentist_id) {
        elemento.dataset.dentistId = demo.dentist_id;
        elemento.addEventListener("click", () => alSeleccionar?.(demo.dentist_id!));
      }
      const marcador = new Marker({ element: elemento, anchor: "bottom" })
        .setLngLat([demo.longitude, demo.latitude])
        .setPopup(new Popup({ offset: 28 }).setDOMContent(popupRoot))
        .addTo(mapa.current);
      marcadores.current.push(marcador);
      if (demo.dentist_id) marcadoresPorDentista.current.set(demo.dentist_id, marcador);
    }

    if (ubicacion) {
      const persona = document.createElement("span");
      persona.className = styles.radarAncla;
      persona.setAttribute("aria-label", "Ubicación aproximada de este dispositivo");
      persona.dataset.radar = String(modoPaciente && radarActivo);
      const anillos = document.createElement("span");
      anillos.className = styles.radarAnillos;
      anillos.setAttribute("aria-hidden", "true");
      const centro = document.createElement("span");
      centro.className = styles.marcadorUbicacion;
      centro.setAttribute("aria-hidden", "true");
      persona.append(anillos, centro);
      marcadorUsuario.current = persona;
      marcadores.current.push(new Marker({ element: persona, anchor: "center" })
        .setLngLat([ubicacion.longitude, ubicacion.latitude])
        .setPopup(new Popup({ offset: 15 }).setText("Ubicación aproximada de este dispositivo; no se guarda."))
        .addTo(mapa.current));
      mapa.current.flyTo({ center: [ubicacion.longitude, ubicacion.latitude], zoom: 13, duration: 650 });
    } else if (ubicacionesValidas.length + demosValidas.length > 0) {
      const puntos = [...ubicacionesValidas, ...demosValidas];
      if (puntos.length === 1) mapa.current.flyTo({ center: [puntos[0].longitude, puntos[0].latitude], zoom: 13, duration: 500 });
      else {
        const longitudes = puntos.map(d => d.longitude);
        const latitudes = puntos.map(d => d.latitude);
        mapa.current.fitBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]], { padding: 52, maxZoom: 14, duration: 500 });
      }
    }
  }, [alSeleccionar, listo, ubicacion, ubicaciones, modoPaciente, basePerfil]);

  useEffect(() => {
    if (marcadorUsuario.current) marcadorUsuario.current.dataset.radar = String(modoPaciente && radarActivo);
    for (const [id, marker] of marcadoresPorDentista.current) {
      marker.getElement().dataset.cercano = String(modoPaciente && !!ubicacion && idsCercanos.includes(id));
    }
  }, [idsCercanos, listo, modoPaciente, radarActivo, ubicacion]);

  useEffect(() => {
    if (!listo || !mapa.current) return;
    if (visible) mapa.current.resize();
    for (const [id, marcador] of marcadoresPorDentista.current) {
      marcador.getElement().dataset.selected = String(id === seleccionado);
    }
    const marcador = marcadoresPorDentista.current.get(seleccionado);
    if (marcador && visible) {
      mapa.current.flyTo({ center: marcador.getLngLat(), zoom: 14, duration: 450 });
      if (!marcador.getPopup()?.isOpen()) marcador.togglePopup();
    }
  }, [listo, seleccionado, visible, ubicaciones]);

  return <div className={styles.contenedorMapa} data-vista={modoPaciente ? "paciente" : "publica"}>
    <div ref={contenedor} className={styles.mapa} role="application" aria-label="Mapa interactivo de consultorios odontológicos" />
    {!listo && <span className={styles.cargando} role="status">Cargando mapa…</span>}
    {errorTeselas && <div className={styles.errorTeselas} role="alert">No se pudieron cargar algunas teselas del mapa. Puedes consultar los perfiles en la lista.</div>}
  </div>;
}
