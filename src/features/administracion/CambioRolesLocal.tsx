"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { uuidRolesValido } from "./cambios-roles";
import type { AsignacionRoles, CambioRoles } from "./cambios-roles";
import { respuestaRolesPanel } from "./cliente-panel-real";
import styles from "./mfa-local.module.css";

type Estado = { revision: number; asignacion: AsignacionRoles | null };
type Pendiente = { clave: string; cambio: CambioRoles };
/** Herramienta local de QA; no habilita el servidor ni aprovisiona aprobaciones. */
export default function CambioRolesLocal({ usuarioInicial = "", embebido = false, onCambioConfirmado, onAccesoDenegado }: {
  usuarioInicial?: string; embebido?: boolean; onCambioConfirmado?: () => void; onAccesoDenegado?: (status: 401 | 403) => void;
} = {}) {
  const [objetivo, setObjetivo] = useState(usuarioInicial);
  const [aprobacion, setAprobacion] = useState("");
  const [operacion, setOperacion] = useState<"asignar" | "revocar">("asignar");
  const [rol, setRol] = useState<CambioRoles["rol"]>("paciente");
  const [autorizado, setAutorizado] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const version = useRef(0);
  const enCurso = useRef(false);
  const abortar = useRef<AbortController | null>(null);
  useEffect(() => {
    const { data: { subscription } } = getSupabaseBrowserClient().auth.onAuthStateChange(evento => {
      if (["INITIAL_SESSION", "TOKEN_REFRESHED"].includes(evento)) return;
      version.current++; abortar.current?.abort(); enCurso.current = false;
      setEstado(null); setPendiente(null); setObjetivo(""); setAprobacion(""); setAutorizado(false); setOcupado(false);
      setMensaje("La sesión cambió. Una petición ya enviada podría haberse confirmado: conserva su clave para reconciliar antes de iniciar otra.");
    });
    return () => { version.current++; abortar.current?.abort(); subscription.unsubscribe(); };
  }, []);
  async function solicitar(caso: "consultar" | "aplicar" | "reintentar") {
    if (enCurso.current) return;
    if (caso === "consultar" ? pendiente || !uuidRolesValido(objetivo) : caso === "aplicar" ? !estado || pendiente || !autorizado || !uuidRolesValido(aprobacion) : !pendiente) return;
    const actual = ++version.current;
    const controller = new AbortController(); abortar.current = controller;
    enCurso.current = true; setOcupado(true); setMensaje("");
    const intento: Pendiente | null = caso === "consultar" ? null : pendiente ?? {
      clave: crypto.randomUUID(), cambio: { usuarioId: objetivo.toLowerCase(), operacion, rol,
        revisionEsperada: estado!.revision, asignacionEsperada: estado!.asignacion, aprobacionId: aprobacion.toLowerCase() },
    };
    if (intento) setPendiente(intento);
    try {
      const { data, error } = await getSupabaseBrowserClient().auth.getSession();
      if (error || !data.session) throw new Error("SESION");
      const headers: Record<string, string> = { Authorization: `Bearer ${data.session.access_token}` };
      if (intento) { headers["Content-Type"] = "application/json"; headers["Idempotency-Key"] = intento.clave; }
      const r = await fetch("/api/administracion/roles" + (intento ? "" : "?usuarioId=" + encodeURIComponent(objetivo)), {
        method: intento ? "POST" : "GET", headers, body: intento ? JSON.stringify(intento.cambio) : undefined,
        credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      const body = await r.json();
      if (actual !== version.current) return;
      if (r.status === 200) {
        const validada = respuestaRolesPanel(body, intento?.clave ?? null);
        if (!validada) throw new Error("FORMATO");
        setEstado({ revision: validada.revision, asignacion: validada.asignacion });
        setPendiente(null); setAutorizado(false);
        setMensaje(`HTTP 200 · ${validada.resultado} · revisión ${validada.revision}. ${intento ? "Vuelve a consultar los usuarios para verificar el estado actualizado." : "Consulta completada por la API."}`);
        if (intento) onCambioConfirmado?.();
      } else {
        if (r.status === 401 || (r.status === 403 && (!body?.codigo || body.codigo === "SESION_ESCRITURA_NO_VALIDA"))) onAccesoDenegado?.(r.status);
        // Conservar la clave ante cualquier rechazo: no improvisar otro cambio o identidad.
        // Permite repetir con la misma clave tras recuperar autorización/disponibilidad.
        setMensaje(`HTTP ${r.status}. ${r.status === 503 ? "Escritura desactivada, servicio no disponible o estado no confirmado." : "Solicitud rechazada."} ${intento ? "Conserva la misma clave y contenido; resuelve el motivo antes de reintentar." : "Comprueba sesión, recencia TOTP y configuración."}`);
      }
    } catch {
      if (actual === version.current) setMensaje("No se confirmó el resultado. No asumas rollback; conserva la clave y repite el mismo intento después de recuperar la sesión o el servicio.");
    } finally { if (actual === version.current) { enCurso.current = false; setOcupado(false); } }
  }
  const Contenedor = embebido ? "section" : "main";
  return <Contenedor className={embebido ? undefined : styles.pagina} aria-label="Operación controlada de roles">
    {embebido ? <h3>Consultar y actualizar roles autorizados</h3> : <h1>QA local de roles — DI-151 Parte 2</h1>}
    <p>Escrituras desactivadas por defecto. Usar únicamente después de aprobar la migración y una operación concreta sobre cuentas ficticias. Esta pantalla no crea aprobaciones ni cambia configuración.</p>
    <p><Link href="/desarrollo/mfa-admin">Verificar TOTP reciente</Link> · <Link href="/cuenta">Mi cuenta</Link></p>
    <fieldset disabled={ocupado || pendiente !== null}>
      <legend>Operación controlada</legend>
      <p><label htmlFor="qa-objetivo">UUID de la cuenta ficticia objetivo</label><input id="qa-objetivo" value={objetivo} onChange={e => { setObjetivo(e.target.value.trim()); setEstado(null); }} autoComplete="off" /></p>
      <button type="button" disabled={!uuidRolesValido(objetivo)} onClick={() => void solicitar("consultar")}>Consultar estado y revisión</button>
      {estado && <p>Revisión: {estado.revision}. Roles actuales: {estado.asignacion?.roles.join(", ") ?? "sin asignación"}.</p>}
      <p><label htmlFor="qa-aprobacion">UUID de aprobación independiente</label><input id="qa-aprobacion" value={aprobacion} onChange={e => setAprobacion(e.target.value.trim())} autoComplete="off" /></p>
      <p><label htmlFor="qa-operacion">Operación aprobada</label><select id="qa-operacion" value={operacion} onChange={e => { setOperacion(e.target.value as "asignar" | "revocar"); if (e.target.value === "asignar" && rol === "odontologo") setRol("paciente"); }}><option value="asignar">Asignar</option><option value="revocar">Revocar</option></select></p>
      <p><label htmlFor="qa-rol">Rol de la aprobación</label><select id="qa-rol" value={rol} onChange={e => setRol(e.target.value as CambioRoles["rol"])}><option value="paciente">Paciente</option><option value="superusuario">Superusuario (aprobación independiente y MFA)</option><option value="odontologo" disabled={operacion === "asignar"}>Odontólogo (solo revocación)</option></select></p>
      <p><label><input type="checkbox" checked={autorizado} onChange={e => setAutorizado(e.target.checked)} /> Tengo aprobación explícita para esta escritura de prueba y ya pasaron las pruebas SQL aisladas.</label></p>
      <button type="button" disabled={!estado || !autorizado || !uuidRolesValido(aprobacion)} onClick={() => void solicitar("aplicar")}>Enviar cambio aprobado</button>
    </fieldset>
    {pendiente && <section aria-label="Intento conservado"><p>Clave del intento: <code>{pendiente.clave}</code>. Anótala antes de abandonar la pantalla. No se guarda en archivos ni en el almacenamiento del navegador.</p>
      <button type="button" disabled={ocupado} onClick={() => void solicitar("reintentar")}>Reintentar exactamente la misma solicitud</button>
      <p>Si el servidor rechaza definitivamente el intento, reconciliar con auditoría y lectura antes de iniciar otro; no regenerar claves para eludir una revisión o aprobación rechazada.</p></section>}
    {ocupado && <p role="status">Consultando el servidor…</p>}
    {mensaje && <p role="status">{mensaje}</p>}
  </Contenedor>;
}
