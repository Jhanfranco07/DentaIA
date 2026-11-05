"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { crearDesafioMfaAdministrativo, mensajeFalloMfaDesafio } from "./mfa-desafio";
import styles from "./administracion.module.css";

export default function DesafioMfaAdministrativo({ alCompletar }: { alCompletar: () => void }) {
  const flujo = useMemo(() => crearDesafioMfaAdministrativo(() => getSupabaseBrowserClient().auth), []);
  const [factores, setFactores] = useState<string[]>([]);
  const [factorId, setFactorId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    let vigente = true;
    void flujo.factoresVerificados().then(lista => {
      if (!vigente) return;
      setFactores(lista); setFactorId(lista[0] ?? ""); setCargando(false);
    }).catch(e => {
      if (!vigente) return;
      setError(mensajeFalloMfaDesafio(e)); setCargando(false);
    });
    return () => { vigente = false; };
  }, [flujo]);

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verificando || !factorId) return;
    const introducido = codigo;
    setCodigo(""); setError(""); setVerificando(true);
    try {
      await flujo.verificar(factorId, introducido);
      alCompletar();
    } catch (e) {
      setError(mensajeFalloMfaDesafio(e));
    } finally {
      setVerificando(false);
    }
  }

  return <section className={styles.bloque} aria-labelledby="titulo-desafio-mfa">
    <h3 id="titulo-desafio-mfa">Verificación adicional requerida</h3>
    <p>La sesión actual tiene nivel AAL1. Confirma un factor TOTP ya verificado para elevarla a AAL2. Esto no cambia roles ni permisos; el servidor volverá a comprobarlos.</p>
    {cargando ? <p role="status">Comprobando factores MFA de esta sesión…</p> : factores.length === 0
      ? <p role="alert">No hay un factor TOTP verificado disponible para esta cuenta. Solicita la configuración MFA por el procedimiento autorizado.</p>
      : <form onSubmit={enviar}>
        {factores.length > 1 && <label className={styles.control} htmlFor="factor-mfa-admin">Factor verificado
          <select id="factor-mfa-admin" value={factorId} disabled={verificando} onChange={e => setFactorId(e.target.value)}>
            {factores.map((id, indice) => <option key={id} value={id}>Autenticador {indice + 1}</option>)}
          </select>
        </label>}
        <label className={styles.control} htmlFor="codigo-mfa-admin">Código actual de seis dígitos
          <input id="codigo-mfa-admin" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={codigo} disabled={verificando} onChange={e => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </label>
        <button type="submit" className={styles.accionEstado} disabled={verificando || codigo.length !== 6 || !factorId}>
          {verificando ? "Verificando…" : "Verificar y volver a comprobar acceso"}
        </button>
      </form>}
    {error && <p role="alert" className={styles.errorAdmin}>{error}</p>}
  </section>;
}
