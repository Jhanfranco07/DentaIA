"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PropuestaValidada } from "./servicios";
import { esDenegacionDeAcceso } from "./cliente";
import type { ClientePanelAdministrativo, ErrorClienteAdministrativo, ResultadoCliente } from "./cliente";
import styles from "./administracion.module.css";

type Props = { proveedor: ClientePanelAdministrativo; objetivo: string; onObjetivo: (id: string) => void; conectado: boolean; onAccesoDenegado?: (error: ErrorClienteAdministrativo) => void };
export default function PropuestaRolDemo({ proveedor, objetivo, onObjetivo, conectado, onAccesoDenegado }: Props) {
  const [rol, setRol] = useState("paciente");
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCliente<PropuestaValidada> | null>(null);
  const version = useRef(0);
  useEffect(() => {
    ++version.current; setResultado(null); setValidando(false);
    return () => { ++version.current; };
  }, [objetivo, rol, proveedor]);
  async function validar(event: FormEvent) {
    event.preventDefault();
    const actual = ++version.current;
    setValidando(true); setResultado(null);
    try {
      const respuesta = await proveedor.validarPropuesta({ operacion: "validar_cambio_rol", usuarioId: objetivo, rol });
      if (actual === version.current) {
        setResultado(respuesta);
        if (!respuesta.ok && esDenegacionDeAcceso(respuesta)) onAccesoDenegado?.(respuesta);
      }
    } catch {
      if (actual === version.current) setResultado({ ok: false, status: 503, codigo: "ERROR_CONSULTA", mensaje: "No se pudo validar la propuesta. No se confirmaron cambios." });
    } finally { if (actual === version.current) setValidando(false); }
  }
  return <section className={styles.propuesta} aria-labelledby="demo-propuesta-rol">
    <h3 id="demo-propuesta-rol" tabIndex={-1}>Revisar una propuesta de rol</h3>
    <p>{conectado ? "Validación mediante la API protegida. El operador procede exclusivamente del contexto verificado por el servidor." : "Validación local con cuentas sintéticas; no acredita autorización del servidor. Operador ficticio: Cuenta de prueba 01."} No guarda cambios ni asigna privilegios.</p>
    <form onSubmit={validar} className={styles.formularioAdmin}>
      <label htmlFor="demo-objetivo">UUID de la cuenta sintética</label>
      <input id="demo-objetivo" value={objetivo} onChange={event => onObjetivo(event.target.value)} maxLength={36} required autoComplete="off" />
      <label htmlFor="demo-rol-propuesto">Rol propuesto</label>
      <select id="demo-rol-propuesto" value={rol} onChange={event => setRol(event.target.value)}>
        <option value="paciente">Paciente</option><option value="odontologo">Odontólogo</option>
        <option value="superusuario">Superusuario · requiere aprobación independiente</option>
      </select>
      <button className={styles.accionEstado} type="submit" disabled={validando}>{validando ? "Validando propuesta…" : conectado ? "Validar propuesta por API" : "Validar propuesta local"}</button>
    </form>
    {validando && <p role="status">{conectado ? "Consultando la validación protegida…" : "Validando con el proveedor simulado…"}</p>}
    {resultado && <p role={resultado.ok ? "status" : "alert"} className={resultado.ok ? styles.mensajePropuesta : styles.errorAdmin}>
      {resultado.ok ? resultado.valor.mensaje : resultado.mensaje}
    </p>}
  </section>;
}
