"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatearPrecio, inicialesDe, normalizar, textoOpcional } from "./formato";
import type { Dentista } from "./tipos";
import styles from "./directorio.module.css";

type Carga =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; dentistas: Dentista[] };

export default function DirectorioLista() {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [distrito, setDistrito] = useState("");
const busquedaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        // El cliente se crea aquí, dentro del efecto: solo se ejecuta en el navegador.
        const client = getSupabaseBrowserClient();
        const { data, error } = await client
          .from("dentists")
          .select("*")
          .eq("is_active", true)
          .order("name");
        if (cancelado) return;
        if (error) setCarga({ estado: "error", mensaje: error.message });
        else setCarga({ estado: "listo", dentistas: data ?? [] });
      } catch (e) {
        if (cancelado) return;
        setCarga({ estado: "error", mensaje: e instanceof Error ? e.message : "Error desconocido." });
      }
    }
    cargar();
    return () => { cancelado = true; };
  }, [intento]);

  function reintentar() {
    setCarga({ estado: "cargando" });
    setIntento(n => n + 1);
  }

  const dentistas = carga.estado === "listo" ? carga.dentistas : [];

  const distritos = useMemo(() => {
    const unicos = new Set(dentistas.map(d => d.district.trim()).filter(Boolean));
    return [...unicos].sort((a, b) => a.localeCompare(b, "es"));
  }, [dentistas]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    return dentistas.filter(d => {
      const coincideTexto = !q || normalizar(d.name).includes(q) || normalizar(d.specialty).includes(q);
      const coincideDistrito = !distrito || d.district.trim() === distrito;
      return coincideTexto && coincideDistrito;
    });
  }, [dentistas, busqueda, distrito]);

  function limpiarFiltros() {
    setBusqueda("");
    setDistrito("");
    busquedaRef.current?.focus();
  }

  return (
    <section className={styles.pagina}>
      <header className={styles.cabecera}>
        <span className={styles.etiqueta}>Directorio odontológico</span>
        <h1>Encuentra al profesional adecuado</h1>
        <p>
          Busca por nombre o especialidad y filtra por distrito. Los perfiles y precios de este
          prototipo son <strong>ficticios</strong> y no permiten contactar ni reservar con personas reales.
        </p>
      </header>

      {carga.estado === "cargando" && (
        <div className={styles.aviso} role="status" aria-live="polite">Cargando odontólogos…</div>
      )}

      {carga.estado === "error" && (
        <div className={`${styles.aviso} ${styles.avisoError}`} role="alert">
          <strong>No pudimos cargar el directorio.</strong>
  <p>Revisa tu conexión a internet y vuelve a intentarlo. Si el problema continúa, inténtalo de nuevo más tarde.</p>
          <button type="button" className={styles.boton} onClick={reintentar}>Reintentar</button>
        </div>
      )}

      {carga.estado === "listo" && dentistas.length === 0 && (
        <div className={styles.aviso} role="status">
          Por ahora no hay odontólogos activos en el directorio. Esto no es un error: vuelve a intentarlo más tarde.
        </div>
      )}

      {carga.estado === "listo" && dentistas.length > 0 && (
        <>
          <div className={styles.filtros}>
            <div className={styles.campo}>
              <label htmlFor="dir-busqueda">Buscar por nombre o especialidad</label>
              <input
                id="dir-busqueda"
                ref={busquedaRef}
                type="search"
                placeholder="Ej.: ortodoncia, Dra. …"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            <div className={styles.campo}>
              <label htmlFor="dir-distrito">Distrito</label>
              <select id="dir-distrito" value={distrito} onChange={e => setDistrito(e.target.value)}>
                <option value="">Todos los distritos</option>
                {distritos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <p className={styles.conteo} aria-live="polite">
            Mostrando {visibles.length} de {dentistas.length} profesionales
          </p>

          {visibles.length === 0 ? (
            <div className={styles.aviso} role="status">
              <strong>Ningún profesional coincide con tu búsqueda.</strong>
              <p>Prueba con otro texto o con otro distrito.</p>
              <button type="button" className={styles.boton} onClick={limpiarFiltros}>Limpiar filtros</button>
            </div>
          ) : (
            <ul className={styles.grilla}>
              {visibles.map(d => (
                <li key={d.id} className={styles.tarjeta}>
                  <div
                    className={styles.avatar}
                    style={{ background: d.avatar_color?.trim() || "#e3f6f0" }}
                    aria-hidden="true"
                  >
                    {inicialesDe(d.initials, d.name)}
                  </div>
                  <div className={styles.cuerpo}>
                    {d.is_demo && <span className={styles.ficticio}>Perfil ficticio</span>}
                    <h2>{textoOpcional(d.name, "Nombre no disponible")}</h2>
                    <p className={styles.especialidad}>{textoOpcional(d.specialty, "Especialidad no indicada")}</p>
                    <div className={styles.meta}>
                      <span>Distrito: {textoOpcional(d.district, "no indicado")}</span>
                      <span>Consulta: {formatearPrecio(d.consultation_price, d.currency)}</span>
                    </div>
                    <Link
                       href={`/directorio/${d.id}`}
                       className={styles.enlace}
                       aria-label={`Ver detalle de ${d.name.trim() || "profesional"}`}
                    >
                        Ver detalle →
                     </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}