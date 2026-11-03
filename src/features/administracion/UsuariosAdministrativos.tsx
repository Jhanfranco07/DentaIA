"use client";

import { useState } from "react";
import UsuariosAdministrativosConectados from "./UsuariosAdministrativosConectados";
import UsuariosAdministrativosDemo from "./UsuariosAdministrativosDemo";
import styles from "./administracion.module.css";

export default function UsuariosAdministrativos() {
  const [modo, setModo] = useState<"local" | "api">("local");
  return <>
    <div className={`${styles.bloque} ${styles.selectorCanal}`}>
      <label>Canal de consulta<select value={modo} onChange={e => setModo(e.target.value === "api" ? "api" : "local")}>
        <option value="local">Demostración local sin sesión</option>
        <option value="api">API protegida con sesión existente</option>
      </select></label>
      <p>{modo === "local" ? "Fixtures en memoria: no se llama a la API ni se acredita autorización."
        : "Peticiones reales a los endpoints locales protegidos por DI-150 y AAL2. El proveedor del servidor sigue siendo sintético; no es un listado real de Supabase."}</p>
      <p>Elegir un canal no concede permisos. Los errores de la API no activan la demo local automáticamente.</p>
    </div>
    {modo === "local" ? <UsuariosAdministrativosDemo /> : <UsuariosAdministrativosConectados />}
  </>;
}
