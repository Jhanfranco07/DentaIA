/** Tipos documentales para acordar integración con las autoras; no UI ni cliente privilegiado. */
export type UUID = string; // Validación de formato y autorización en servidor.
export type ISO = string; // No truncar los seis decimales PostgreSQL al paginar.
export interface Contexto { membershipId: UUID; clinicId: UUID; clinicName: string; validFrom: ISO; validUntil: ISO | null }
export interface Concesion { id: UUID; membershipId: UUID; estado: "vigente" | "vencido" | "revocado"; expiresAt: ISO; revokedAt: ISO | null; policyVersion: string; encounterIds: UUID[] }
export interface SolicitudProfesional { id: UUID; status: "requested" | "cancelled"; createdAt: ISO; preferredDate: string; preferredTime: string | null; isDemo: true }
export interface DatosWorkspace {
  patient: { patientId: UUID };
  professional: { professionalId: UUID; dentistId: UUID | null; contexts: Contexto[] };
  grants: { patientId: UUID; items: Concesion[] };
  patients: { membershipId: UUID; items: { patientId: UUID }[] };
  requests: { professionalId: UUID; membershipId: UUID; items: SolicitudProfesional[] };
}
export type AmbienteClinico = "qa_local" | "academic_remote";
export type Workspace<K extends keyof DatosWorkspace> = { ok: true; apiVersion: "clinical.workspace.v1"; environment: AmbienteClinico; kind: K; data: DatosWorkspace[K]; nextAfterId: UUID | null; requestId: UUID };
export interface ConcederSolicitud { membershipId: UUID; encounterIds: UUID[]; expiresAt: ISO; policyVersion: string; accepted: true }
export interface ConcederRespuesta { ok: true; id: UUID; estado: Concesion["estado"]; expiresAt: ISO; revokedAt: ISO | null; replayed: boolean; requestId: UUID }
export type RevocarSolicitud = Record<string, never>;
export interface RevocarRespuesta { ok: true; id: UUID; revokedAt: ISO; requestId: UUID }
export interface ErrorClinico { ok: false; code: "INVALID_REQUEST" | "INVALID_CURSOR" | "AUTHENTICATION_REQUIRED" | "ACCESS_DENIED" | "NOT_FOUND" | "IDEMPOTENCY_CONFLICT" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE" | "SERVICE_UNAVAILABLE"; requestId: UUID }
// DTO de historial definido en F4; su proyección y validación se reutilizan, no se duplican.
export type Historial = { ok: true; environment: AmbienteClinico; nextCursor: string | null; requestId: UUID } & Omit<ReturnType<typeof import("../../../src/features/clinica-http/dto").historialDto>["data"], "environment">;
export type Respuesta<T> = T | ErrorClinico;
export const EJEMPLO_PROPIO = {
  ok: true, apiVersion: "clinical.workspace.v1", environment: "qa_local", kind: "patient",
  data: { patientId: "40000000-0000-4000-8000-000000000041" }, nextAfterId: null,
  requestId: "40000000-0000-4000-8000-000000000091",
} satisfies Workspace<"patient">;
