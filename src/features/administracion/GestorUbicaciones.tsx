"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { validarResultadoUbicacion } from "./ubicaciones";
import styles from "./administracion.module.css";

type SedePublicada = {
  id: string;
  dentist_id: string;
  dentist_name: string;
  clinic_id: string;
  clinic_name: string;
  practice_name: string;
  practice_address: string;
  latitude: number;
  longitude: number;
  publication_status: string;
  created_at: string;
};
type ProfesionalElegible = { professionalId: string; dentistId: string; dentistName: string; specialty: string; clinicId: string | null; clinicName: string | null; membershipId: string | null; membershipStatus: string | null };
type EstadoCarga = "cargando" | "disponible" | "error";
type Operacion = "guardar" | "publicar" | "ocultar" | "retirar";

/** UI delgada: las decisiones de rol, AAL2, membresía, verificación y auditoría
 * permanecen en el guard del servidor y en la función SQL. */
export default function GestorUbicaciones() {
  const [estado, setEstado] = useState<EstadoCarga>("cargando");
  const [sedes, setSedes] = useState<SedePublicada[]>([]);
  const [profesionales, setProfesionales] = useState<ProfesionalElegible[]>([]);
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
      const { data: sesion } = await getSupabaseBrowserClient().auth.getSession();
      if (!sesion.session?.access_token) throw new Error("SESION_INVALIDA");
      const vinculaciones = await fetch("/api/administracion/vinculaciones", { headers: { Authorization: `Bearer ${sesion.session.access_token}` }, cache: "no-store", credentials: "same-origin" });
      const lista: unknown = await vinculaciones.json();
      if (!vinculaciones.ok || !lista || typeof lista !== "object" || !("ok" in lista) || lista.ok !== true
        || !("profesionales" in lista) || !Array.isArray(lista.profesionales) || !("ubicaciones" in lista) || !Array.isArray(lista.ubicaciones)) throw new Error("LECTURA_NO_DISPONIBLE");
      const elegibles = lista.profesionales as ProfesionalElegible[];
      setProfesionales(elegibles);
      setSedes((lista.ubicaciones as Array<Record<string, unknown>>).map(item => ({ id: String(item.id), dentist_id: String(item.dentistId), dentist_name: String(item.dentistName), clinic_id: String(item.clinicId), clinic_name: String(item.clinicName), practice_name: String(item.practiceName), practice_address: String(item.practiceAddress), latitude: Number(item.latitude), longitude: Number(item.longitude), publication_status: String(item.status), created_at: String(item.createdAt) })));
      if (elegibles[0]) setDentistId(current => current || elegibles[0].dentistId);
      if (elegibles[0]?.clinicId) setClinicId(current => current || elegibles[0].clinicId!);
      setEstado("disponible");
    } catch {
      setEstado("error");
      setError("No se pudo consultar la gestión administrativa de sedes. Se requiere sesión superusuario con MFA/AAL2.");
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

    {estado === "cargando" && <p role="status">Consultando ubicaciones, profesionales y clínicas protegidas…</p>}
    {estado === "error" && <div role="alert" className={styles.errorAdmin}><p>{error}</p><button type="button" className={styles.accionEstado} onClick={() => void cargar()}>Reintentar</button></div>}
    {estado === "disponible" && <>
      <div className={styles.avisoDemo}><strong>Gestión administrativa de ubicaciones.</strong><p>La lista protegida permite revisar sedes pendientes, publicadas, ocultas o retiradas. El directorio público sigue limitado a sedes publicadas por RLS.</p></div>
      <form className={styles.formularioAdmin} onSubmit={guardar} aria-label="Registrar o editar sede odontológica">
        <h3>Registrar o actualizar sede</h3>
        <p>Actualizar la misma pareja odontólogo-clínica vuelve a dejar la sede pendiente de verificación antes de publicarla.</p>
        <label>Odontólogo verificado<select required value={dentistId} onChange={e => setDentistId(e.target.value)} disabled={profesionales.length === 0}><option value="">Selecciona un profesional</option>{Array.from(new Map(profesionales.map(p => [p.dentistId, p])).values()).map(p => <option key={p.dentistId} value={p.dentistId}>{p.dentistName} · {p.specialty}</option>)}</select></label>
        <label>Clínica con membresía vigente<select required value={clinicId} onChange={e => setClinicId(e.target.value)} disabled={!dentistId}><option value="">Selecciona una clínica vinculada</option>{profesionales.filter(p => p.dentistId === dentistId && p.clinicId && p.membershipStatus === "active").map(p => <option key={p.clinicId} value={p.clinicId!}>{p.clinicName}</option>)}</select></label>
        <label>Nombre de la sede<input required value={nombreSede} onChange={e => setNombreSede(e.target.value)} maxLength={160} /></label>
        <label>Dirección verificada<input required value={direccion} onChange={e => setDireccion(e.target.value)} maxLength={300} autoComplete="street-address" /></label>
        <div className={styles.filtrosAdmin}>
          <label>Latitud<input required type="number" step="any" min={-90} max={90} value={latitud} onChange={e => setLatitud(e.target.value)} /></label>
          <label>Longitud<input required type="number" step="any" min={-180} max={180} value={longitud} onChange={e => setLongitud(e.target.value)} /></label>
        </div>
        <p>El servidor vuelve a comprobar perfil no demo, verificación profesional, clínica activa y membresía vigente. La coordenada debe corresponder a la dirección revisada.</p>
        {profesionales.length === 0 && <p role="status">No hay profesionales reales elegibles; completa primero una vinculación verificada. Los perfiles académicos no pueden publicar ubicaciones.</p>}
        <button type="submit" className={styles.accionEstado} disabled={ocupado || !dentistId || !clinicId}>{ocupado ? "Guardando…" : "Guardar sede pendiente"}</button>
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
        <h3 id="sedes-publicadas-titulo">Sedes registradas</h3>
        {sedes.length === 0 ? <p role="status">Todavía no hay ubicaciones registradas para profesionales no ficticios.</p> : <div className={styles.tablaUsuarios}><table><thead><tr><th>Sede y dirección</th><th>Odontólogo y clínica</th><th>Estado</th><th>Coordenadas</th><th>Acciones</th></tr></thead><tbody>{sedes.map(sede => <tr key={sede.id}><td><strong>{sede.practice_name}</strong><small>{sede.practice_address}</small></td><td>{sede.dentist_name}<small>{sede.clinic_name}</small></td><td>{sede.publication_status}</td><td>{sede.latitude}, {sede.longitude}</td><td><button type="button" className={styles.accionEstado} onClick={() => { setUbicacionId(sede.id); setDentistId(sede.dentist_id); setClinicId(sede.clinic_id); setNombreSede(sede.practice_name); setDireccion(sede.practice_address); setLatitud(String(sede.latitude)); setLongitud(String(sede.longitude)); }}>Editar con nueva verificación</button></td></tr>)}</tbody></table></div>}
      </section>
    </>}

    {error && estado !== "error" && <p className={styles.errorAdmin} role="alert">{error}</p>}
    {mensaje && <p className={styles.propuesta + " " + styles.mensajePropuesta} role="status">{mensaje}</p>}
  </section>;
}
