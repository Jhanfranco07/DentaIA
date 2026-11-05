"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { tablaUbicacionesAusente, validarResultadoUbicacion } from "./ubicaciones";
import styles from "./administracion.module.css";

type SedePublicada = {
  id: string;
  dentist_id: string;
  practice_name: string;
  practice_address: string;
  latitude: number;
  longitude: number;
  created_at: string;
};
type EstadoCarga = "cargando" | "disponible" | "esquema_no_disponible" | "error";
type Operacion = "guardar" | "publicar" | "ocultar" | "retirar";

/** UI delgada: las decisiones de rol, AAL2, membresía, verificación y auditoría
 * permanecen en el guard del servidor y en la función SQL. */
export default function GestorUbicaciones() {
  const [estado, setEstado] = useState<EstadoCarga>("cargando");
  const [sedes, setSedes] = useState<SedePublicada[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [dentistId, setDentistId] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [nombreSede, setNombreSede] = useState("");
  const [direccion, setDireccion] = useState("");
  const [latitud, setLatitud] = useState("");
  const [longitud, setLongitud] = useState("");
  const [ubicacionId, setUbicacionId] = useState("");
  const [evidencia, setEvidencia] = useState("");

  const cargar = useCallback(async () => {
    setEstado("cargando");
    setError("");
    try {
      // RLS solo devuelve sedes publicadas y vigentes. El sondeo también detecta
      // la migración ausente sin intentar ninguna escritura.
      const respuesta = await getSupabaseBrowserClient().from("dentist_public_locations")
        .select("id,dentist_id,practice_name,practice_address,latitude,longitude,created_at")
        .order("created_at", { ascending: false }).limit(100);
      if (respuesta.error) {
        if (tablaUbicacionesAusente(respuesta.error)) {
          setSedes([]);
          setEstado("esquema_no_disponible");
        } else {
          setEstado("error");
          setError("No se pudo comprobar el servicio de ubicaciones. No se muestran datos parciales.");
        }
        return;
      }
      setSedes(respuesta.data ?? []);
      setEstado("disponible");
    } catch {
      setEstado("error");
      setError("No se pudo conectar con el servicio de ubicaciones.");
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function ejecutar(operacion: Operacion, datosOperacion: Record<string, unknown>) {
    if (ocupado || estado !== "disponible") return;
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      const { data, error: errorSesion } = await getSupabaseBrowserClient().auth.getSession();
      if (errorSesion || !data.session?.access_token) throw new Error("SESION_INVALIDA");
      const payload = { operacion, ...datosOperacion };
      const respuesta = await fetch("/api/administracion/ubicaciones", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });
      const cuerpoRespuesta: unknown = await respuesta.json();
      if (respuesta.status === 503) {
        const codigo = cuerpoRespuesta && typeof cuerpoRespuesta === "object" && "codigo" in cuerpoRespuesta ? String(cuerpoRespuesta.codigo) : "";
        if (codigo === "ESCRITURAS_DESACTIVADAS") {
          setError("Las escrituras de ubicaciones están desactivadas para este entorno; no se modificó ninguna ubicación.");
        } else {
          setError("La API administrativa no está habilitada en este entorno; no se modificó ninguna ubicación.");
        }
        return;
      }
      const resultado = validarResultadoUbicacion(cuerpoRespuesta);
      if (!respuesta.ok || !resultado.ok) {
        const codigo = resultado.ok ? "ERROR_API" : resultado.codigo;
        if (respuesta.status === 403) {
          setError("La operación fue denegada. Comprueba rol superusuario, MFA/AAL2 y la vinculación profesional-clínica vigente.");
        } else {
          setError(`La operación no se confirmó (${codigo}); no se mostrará como completada.`);
        }
        return;
      }
      setUbicacionId(resultado.ubicacionId);
      setMensaje(operacion === "guardar"
        ? "Sede guardada como pendiente. Para hacerla visible, verifica los datos y completa la publicación con su referencia de evidencia."
        : operacion === "publicar" ? "La API confirmó la publicación de la sede." : operacion === "ocultar"
          ? "La API confirmó que la sede quedó oculta." : "La API confirmó que la sede quedó retirada.");
      if (operacion === "guardar") {
        setNombreSede(""); setDireccion(""); setLatitud(""); setLongitud("");
      }
      if (operacion === "publicar") setEvidencia("");
      await cargar();
    } catch (fallo) {
      setError(fallo instanceof Error && fallo.message === "SESION_INVALIDA"
        ? "La sesión no está disponible. Inicia sesión de nuevo y vuelve a intentarlo."
        : "No se pudo confirmar la operación. Comprueba el estado antes de volver a enviarla.");
    } finally {
      setOcupado(false);
    }
  }

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const lat = Number(latitud), lon = Number(longitud);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      setError("Introduce latitud entre −90 y 90 y longitud entre −180 y 180.");
      return;
    }
    void ejecutar("guardar", { dentistId: dentistId.trim(), clinicId: clinicId.trim(), practiceName: nombreSede.trim(), practiceAddress: direccion.trim(), latitude: lat, longitude: lon });
  }

  return <section className={styles.bloque} aria-labelledby="gestor-ubicaciones-titulo">
    <div className={styles.tituloBloque}><h2 id="gestor-ubicaciones-titulo">Gestión de consultorios</h2><span className={styles.indicador}>API administrativa protegida</span></div>
    <p>Una sede por combinación profesional-clínica; un mismo profesional puede registrar varias clínicas. Las coordenadas deben corresponder a una dirección comprobada. No se asignan puntos aproximados ni se publican ubicaciones ficticias.</p>

    {estado === "cargando" && <p role="status">Comprobando tablas y permisos de lectura…</p>}
    {estado === "esquema_no_disponible" && <div className={styles.avisoDemo} role="status"><strong>Servicio de ubicaciones no disponible</strong><p>PostgREST no encuentra la tabla esperada. La migración puede estar pendiente o el esquema aún no estar actualizado. El formulario queda bloqueado y no se enviaron cambios a Supabase. Verifica la instalación antes de volver a intentar.</p></div>}
    {estado === "error" && <div role="alert" className={styles.errorAdmin}><p>{error}</p><button type="button" className={styles.accionEstado} onClick={() => void cargar()}>Reintentar</button></div>}
    {estado === "disponible" && <>
      <div className={styles.avisoDemo}><strong>La base permite leer ubicaciones públicas.</strong><p>La lista contiene únicamente sedes publicadas por RLS. Las operaciones de escritura siempre vuelven a comprobar autorización, identidad profesional, clínica y membresía en el servidor.</p></div>
      <form className={styles.formularioAdmin} onSubmit={guardar} aria-label="Registrar o editar sede odontológica">
        <h3>Registrar o actualizar sede</h3>
        <p>Actualizar la misma pareja odontólogo-clínica vuelve a dejar la sede pendiente de verificación antes de publicarla.</p>
        <label>UUID del perfil odontológico<input required value={dentistId} onChange={e => setDentistId(e.target.value)} autoComplete="off" spellCheck={false} maxLength={36} /></label>
        <label>UUID de la clínica<input required value={clinicId} onChange={e => setClinicId(e.target.value)} autoComplete="off" spellCheck={false} maxLength={36} /></label>
        <label>Nombre de la sede<input required value={nombreSede} onChange={e => setNombreSede(e.target.value)} maxLength={160} /></label>
        <label>Dirección verificada<input required value={direccion} onChange={e => setDireccion(e.target.value)} maxLength={300} autoComplete="street-address" /></label>
        <div className={styles.filtrosAdmin}>
          <label>Latitud<input required type="number" step="any" min={-90} max={90} value={latitud} onChange={e => setLatitud(e.target.value)} /></label>
          <label>Longitud<input required type="number" step="any" min={-180} max={180} value={longitud} onChange={e => setLongitud(e.target.value)} /></label>
        </div>
        <p>El servidor rechaza perfiles de demostración, profesionales no verificados o membresías inactivas. El formulario no puede crear ni vincular esas relaciones.</p>
        <button type="submit" className={styles.accionEstado} disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar sede pendiente"}</button>
      </form>

      {ubicacionId && <section className={styles.propuesta} aria-labelledby="publicar-sede-titulo">
        <h3 id="publicar-sede-titulo">Verificación y publicación</h3>
        <p>La sede pendiente recibida de la API: <code>{ubicacionId}</code>. Introduce una referencia verificable de la evidencia revisada; no incluyas datos clínicos.</p>
        <form className={styles.formularioAdmin} onSubmit={event => { event.preventDefault(); void ejecutar("publicar", { ubicacionId, verificationReference: evidencia.trim() }); }}>
          <label>Referencia de evidencia<input required minLength={8} maxLength={500} value={evidencia} onChange={e => setEvidencia(e.target.value)} /></label>
          <button type="submit" className={styles.accionEstado} disabled={ocupado || evidencia.trim().length < 8}>{ocupado ? "Publicando…" : "Confirmar y publicar"}</button>
        </form>
      </section>}

      <section className={styles.propuesta} aria-labelledby="sede-acciones-titulo">
        <h3 id="sede-acciones-titulo">Ocultar o retirar una sede</h3>
        <p>Ingresa el UUID de la ubicación que devuelve el servicio. Ocultar permite una revisión posterior; retirar la excluye del directorio. Ambas operaciones quedan auditadas.</p>
        <label className={styles.formularioAdmin}>UUID de ubicación<input value={ubicacionId} onChange={e => setUbicacionId(e.target.value)} autoComplete="off" spellCheck={false} maxLength={36} /></label>
        <div className="actions"><button type="button" className={styles.accionEstado} disabled={ocupado || !ubicacionId} onClick={() => void ejecutar("ocultar", { ubicacionId: ubicacionId.trim() })}>Ocultar ubicación</button><button type="button" className={styles.accionEstado} disabled={ocupado || !ubicacionId} onClick={() => { if (window.confirm("¿Retirar esta sede del directorio? La operación quedará auditada.")) void ejecutar("retirar", { ubicacionId: ubicacionId.trim() }); }}>Retirar ubicación</button></div>
      </section>

      <section className={styles.propuesta} aria-labelledby="sedes-publicadas-titulo">
        <h3 id="sedes-publicadas-titulo">Sedes publicadas visibles</h3>
        {sedes.length === 0 ? <p role="status">No hay sedes publicadas que RLS permita mostrar todavía.</p> : <div className={styles.tablaUsuarios}><table><thead><tr><th>Sede y dirección</th><th>Odontólogo</th><th>Coordenadas</th><th>UUID</th></tr></thead><tbody>{sedes.map(sede => <tr key={sede.id}><td><strong>{sede.practice_name}</strong><small>{sede.practice_address}</small></td><td><code>{sede.dentist_id}</code></td><td>{sede.latitude}, {sede.longitude}</td><td><code>{sede.id}</code></td></tr>)}</tbody></table></div>}
      </section>
    </>}

    {error && estado !== "error" && <p className={styles.errorAdmin} role="alert">{error}</p>}
    {mensaje && <p className={styles.propuesta + " " + styles.mensajePropuesta} role="status">{mensaje}</p>}
  </section>;
}
