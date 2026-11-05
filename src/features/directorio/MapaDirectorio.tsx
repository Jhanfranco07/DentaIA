"use client";

import { useEffect, useRef, useState } from "react";
import { Map, Marker, NavigationControl, Popup, setWorkerUrl, type Map as MapInstance, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MarcadorConsultorio } from "./tipos";
import type { PuntoGeografico } from "./geolocalizacion";
import { ubicacionConCoordenadasValidas } from "./ubicaciones";
import styles from "./mapa-directorio.module.css";

const LIMA = { longitude: -77.0428, latitude: -12.0464 };

function obtenerTeselas() {
  const configurada = process.env.NEXT_PUBLIC_OSM_TILE_URL?.trim();
  return configurada?.startsWith("https://") ? configurada : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
}

export default function MapaDirectorio({ ubicaciones, ubicacion, alSeleccionar }: {
  ubicaciones: MarcadorConsultorio[];
  ubicacion: PuntoGeografico | null;
  alSeleccionar?: (id: string) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapInstance | null>(null);
  const marcadores = useRef<Marker[]>([]);
  const [listo, setListo] = useState(false);

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
    const ubicacionesValidas = ubicaciones.filter(ubicacionConCoordenadasValidas);

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
      enlace.href = `/directorio/${encodeURIComponent(consultorio.dentist_id)}`;
      enlace.textContent = "Ver perfil";
      popupRoot.append(enlace);
      if (consultorio.dentista.is_demo) {
        const aviso = document.createElement("small");
        aviso.textContent = "Perfil académico ficticio";
        popupRoot.append(aviso);
      }
      const elemento = document.createElement("button");
      elemento.type = "button";
      elemento.className = styles.marcadorDentista;
      elemento.setAttribute("aria-label", `Ver odontólogo ${consultorio.dentista.name || "sin nombre"}, ${consultorio.practice_name}`);
      elemento.addEventListener("click", () => alSeleccionar?.(consultorio.dentist_id));
      const marcador = new Marker({ element: elemento, anchor: "bottom" })
        .setLngLat([consultorio.longitude, consultorio.latitude])
        .setPopup(new Popup({ offset: 28 }).setDOMContent(popupRoot))
        .addTo(mapa.current);
      marcadores.current.push(marcador);
    }

    if (ubicacion) {
      const persona = document.createElement("span");
      persona.className = styles.marcadorUbicacion;
      persona.setAttribute("aria-label", "Ubicación aproximada de este dispositivo");
      marcadores.current.push(new Marker({ element: persona, anchor: "center" })
        .setLngLat([ubicacion.longitude, ubicacion.latitude])
        .setPopup(new Popup({ offset: 15 }).setText("Ubicación aproximada de este dispositivo; no se guarda."))
        .addTo(mapa.current));
      mapa.current.flyTo({ center: [ubicacion.longitude, ubicacion.latitude], zoom: 13, duration: 650 });
    } else if (ubicacionesValidas.length > 0) {
      if (ubicacionesValidas.length === 1) mapa.current.flyTo({ center: [ubicacionesValidas[0].longitude, ubicacionesValidas[0].latitude], zoom: 13, duration: 500 });
      else if (ubicacionesValidas.length > 1) {
        const longitudes = ubicacionesValidas.map(d => d.longitude);
        const latitudes = ubicacionesValidas.map(d => d.latitude);
        mapa.current.fitBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]], { padding: 52, maxZoom: 14, duration: 500 });
      }
    }
  }, [alSeleccionar, listo, ubicacion, ubicaciones]);

  return <div className={styles.contenedorMapa}>
    <div ref={contenedor} className={styles.mapa} role="application" aria-label="Mapa interactivo de consultorios odontológicos" />
    {!listo && <span className={styles.cargando} role="status">Cargando mapa…</span>}
  </div>;
}
