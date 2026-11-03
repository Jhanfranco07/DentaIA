"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { crearClienteAdministrativo, type ErrorClienteAdministrativo } from "./cliente";
import EstadoAdministrativo from "./EstadoAdministrativo";
import UsuariosAdministrativosDemo from "./UsuariosAdministrativosDemo";
import styles from "./administracion.module.css";

/** Se monta solo al elegir API. Reutiliza la sesión: no inicia login, MFA ni asignaciones. */
export default function UsuariosAdministrativosConectados() {
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
    <p>No se muestran cuentas. Esta vista no habilita ni modifica MFA, roles o permisos.</p>
    <div className="actions"><button type="button" className={styles.accionEstado} onClick={() => { setAcceso("comprobando"); setRevision(v => v + 1); }}>Volver a comprobar acceso</button>
      {acceso.status === 401 && <Link href="/cuenta">Ir a Mi cuenta</Link>}</div>
  </section>;
  return <UsuariosAdministrativosDemo key={revision} cliente={cliente} onAccesoDenegado={setAcceso} />;
}
