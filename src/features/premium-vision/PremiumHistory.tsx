
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  compareHistory, HISTORY_CONSENT_VERSION, statusLabels,
  type HistoryEvaluation, type HistoryPage, type HistoryPurpose,
} from "./history";
import styles from "./premium-history.module.css";

type Context = { patientId: string; membershipId: string };
type Grant = { id: string; expiresAt: string; estado: string };
type View = { kind: "loading" | "denied" | "error" } | { kind: "ready"; page: HistoryPage };
const dates = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });
class PrivateRequestError extends Error {
  constructor(readonly status: number) { super("PRIVATE_REQUEST_FAILED"); }
}

async function privateRequest(url: string, init?: RequestInit) {
  const session = await getSupabaseBrowserClient().auth.getSession();
  if (session.error || !session.data.session) throw new PrivateRequestError(401);
  const response = await fetch(url, {
    ...init, cache: "no-store", credentials: "same-origin",
    headers: { Authorization: "Bearer " + session.data.session.access_token, ...init?.headers },
  });
  if (!response.ok) throw new PrivateRequestError(response.status);
  return response;
}
const denied = (error: unknown) => error instanceof PrivateRequestError && [401,403].includes(error.status);

function readHistory(root: string, membership: string, patient: string, params: Record<string,string>, signal: AbortSignal) {
  return privateRequest(root, {
    method: "POST", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, ...(membership ? { membershipId: membership, patientId: patient } : {}) }),
  });
}

export default function PremiumHistory({ professional }: { professional?: Context }) {
  const [open, setOpen] = useState(!professional);
  const root = professional ? "/api/professional/premium-history" : "/api/patient/premium-history/read";
  const membership = professional?.membershipId ?? "";
  return <section className={styles.surface} aria-labelledby="premium-history-title">
    <h2 id="premium-history-title">Historial de evaluaciones Premium</h2>
    {professional && <button className={styles.button} type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {open ? "Ocultar evaluaciones" : "Consultar evaluaciones compartidas"}
    </button>}
    {open && <HistoryContent key={root + (professional?.patientId ?? "") + membership} root={root} membership={membership} patient={professional?.patientId ?? ""} />}
  </section>;
}

function HistoryContent({ root, membership, patient }: { root: string; membership: string; patient: string }) {
  const professional = membership !== "";
  const [view, setView] = useState<View>({ kind: "loading" });
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const interaction = useRef<AbortController | null>(null);
  const read = (params: Record<string,string>, signal: AbortSignal) => readHistory(root, membership, patient, params, signal);

  useEffect(() => {
    const abort = new AbortController();
    readHistory(root, membership, patient, {}, abort.signal)
      .then(async response => {
        const page: HistoryPage = await response.json();
        if (!abort.signal.aborted) setView({ kind: "ready", page });
      })
      .catch(error => {
        if (!abort.signal.aborted) setView({ kind: denied(error) ? "denied" : "error" });
      });
    return () => {
      abort.abort();
      interaction.current?.abort();
    };
  }, [root, membership, patient, revision]);

  useEffect(() => {
    let previous: string | undefined;
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = getSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
        const next = session?.user.id;
        if (previous && next !== previous) {
          interaction.current?.abort();
          setView({ kind: "loading" });
          setSelection([]);
          setBusy(false);
          setFeedback("");
          setRevision(value => value + 1);
        }
        previous = next;
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch { /* The request above renders unavailable configuration. */ }
    return () => unsubscribe?.();
  }, []);

  function refresh() {
    setView({ kind: "loading" });
    setSelection([]);
    setRevision(value => value + 1);
  }

  async function perform(operation: (signal: AbortSignal) => Promise<void>) {
    if (interaction.current) return;
    const abort = new AbortController();
    interaction.current = abort;
    setBusy(true);
    setFeedback("");
    try {
      await operation(abort.signal);
    } catch (error) {
      if (abort.signal.aborted) return;
      if (denied(error)) refresh();
      setFeedback(denied(error) ? "El acceso a esta operación ya no está vigente." : "No pudimos completar la operación. Inténtalo nuevamente.");
    } finally {
      if (interaction.current === abort) interaction.current = null;
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  const command = (body: Record<string,unknown>) => void perform(async signal => {
    await privateRequest("/api/patient/premium-history", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (signal.aborted) return;
    setFeedback("Cambios guardados.");
    refresh();
  });
  const photo = (id: string) => void perform(async signal => {
    const response = await read({ photo: id }, signal);
    const blob = await response.blob();
    if (signal.aborted) return;
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "fotografia." + (blob.type === "image/jpeg" ? "jpg" : blob.type.split("/")[1]);
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl),1000);
  });

  if (view.kind !== "ready") return <>
    <p role="status">{view.kind === "loading" ? "Cargando evaluaciones…" : view.kind === "denied"
      ? "Esta sesión no tiene acceso al historial." : "El historial no está disponible en este momento."}</p>
    {view.kind !== "loading" && <button type="button" className={styles.button} onClick={refresh}>Volver a consultar</button>}
  </>;

  const { page } = view;
  const selected = selection.map(id => page.items.find(item => item.id === id)).filter((item): item is HistoryEvaluation => Boolean(item));
  const comparison = selected.length === 2 ? compareHistory(selected[0],selected[1]) : null;
  return <>
    <p>Resultados automatizados preliminares para seguimiento preventivo. Consulta a un profesional para una evaluación clínica.</p>
    {!professional && !page.inferenceEnabled && <p role="status">Las nuevas evaluaciones visuales Premium todavía no están disponibles.</p>}
    {!professional && !page.premium && <p>Tu plan actual permite revisar y gestionar tu historial previo. <Link href="/premium">Consultar plan Premium</Link>.</p>}
    {feedback && <p role="status">{feedback}</p>}
    {!page.items.length && <p>{professional ? "El paciente no ha compartido evaluaciones con este contexto." : "Aún no tienes evaluaciones guardadas."}</p>}
    {page.items.length >= 2 && <p>Selecciona dos evaluaciones para comparar las detecciones registradas.</p>}
    <ul className={styles.evaluations}>
      {page.items.map(item => <li key={item.id}>
        {page.items.length >= 2 && <label className={styles.check}>
          <input type="checkbox" checked={selection.includes(item.id)} disabled={selection.length >= 2 && !selection.includes(item.id)}
            onChange={event => setSelection(value => event.target.checked ? [...value,item.id] : value.filter(id => id !== item.id))} />
          Comparar evaluación del {dates.format(new Date(item.date))} · {statusLabels[item.result.evaluation.status]}
        </label>}
        <details>
          <summary>{dates.format(new Date(item.date))} · {statusLabels[item.result.evaluation.status]}</summary>
          <EvaluationDetail item={item} />
          {item.photo && <button type="button" className={styles.button} disabled={busy} onClick={() => photo(item.id)}>Descargar fotografía privada</button>}
          {!professional && <EvaluationPermissions item={item} busy={busy} command={command} />}
        </details>
      </li>)}
    </ul>
    {page.next && <button type="button" className={styles.button} disabled={busy} onClick={() => void perform(async signal => {
      const response = await read({ afterId: page.next!.id, before: page.next!.before }, signal);
      const next: HistoryPage = await response.json();
      if (!signal.aborted) setView({ kind: "ready", page: { ...next, items: [...page.items,...next.items] } });
    })}>Cargar evaluaciones anteriores</button>}
    {comparison && <section className={styles.comparison} aria-live="polite">
      <h3>Comparación de evaluaciones</h3>
      {"reason" in comparison ? <p>{comparison.reason} Puedes revisar el detalle de cada evaluación.</p>
        : <><p>Los valores cuentan regiones detectadas. La diferencia no establece un cambio clínico.</p>
          <div className={styles.table}><table><thead><tr><th scope="col">Categoría</th>
            {selected.map(item => <th scope="col" key={item.id}>{dates.format(new Date(item.date))}</th>)}
          </tr></thead><tbody>{comparison.rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>
            {row.counts.map((count, index) => <td key={selected[index].id}>{count}</td>)}
          </tr>)}</tbody></table></div></>}
    </section>}
    {!professional && <section className={styles.permissions}>
      <h3>Consentimientos de historial</h3>
      <p>Retirar el permiso de resultados detiene el guardado y el acceso profesional a los resultados asociados. Puedes eliminar cada evaluación desde su detalle.</p>
      <ConsentControl purpose="premium_history_results" title="Guardar resultados para seguimiento"
        granted={Boolean(page.consents.premium_history_results)} canAccept={page.premium} busy={busy} command={command} />
      <ConsentControl purpose="premium_history_photo_link" title="Vincular la fotografía privada de la galería con la evaluación"
        granted={Boolean(page.consents.premium_history_photo_link)} canAccept={page.premium} busy={busy} command={command} />
      <p>Retirar el permiso de fotografías desvincula las imágenes del historial. Puedes eliminar el original desde <Link href="/fotografias">Mis fotografías</Link>.</p>
    </section>}
  </>;
}

function EvaluationDetail({ item }: { item: HistoryEvaluation }) {
  const { result } = item;
  return <div className={styles.detail}>
    <p>Proveedor {result.provider.id}. {result.model.version ? "Modelo " + result.model.version + "." : "Versión del modelo no disponible."}</p>
    {result.evaluation.status === "evaluated_no_detections" && <p>El proveedor no detectó regiones en la imagen evaluada. Una evaluación clínica puede identificar condiciones que la fotografía no muestra.</p>}
    {!!result.evaluation.detections.length && <ul>{Array.from(new Set(result.evaluation.detections.map(d => d.category.label_es)))
      .map(label => <li key={label}>{label}</li>)}</ul>}
    {!!result.evaluation.limitations.length && <><h3>Limitaciones</h3><ul>
      {result.evaluation.limitations.map((text,index) => <li key={index}>{text}</li>)}
    </ul></>}
  </div>;
}

function ConsentControl({ purpose, title, granted, canAccept, busy, command }: {
  purpose: HistoryPurpose; title: string; granted: boolean; canAccept: boolean; busy: boolean; command: (body: Record<string,unknown>) => void;
}) {
  return <div className={styles.consent}>
    <span>{title} · {granted ? "Autorizado" : "Sin autorización"}</span>
    {granted || canAccept ? <button className={styles.button} type="button" disabled={busy} onClick={() => command(granted
      ? { action:"consent_revoke", purpose }
      : { action:"consent_accept", purpose, version:HISTORY_CONSENT_VERSION, accepted:true })}>
      {granted ? "Retirar autorización" : "Autorizar"}
    </button> : null}
  </div>;
}

function EvaluationPermissions({ item, busy, command }: {
  item: HistoryEvaluation; busy: boolean; command: (body: Record<string,unknown>) => void;
}) {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  async function load(after?: string) {
    setLoading(true);
    setStatus("");
    try {
      const query = new URLSearchParams({ limit:"50", ...(after ? {afterId:after} : {}) });
      const response = await privateRequest("/api/clinical/access-grants?" + query);
      const value: { data: { items: Grant[] }; nextAfterId: string | null } = await response.json();
      setGrants(previous => [...(after ? previous ?? [] : []),...value.data.items.filter(grant => grant.estado === "vigente")]);
      setNext(value.nextAfterId);
    } catch { setStatus("No pudimos consultar tus permisos clínicos."); }
    finally { setLoading(false); }
  }
  function share(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    command({ action:"share", evaluationId:item.id, grantId:data.get("grant"), accepted:true, photo:data.has("photo") });
  }
  return <div className={styles.permissions}>
    <h3>Acceso profesional</h3>
    {item.shares.map(grantId => <div className={styles.consent} key={grantId}>
      <span>Permiso {grantId.slice(0,8)}</span>
      <button className={styles.button} type="button" disabled={busy}
        onClick={() => command({ action:"unshare", evaluationId:item.id, grantId })}>Quitar evaluación de este permiso</button>
    </div>)}
    {item.shareable && <>
      {grants === null && <button type="button" className={styles.button} disabled={busy || loading} onClick={() => void load()}>
        {loading ? "Consultando permisos…" : "Consultar permisos clínicos vigentes"}
      </button>}
      {grants?.length ? <form className={styles.share} onSubmit={share}>
        <label>Permiso clínico
          <select name="grant" required defaultValue="">
            <option value="" disabled>Elige un permiso</option>
            {grants.map(grant => <option key={grant.id} value={grant.id}>
              {grant.id.slice(0,8)} · vence {dates.format(new Date(grant.expiresAt))}
            </option>)}
          </select>
        </label>
        {item.photo && <label className={styles.check}><input name="photo" type="checkbox" /> Incluir acceso a la fotografía</label>}
        <button className={styles.button} type="submit" disabled={busy}>Autorizar acceso a esta evaluación</button>
      </form> : grants && !next ? <p>No tienes permisos clínicos vigentes.</p> : null}
      {next && <button type="button" className={styles.button} disabled={busy || loading} onClick={() => void load(next)}>Cargar más permisos</button>}
      {status && <p role="status">{status}</p>}
    </>}
    <button className={styles.button} type="button" disabled={busy} onClick={() => {
      if (window.confirm("¿Eliminar del historial esta evaluación y quitar su acceso profesional?")) {
        command({ action:"delete", evaluationId:item.id });
      }
    }}>Eliminar evaluación del historial</button>
  </div>;
}
