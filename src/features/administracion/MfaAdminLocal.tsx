"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { crearFlujoMfaLocal, esperaCaducidadSesion, ErrorMfaLocal, type EstadoMfaLocal } from "./mfa-local";
import styles from "./mfa-local.module.css";

export default function MfaAdminLocal({ permitirOperaciones }: { permitirOperaciones: boolean }) {
  const flujo = useMemo(() => crearFlujoMfaLocal(() => getSupabaseBrowserClient().auth, permitirOperaciones), [permitirOperaciones]);
  const [estado, setEstado] = useState<EstadoMfaLocal | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [factor, setFactor] = useState("");
  const [codigo, setCodigo] = useState("");
  const [qr, setQr] = useState("");
  const version = useRef(0);
  const identidad = useRef<string | null>(null);

  const retirarDatos = useCallback((mensaje: string) => {
    version.current++; flujo.limpiar();
    setEstado(null); setCodigo(""); setQr(""); setFactor(""); setAcepta(false); setOcupado(false); setError(mensaje);
  }, [flujo]);

  useEffect(() => {
    let caducidad: ReturnType<typeof setTimeout> | undefined;
    const programarCaducidad = (expiresAt: number | undefined) => {
      if (caducidad) clearTimeout(caducidad);
      caducidad = setTimeout(() => retirarDatos("La sesión caducó. Comprueba de nuevo la sesión o vuelve a Mi cuenta."), esperaCaducidadSesion(expiresAt));
    };
    try {
      const { data: { subscription } } = getSupabaseBrowserClient().auth.onAuthStateChange((evento, sesion) => {
        const siguiente = sesion?.user.id ?? null;
        if (sesion) programarCaducidad(sesion.expires_at);
        else if (caducidad) clearTimeout(caducidad);
        if (evento === "INITIAL_SESSION") { identidad.current = siguiente; return; }
        if (evento === "SIGNED_OUT" || siguiente !== identidad.current) {
          identidad.current = siguiente; retirarDatos("La sesión cambió. Vuelve a comprobar el estado."); return;
        }
        if (evento === "MFA_CHALLENGE_VERIFIED") { setQr(""); setCodigo(""); }
      });
      return () => { if (caducidad) clearTimeout(caducidad); version.current++; flujo.limpiar(); subscription.unsubscribe(); };
    } catch { setError("No se pudo preparar la sesión local."); }
  }, [flujo, retirarDatos]);

  async function ejecutar(operacion: () => Promise<void>) {
    const actual = version.current;
    setOcupado(true); setError("");
    try { await operacion(); }
    catch (e) {
      if (actual !== version.current) return;
      if (e instanceof ErrorMfaLocal && ["SIN_SESION", "SESION_CADUCADA", "SESION_CAMBIADA", "FACTOR_NO_ADMITIDO"].includes(e.codigo)) retirarDatos(e.message);
      else setError(e instanceof ErrorMfaLocal ? e.message : "No se pudo completar la operación. No se muestran detalles internos.");
    }
    finally { if (actual === version.current) setOcupado(false); }
  }
  async function consultar() {
    const actual = version.current;
    setCodigo(""); setEstado(null);
    const r = await flujo.consultar();
    if (actual !== version.current) return;
    setEstado(r); if (!qr) setFactor(r.verificados[0]?.id ?? r.factoresPendientes[0]?.id ?? "");
  }

  const motivoEnrolamiento = ocupado ? "Espera a que termine la operación actual."
    : !permitirOperaciones ? "El enrolamiento MFA no está habilitado en este servidor local."
      : qr ? "El enrolamiento ya se inició: escanea el QR y verifica el código, sin iniciar otro factor."
        : !estado ? "Primero pulsa Comprobar sesión y acceso."
          : estado.verificados.length > 0 ? "Ya tienes un factor verificado: selecciónalo e introduce su código."
            : estado.pendientes > 0 ? "Ya existe un factor pendiente: no se creará otro. Si ya lo escaneaste, selecciónalo y verifica su código."
              : !acepta ? "Marca la casilla de autorización para iniciar el enrolamiento." : null;

  return <main className={styles.pagina}>
    <h1>Preparación MFA de DI-151 Parte 2</h1>
    <p>Vista exclusiva de desarrollo para la cuenta de pruebas que haya autorizado el propietario. No administra roles ni muestra usuarios o datos clínicos.</p>
    <p>Con una sesión aal1 el acceso administrativo debe seguir bloqueado. Escanea personalmente el QR e introduce el código únicamente aquí; no lo compartas por chat.</p>
    <p><Link href="/cuenta">Ir a Mi cuenta</Link> · <Link href="/desarrollo/panel-admin">Volver al panel local</Link></p>
    <section className={styles.bloque} aria-labelledby="estado-mfa">
      <h2 id="estado-mfa">Sesión y acceso</h2>
      <p>El nivel del SDK es informativo. La autorización efectiva se comprueba en el servidor en cada petición.</p>
      <button type="button" disabled={ocupado} onClick={() => void ejecutar(consultar)}>Comprobar sesión y acceso</button>
      {ocupado && <p role="status">Procesando…</p>}
      {error && <p role="alert">{error}</p>}
      {estado && <div role="status">
        <p>Nivel informado por el SDK: <strong>{estado.nivel}</strong>. Factores TOTP verificados: {estado.verificados.length}. Pendientes: {estado.pendientes}.</p>
        <p>Comprobación administrativa del servidor: <strong>HTTP {estado.accesoHTTP}</strong>.</p>
        {estado.accesoHTTP === 200 ? <p>El servidor aceptó el acceso. La consulta de usuarios reales se verifica aparte mediante el protocolo de lectura.</p>
          : estado.accesoHTTP === 503 ? <p>La verificación del servidor no está disponible. Comprueba la conexión y vuelve a consultar; no se acepta acceso por este error.</p>
            : <p>No se ha aceptado el acceso administrativo. Completar MFA no asigna el rol superusuario; HTTP 403 sigue siendo una denegación efectiva.</p>}
      </div>}
    </section>
    <section className={styles.bloque} aria-labelledby="preparar-mfa">
      <h2 id="preparar-mfa">Enrolamiento y desafío TOTP</h2>
      {!permitirOperaciones && <p role="note">Operaciones desactivadas. El propietario debe autorizar y configurar DENTAIA_QA_MFA_ENABLED=true solo para esta prueba local. Esta vista no ejecutará enrolamiento ni desafíos mientras permanezca desactivada.</p>}
      {permitirOperaciones && <p role="note">Operaciones MFA locales habilitadas. Cada enrolamiento o verificación requiere tu consentimiento y una acción explícita.</p>}
      <p>Enrolar crea un factor remoto. Verificarlo puede cerrar otras sesiones. El QR contiene un secreto: no compartirlo, capturarlo ni guardarlo. Aquí no se eliminan factores automáticamente.</p>
      <label className={styles.control}><input type="checkbox" checked={acepta} disabled={ocupado || !permitirOperaciones}
        onChange={e => setAcepta(e.target.checked)} /> Tengo autorización para modificar el MFA de esta cuenta ficticia y entiendo los efectos.</label>
      {motivoEnrolamiento && <p id="motivo-enrolamiento" role="status">{motivoEnrolamiento}</p>}
      <button type="button" disabled={motivoEnrolamiento !== null} aria-describedby={motivoEnrolamiento ? "motivo-enrolamiento" : undefined}
        onClick={() => void ejecutar(async () => {
          const actual = version.current;
          const r = await flujo.iniciarEnrolamiento(acepta);
          if (actual !== version.current) return;
          setQr(r.qr); setFactor(r.factorId); setCodigo("");
        })}>Iniciar enrolamiento TOTP autorizado</button>
      {qr && estado && <div><p>Escanea el QR con tu autenticador. Solo se conserva en memoria hasta verificar, salir, caducar la sesión o recargar.</p>
        {/* Imagen local aislada: no insertar SVG mediante HTML ni enviar el QR a un optimizador externo. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR secreto de enrolamiento TOTP; no compartir" width={240} height={240} className={styles.qr} /></div>}
      {!qr && estado && (estado.verificados.length > 0 || estado.pendientes > 0) && <label className={styles.control}>Factor TOTP propio
        <select value={factor} disabled={ocupado} onChange={e => setFactor(e.target.value)}>
          <optgroup label="Verificados">{estado.verificados.map((f, i) => <option key={f.id} value={f.id}>Factor verificado {i + 1}</option>)}</optgroup>
          <optgroup label="Pendientes">{estado.factoresPendientes.map((f, i) => <option key={f.id} value={f.id}>Factor pendiente {i + 1}</option>)}</optgroup>
        </select></label>}
      {!qr && !!estado?.pendientes && <p>Si ya escaneaste el QR, selecciona el factor pendiente e introduce su código para retomarlo. Si perdiste el QR sin escanearlo, requiere revisión autorizada: no se puede recuperar aquí ni se borra el factor automáticamente.</p>}
      <form onSubmit={e => {
        e.preventDefault(); const introducido = codigo; setCodigo("");
        void ejecutar(async () => {
          const actual = version.current;
          const r = await flujo.verificar(factor, introducido, acepta);
          if (actual !== version.current) return;
          setQr(""); setEstado(r); setFactor(r.verificados[0]?.id ?? r.factoresPendientes[0]?.id ?? "");
        });
      }}>
        <label className={styles.control} htmlFor="codigo-totp">Código de seis dígitos del autenticador</label>
        <input id="codigo-totp" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          value={codigo} disabled={ocupado || !permitirOperaciones || !acepta || !estado || !factor} onChange={e => setCodigo(e.target.value)} />
        <button type="submit" disabled={ocupado || !permitirOperaciones || !acepta || !estado || !factor || !/^\d{6}$/.test(codigo)}>Crear desafío y verificar código</button>
      </form>
    </section>
  </main>;
}
