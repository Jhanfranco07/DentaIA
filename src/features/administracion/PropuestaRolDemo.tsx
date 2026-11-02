"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ACTOR_ADMINISTRATIVO_DEMO, type ProveedorAdministrativo, type PropuestaValidada, type ResultadoAdministrativo } from "./servicios";
import styles from "./administracion.module.css";

type Props = { proveedor: ProveedorAdministrativo; objetivo: string; onObjetivo: (id: string) => void };
export default function PropuestaRolDemo({ proveedor, objetivo, onObjetivo }: Props) {
  const [rol, setRol] = useState("paciente");
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAdministrativo<PropuestaValidada> | null>(null);
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
      const respuesta = await proveedor.validarPropuesta({ operacion: "validar_cambio_rol", usuarioId: objetivo, rol }, ACTOR_ADMINISTRATIVO_DEMO);
      if (actual === version.current) setResultado(respuesta);
    } catch {
      if (actual === version.current) setResultado({ ok: false, status: 503, codigo: "ERROR_LOCAL", mensaje: "No se pudo validar la propuesta local. No se aplicaron cambios." });
    } finally { if (actual === version.current) setValidando(false); }
  }
  return <section className={styles.propuesta} aria-labelledby="demo-propuesta-rol">
    <h3 id="demo-propuesta-rol" tabIndex={-1}>Revisar una propuesta de rol</h3>
    <p>Validación local con cuentas sintéticas; no acredita autorización del servidor. No guarda cambios ni asigna privilegios.</p>
    <p>Operador ficticio: Cuenta de prueba 01. Sus propios privilegios no se pueden modificar.</p>
    <form onSubmit={validar} className={styles.formularioAdmin}>
      <label htmlFor="demo-objetivo">UUID de la cuenta sintética</label>
      <input id="demo-objetivo" value={objetivo} onChange={event => onObjetivo(event.target.value)} maxLength={36} required autoComplete="off" />
      <label htmlFor="demo-rol-propuesto">Rol propuesto</label>
      <select id="demo-rol-propuesto" value={rol} onChange={event => setRol(event.target.value)}>
        <option value="paciente">Paciente</option><option value="odontologo">Odontólogo</option>
        <option value="superusuario">Superusuario · requiere aprobación independiente</option>
      </select>
      <button className={styles.accionEstado} type="submit" disabled={validando}>{validando ? "Validando propuesta…" : "Validar propuesta local"}</button>
    </form>
    {validando && <p role="status">Validando con el proveedor simulado…</p>}
    {resultado && <p role={resultado.ok ? "status" : "alert"} className={resultado.ok ? styles.mensajePropuesta : styles.errorAdmin}>
      {resultado.ok ? resultado.valor.mensaje : resultado.mensaje}
    </p>}
  </section>;
}
