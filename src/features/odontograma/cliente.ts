import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ExpedienteOdontograma, GuardarOdontograma } from "./modelo";

export class ErrorOdontograma extends Error {
  constructor(readonly status: number) { super("Operación del odontograma no disponible."); }
}

async function solicitar(patientId: string, membershipId: string, signal: AbortSignal, save?: GuardarOdontograma, photo?: string) {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error || !data.session) throw new ErrorOdontograma(401);
  const route = `/api/clinical/patients/${encodeURIComponent(patientId)}/odontogram`;
  const query = new URLSearchParams({ membershipId });
  if (photo) query.set("photo", photo);
  const headers = new Headers({ Authorization: `Bearer ${data.session.access_token}` });
  const { id, ...body } = save ?? {};
  if (id) {
    headers.set("Idempotency-Key", id);
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(save ? route : `${route}?${query}`, {
    method: save ? "POST" : "GET", headers, signal, cache: "no-store",
    body: save ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new ErrorOdontograma(response.status);
  return response;
}

export async function leerOdontograma(patientId: string, membershipId: string, signal: AbortSignal): Promise<ExpedienteOdontograma> {
  const response = await solicitar(patientId, membershipId, signal);
  const { data } = await response.json();
  if (data?.patientId !== patientId) throw new ErrorOdontograma(503);
  return data;
}

export async function guardarOdontograma(patientId: string, input: GuardarOdontograma, signal: AbortSignal) {
  await solicitar(patientId, input.membershipId, signal, input);
}

export async function verFotografia(patientId: string, membershipId: string, analysisId: string, signal: AbortSignal) {
  return (await solicitar(patientId, membershipId, signal, undefined, analysisId)).blob();
}
