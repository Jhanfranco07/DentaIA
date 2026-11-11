"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { InformeLectura } from "./validacion-lectura";
import styles from "./mfa-local.module.css";

type Evidencia = InformeLectura & { fecha: string; ejecucionId: string; evidenciaLocal: boolean };
export default function ValidacionLecturaAdmin() {
  const [resultado, setResultado] = useState<Evidencia | null>(null);
  const [http, setHttp] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const abortar = useRef<AbortController | null>(null);
  const version = useRef(0);
  useEffect(() => {
    try {
      const { data: { subscription } } = getSupabaseBrowserClient().auth.onAuthStateChange((evento) => {
        if (evento === "INITIAL_SESSION" || evento === "TOKEN_REFRESHED") return;
        version.current++; abortar.current?.abort(); setResultado(null); setHttp(null); setOcupado(false);
      });
      return () => { version.current++; abortar.current?.abort(); subscription.unsubscribe(); };
    } catch { setError("No se pudo preparar la sesión. Revisa Mi cuenta."); }
  }, []);
  async function ejecutar() {
    const actual = ++version.current;
    abortar.current?.abort(); const controlador = new AbortController(); abortar.current = controlador;
    setOcupado(true); setResultado(null); setHttp(null); setError("");
    try {
      const { data, error: fallo } = await getSupabaseBrowserClient().auth.getSession();
      if (fallo) throw new Error("SESION");
      // SDK normal del navegador: no se extrae ni almacena el token fuera de esta petición.
      const r = await fetch("/api/desarrollo/validar-lectura-admin", { method: "GET",
        headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
        credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer",
        signal: AbortSignal.any([controlador.signal, AbortSignal.timeout(180000)]),
      });
      const body = await r.json();
      if (actual !== version.current) return;
      setHttp(r.status);
      if (!body || !["COHERENTE", "FALLO", "BLOQUEADA"].includes(body.estado) || !Array.isArray(body.casos)) throw new Error("FORMATO");
      setResultado(body);
    } catch {
      if (actual === version.current) setError("No se pudo completar la comprobación. Revisa la sesión y el servicio; no se muestran detalles internos.");
    } finally { if (actual === version.current) setOcupado(false); }
  }
  return <main className={styles.pagina}>
    <h1>Validación de lectura real — DI-151 Parte 2</h1>
    <p>Usa la sesión actual de esta pestaña. Solo consultas GET; no modifica usuarios, roles o datos remotos.</p>
    <p>La herramienta invoca el handler real y su guard en cada caso. Solo presenta HTTP, recuentos y coherencia; no muestra nombres, UUID, factores ni credenciales.</p>
    <p><Link href="/desarrollo/mfa-admin">Comprobar MFA</Link> · <Link href="/cuenta">Mi cuenta</Link></p>
    <button type="button" disabled={ocupado} onClick={() => void ejecutar()}>Ejecutar validación de lectura real</button>
    {ocupado && <p role="status">Ejecutando consultas reales. Conserva la sesión; puede tardar hasta tres minutos.</p>}
    {error && <p role="alert">{error}</p>}
    {resultado && <section className={styles.bloque} aria-label="Resultado sin datos personales">
      <p role="status">Resultado: <strong>{resultado.estado}</strong>. HTTP de la herramienta: {http}. Registros: {resultado.registrosConsultados ?? "no consultados"}.</p>
      <p>Perfiles presentes: {resultado.perfilesPresentes ?? "no verificado"}; ausentes: {resultado.perfilesAusentes ?? "no verificado"}. Coherencia de paginación: {resultado.coherenciaPaginacion === null ? "no verificada" : resultado.coherenciaPaginacion ? "correcta" : "fallida"}.</p>
      <p>Evidencia local saneada: {resultado.evidenciaLocal ? "guardada" : "no guardada"}. Ejecución: {resultado.ejecucionId}.</p>
      {http === 403 && <p>El endpoint rechazó esta sesión. No se consultaron usuarios mediante el proveedor.</p>}
      {http === 401 && <p>Inicia sesión; una sesión ausente o inválida no obtiene el listado.</p>}
      {resultado.motivo && <p>Motivo técnico saneado: {resultado.motivo}.</p>}
      <div style={{ overflowX: "auto" }}><table><caption>Respuestas del handler real</caption>
        <thead><tr><th>Caso</th><th>HTTP</th><th>Filas</th><th>Total</th><th>Página</th><th>Coherente</th></tr></thead>
        <tbody>{resultado.casos.map(c => <tr key={c.caso}><td>{c.caso}</td><td>{c.http}</td><td>{c.registros ?? "—"}</td><td>{c.total ?? "—"}</td><td>{c.pagina ?? "—"}</td><td>{c.correcto ? "sí" : "no"}</td></tr>)}</tbody>
      </table></div>
    </section>}
  </main>;
}
