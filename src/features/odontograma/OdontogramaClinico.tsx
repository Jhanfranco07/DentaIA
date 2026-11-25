"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MutableRefObject } from "react";
import { Arcadas } from "./Arcadas";
import { ErrorOdontograma, guardarOdontograma, leerOdontograma, verFotografia } from "./cliente";
import { ARCADA_INFERIOR, ARCADA_SUPERIOR, CATALOGO, FASES, SUPERFICIES, esEstado, superficiesDe, type Estado, type ExpedienteOdontograma, type Fase, type Fdi, type GuardarOdontograma, type Observacion, type Registro, type Superficie } from "./modelo";
import styles from "./odontograma.module.css";

const fecha = (value: string) => new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" }).format(new Date(value));
const permitirDescartar = () => window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos?");
const reviewKey = (analysisId: string, key: string) => `${analysisId}/${key}`;
const mensajeError = (error: unknown) => error instanceof ErrorOdontograma
  ? ({ 401: "La sesión ya no está disponible.", 403: "El acceso clínico ya no está autorizado.", 404: "El recurso no está disponible en este entorno.", 409: "El registro cambió. Revisa el historial actualizado antes de guardar otra corrección." }[error.status] ?? "No se pudo completar la operación. Puedes reintentar.")
  : "No se pudo completar la operación. Puedes reintentar.";

export default function OdontogramaClinico({ patientId, membershipId, guard }: {
  patientId: string; membershipId: string; guard: MutableRefObject<(() => boolean) | null>;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ExpedienteOdontograma | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tooth, setTooth] = useState<Fdi>(11);
  const [encounter, setEncounter] = useState("");
  const [condition, setCondition] = useState<Estado>("caries");
  const [phase, setPhase] = useState<Fase>("hallazgo");
  const [surface, setSurface] = useState<Superficie | null>(null);
  const [note, setNote] = useState("");
  const [replace, setReplace] = useState<Registro | null>(null);
  const [reason, setReason] = useState("");
  const [observation, setObservation] = useState<Observacion | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<{ url: string; label: string } | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const pending = useRef<GuardarOdontograma | null>(null);
  const operation = useRef<AbortController | null>(null);
  const read = useRef<AbortController | null>(null);
  const photoRequest = useRef<AbortController | null>(null);
  const edit = useRef<HTMLFormElement | null>(null);
  const editable = data?.encounters.filter(item => item.editable) ?? [];

  const clearPhoto = useCallback(() => {
    photoRequest.current?.abort();
    setPhotoLoading(false);
    setPhotos(null);
  }, []);

  useEffect(() => () => {
    operation.current?.abort();
    read.current?.abort();
    photoRequest.current?.abort();
  }, []);
  useEffect(() => () => { if (photos) URL.revokeObjectURL(photos.url); }, [photos]);

  useEffect(() => {
    guard.current = () => !saving && (!dirty || permitirDescartar());
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    if (dirty || saving) window.addEventListener("beforeunload", prevent);
    return () => {
      guard.current = null;
      window.removeEventListener("beforeunload", prevent);
    };
  }, [dirty, saving, guard]);

  const reset = useCallback(() => {
    setDirty(false);
    setNote("");
    setSurface(null);
    setCondition("caries");
    setPhase("hallazgo");
    setReplace(null);
    setReason("");
    setObservation(null);
    pending.current = null;
  }, []);

  const load = useCallback(async (hide = false) => {
    read.current?.abort();
    const controller = new AbortController();
    read.current = controller;
    if (hide) {
      setData(null);
      clearPhoto();
    }
    setLoading(true);
    setError("");
    try {
      const result = await leerOdontograma(patientId, membershipId, controller.signal);
      if (controller.signal.aborted) return;
      setData(result);
      setEncounter(previous => result.encounters.some(item => item.editable && item.id === previous)
        ? previous : result.encounters.find(item => item.editable)?.id ?? "");
    } catch (err) {
      if (controller.signal.aborted) return;
      setData(null);
      clearPhoto();
      if (err instanceof ErrorOdontograma && [401, 403].includes(err.status)) reset();
      setError(mensajeError(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [patientId, membershipId, clearPhoto, reset]);

  useEffect(() => {
    if (!open) return;
    void load();
    const revalidate = () => {
      if (!document.hidden && !operation.current) void load(true);
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    const timer = setInterval(revalidate, 60_000);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
      clearInterval(timer);
      read.current?.abort();
    };
  }, [open, load]);

  function change() {
    pending.current = null;
    setDirty(true);
  }

  function choose(t: Fdi) {
    if (tooth === t || saving || (dirty && !permitirDescartar())) return;
    reset();
    setTooth(t);
  }

  function correct(item: Registro) {
    if (dirty && !permitirDescartar()) return;
    reset();
    setTooth(item.tooth);
    setEncounter(item.encounterId);
    setReplace(item);
    setCondition(item.condition);
    setPhase(item.phase);
    setSurface(item.surface);
    setNote(item.note);
    setDirty(true);
    edit.current?.focus();
  }

  async function save(decision?: "accepted" | "corrected" | "dismissed", source?: Observacion) {
    if (operation.current || !encounter || !data || (decision && !source)) return;
    if (!window.confirm(decision === "dismissed" ? "¿Descartar esta observación automatizada?" : "¿Confirmas el registro profesional en el expediente seleccionado?")) return;
    const payload: GuardarOdontograma = {
      id: crypto.randomUUID(), membershipId, encounterId: encounter,
      record: decision === "dismissed" ? null : { tooth, surface, condition, phase, note, replacesId: replace?.id ?? null, correctionReason: replace ? reason : null },
      review: decision && source ? { analysisId: source.analysisId, key: source.key, decision } : null,
    };
    if (pending.current && JSON.stringify({ ...pending.current, id: "" }) === JSON.stringify({ ...payload, id: "" })) {
      payload.id = pending.current.id;
    }
    pending.current = payload;
    const controller = new AbortController();
    operation.current = controller;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await guardarOdontograma(patientId, payload, controller.signal);
      if (controller.signal.aborted) return;
      if (decision !== "dismissed") reset();
      else pending.current = null;
      setMessage(decision === "dismissed" ? "Observación descartada." : "Registro guardado.");
      await load();
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof ErrorOdontograma && [401, 403, 409].includes(err.status)) {
        if (err.status === 409) await load(true);
        else { setData(null); reset(); clearPhoto(); }
      }
      if (err instanceof ErrorOdontograma && [401, 403].includes(err.status)) reset();
      setError(mensajeError(err));
    } finally {
      if (operation.current === controller) operation.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const decision = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter).get("decision");
    void save(observation ? decision === "corrected" ? "corrected" : "accepted" : undefined, observation ?? undefined);
  }

  async function showPhoto(source: Observacion) {
    clearPhoto();
    const controller = new AbortController();
    photoRequest.current = controller;
    setPhotoLoading(true);
    setError("");
    try {
      const blob = await verFotografia(patientId, membershipId, source.analysisId, controller.signal);
      if (!controller.signal.aborted) setPhotos({ url: URL.createObjectURL(blob), label: `Fotografía del análisis del ${fecha(source.date)}` });
    } catch (err) {
      if (!controller.signal.aborted) setError(mensajeError(err));
    } finally {
      if (!controller.signal.aborted) setPhotoLoading(false);
    }
  }

  const records = data?.records.filter(record => record.tooth === tooth) ?? [];
  const reviews = new Map(data?.reviews.map(item => [reviewKey(item.analysisId, item.key), item]));
  return <section className={styles.chart} aria-labelledby="titulo-odontograma">
    <header className={styles.header}>
      <h3 id="titulo-odontograma">Odontograma clínico</h3>
      <button type="button" aria-expanded={open} onClick={() => {
        if (open && (saving || (dirty && !permitirDescartar()))) return;
        if (open) { reset(); setData(null); clearPhoto(); }
        setOpen(!open);
      }}>{open ? "Cerrar odontograma" : "Abrir odontograma"}</button>
    </header>
    {open && <>
      {loading && <p role="status">Verificando acceso y cargando expediente…</p>}
      {message && <p role="status">{message}</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => void load(true)} disabled={saving}>Actualizar expediente</button></div>}
      {data && <>
        <p className={styles.patient}>Paciente <strong>{data.patientName ?? data.patientId}</strong></p>
        <Arcadas selected={tooth} records={data.records} select={choose} />
        <div className={styles.columns}>
          <section aria-label="Detalle de pieza">
            <h4>Pieza {tooth}</h4>
            {!records.some(record => record.active) && <p>Sin registro</p>}
            {records.length > 0 && <ol className={styles.timeline}>{records.map(record => (
              <li key={record.id}>
                <strong>{CATALOGO[record.condition].etiqueta}</strong>
                <p>{FASES[record.phase]} · {record.surface ? SUPERFICIES[record.surface] : "Pieza completa"} · {fecha(record.recordedAt)}</p>
                <p>{record.author || "Profesional del encuentro"}{record.active ? "" : " · Versión histórica"}</p>
                {record.note && <p>{record.note}</p>}
                {record.correctionReason && <p>Motivo de corrección · {record.correctionReason}</p>}
                {record.active && editable.some(item => item.id === record.encounterId) &&
                  <button type="button" disabled={saving} onClick={() => correct(record)}>Corregir</button>}
              </li>
            ))}</ol>}
          </section>
          <form ref={edit} tabIndex={-1} onSubmit={submit} className={styles.editor}>
            <h4>{replace ? "Corregir registro" : "Registro profesional"}</h4>
            {editable.length === 0 ? <p>Selecciona un expediente con un encuentro propio y autorizado para registrar información.</p> : <>
              {observation && <p>Asociación manual de {observation.label}. Confirma pieza y superficie con evidencia clínica.</p>}
              <fieldset disabled={saving || loading}>
                <label>Encuentro
                  <select value={encounter} disabled={!!replace} onChange={e => { change(); setEncounter(e.target.value); }}>
                    {editable.map(item => <option key={item.id} value={item.id}>{fecha(item.date)} · {item.id.slice(0, 8)}</option>)}
                  </select>
                </label>
                {replace && <label>Pieza corregida
                  <select value={tooth} onChange={e => {
                    change(); setTooth(Number(e.target.value) as Fdi); setSurface(null);
                  }}>{[...ARCADA_SUPERIOR, ...ARCADA_INFERIOR].map(fdi => <option key={fdi} value={fdi}>{fdi}</option>)}</select>
                </label>}
                <label>Estado
                  <select value={condition} onChange={e => {
                    const value = e.target.value;
                    if (!esEstado(value)) return;
                    change(); setCondition(value); setPhase(CATALOGO[value].fase === "hallazgo" ? "hallazgo" : "planificado");
                    if (!CATALOGO[value].superficie) setSurface(null);
                  }}>{Object.entries(CATALOGO).map(([key, item]) => <option key={key} value={key}>{item.etiqueta}</option>)}</select>
                </label>
                {CATALOGO[condition].fase === "tratamiento" && <label>Situación
                  <select value={phase} onChange={e => { change(); setPhase(e.target.value as Fase); }}>
                    <option value="planificado">Planificado</option><option value="realizado">Realizado</option>
                  </select>
                </label>}
                <label>Superficie
                  <select value={surface ?? ""} disabled={!CATALOGO[condition].superficie} onChange={e => {
                    change(); setSurface((e.target.value || null) as Superficie | null);
                  }}><option value="">Pieza completa</option>
                    {superficiesDe(tooth).map(item => <option key={item} value={item}>{SUPERFICIES[item]}</option>)}
                  </select>
                </label>
                <label htmlFor="odontograma-nota">Nota clínica<textarea id="odontograma-nota" value={note} required={condition === "nota" || !!observation} maxLength={1000} rows={3} onChange={e => { change(); setNote(e.target.value); }} /></label>
                {replace && <label>Motivo de corrección<textarea required value={reason} maxLength={300} rows={2} onChange={e => { change(); setReason(e.target.value); }} /></label>}
                <div className={styles.actions}>
                  <button type="submit" name="decision" value="accepted" disabled={saving || !encounter}>{saving ? "Guardando…" : observation ? "Confirmar vínculo y guardar" : "Confirmar y guardar"}</button>
                  {observation && <button type="submit" name="decision" value="corrected">Guardar con corrección profesional</button>}
                  {dirty && <button type="button" onClick={() => { if (permitirDescartar()) reset(); }}>Descartar borrador</button>}
                </div>
              </fieldset>
            </>}
          </form>
        </div>
        <section className={styles.observations} aria-label="Asistencia de visión">
          <h4>Observaciones automatizadas · Smile V17</h4>
          <p>Estas observaciones requieren revisión profesional antes de vincularlas a una pieza.</p>
          {data.observations.length === 0 && <p>No hay observaciones compartidas disponibles para revisión.</p>}
          {photoLoading && <p role="status">Cargando fotografía autorizada…</p>}
          {photos && <figure className={styles.photo}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Imagen privada en memoria, sin optimizador ni caché. */}
            <img src={photos.url} alt={photos.label} />
            <button type="button" onClick={clearPhoto}>Cerrar fotografía</button>
          </figure>}
          <ul className={styles.timeline}>{data.observations.map(item => {
            const key = reviewKey(item.analysisId, item.key);
            const review = reviews.get(key);
            return <li key={key}>
              <strong>{item.label}</strong><p>{item.model} · {fecha(item.date)}</p>
              <p>{review ? { accepted: "Asociada y confirmada", corrected: "Corregida por el profesional", dismissed: "Descartada" }[review.decision] : "Revisión pendiente"}</p>
              {item.limitations.length > 0 && <details><summary>Limitaciones</summary><ul>{item.limitations.map((value, index) => <li key={index}>{value}</li>)}</ul></details>}
              <div className={styles.actions}>
                {data.availablePhotos.includes(item.analysisId) && <button type="button" onClick={() => void showPhoto(item)}>Ver fotografía</button>}
                {!review && editable.length > 0 && <>
                  <button type="button" disabled={saving} onClick={() => {
                    if (dirty && !permitirDescartar()) return;
                    reset(); setObservation(item); setCondition("nota"); setDirty(true); edit.current?.focus();
                  }}>Asociar manualmente a pieza {tooth}</button>
                  <button type="button" disabled={saving} onClick={() => void save("dismissed", item)}>Descartar observación</button>
                </>}
              </div>
            </li>;
          })}</ul>
        </section>
      </>}
    </>}
  </section>;
}
