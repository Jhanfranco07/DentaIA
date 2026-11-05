"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { crearClienteAdministrativo, type ErrorClienteAdministrativo } from "./cliente";
import EstadoAdministrativo from "./EstadoAdministrativo";
import DesafioMfaAdministrativo from "./DesafioMfaAdministrativo";
import styles from "./administracion.module.css";

const ContextoAcceso = createContext<{ invalidar: (error: ErrorClienteAdministrativo) => void } | null>(null);
export function useAccesoPanel() {
  const acceso = useContext(ContextoAcceso);
  if (!acceso) throw new Error("El panel requiere la comprobación administrativa del servidor.");
  return acceso;
}

/** Antes de montar cualquier sección. No sustituye el guard de cada API. */
export default function UsuariosAdministrativosConectados({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const [acceso, setAcceso] = useState<"comprobando" | "permitido" | ErrorClienteAdministrativo>("comprobando");
  const cliente = useMemo(() => crearClienteAdministrativo(async () => {
    const { data, error } = await getSupabaseBrowserClient().auth.getSession();
    if (error) throw error;
    return data.session?.access_token ?? null;
  }), []);

  useEffect(() => {
    try {
      const { data: { subscription } } = getSupabaseBrowserClient().auth.onAuthStateChange(evento => {
        if (evento === "INITIAL_SESSION") return;
        // Limpiar la vista de la identidad anterior antes de cualquier nueva comprobación.
        setAcceso("comprobando"); setRevision(v => v + 1);
      });
      return () => subscription.unsubscribe();
    } catch { /* La comprobación mostrará un error seguro sin revelar configuración. */ }
  }, []);
  useEffect(() => {
    let vigente = true;
    setAcceso("comprobando");
    void cliente.comprobarAcceso().then(r => { if (vigente) setAcceso(r.ok ? "permitido" : r); });
    return () => { vigente = false; };
  }, [cliente, revision]);

  if (acceso === "comprobando") return <EstadoAdministrativo estado="carga" />;
  if (acceso !== "permitido") return <section className={styles.bloque} aria-label="Resultado del acceso administrativo">
    <h2>Acceso a la API protegida</h2><p role="alert" className={styles.errorAdmin}>{acceso.mensaje}</p>
    <p>No se muestran cuentas. La verificación MFA solo eleva la sesión actual; el servidor conserva la decisión sobre roles y permisos.</p>
    {acceso.codigo === "MFA_AAL2_PENDIENTE" && <DesafioMfaAdministrativo alCompletar={() => {
      setAcceso("comprobando"); setRevision(v => v + 1);
    }} />}
    <div className="actions"><button type="button" className={styles.accionEstado} onClick={() => { setAcceso("comprobando"); setRevision(v => v + 1); }}>Volver a comprobar acceso</button>
      {acceso.status === 401 && <Link href="/cuenta">Ir a Mi cuenta</Link>}</div>
  </section>;
  return <ContextoAcceso.Provider key={revision} value={{ invalidar: setAcceso }}>{children}</ContextoAcceso.Provider>;
}
