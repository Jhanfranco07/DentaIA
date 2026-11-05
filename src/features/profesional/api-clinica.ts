export type AmbienteClinico = "qa_local" | "academic_remote";
export type EstadoDatoClinico = "recorded" | "unknown" | "not_recorded";
export type CodigoErrorBackend =
  | "INVALID_REQUEST"
  | "INVALID_CURSOR"
  | "AUTHENTICATION_REQUIRED"
  | "ACCESS_DENIED"
  | "NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "SERVICE_UNAVAILABLE";

export type CodigoErrorClinico =
  | CodigoErrorBackend
  | "INVALID_RESPONSE"
  | "SESSION_UNAVAILABLE";

export class ErrorApiClinica extends Error {
  readonly status: number;
  readonly code: CodigoErrorClinico;
  readonly requestId: string | null;

  constructor(
    status: number,
    code: CodigoErrorClinico,
    requestId: string | null = null,
  ) {
    super(code);
    this.name = "ErrorApiClinica";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export type AccionErrorPaginacionContextos =
  | "expirar-sesion"
  | "restringir-contexto"
  | "mostrar-error";

/**
 * Mantiene la respuesta a errores de la paginación de membresías alineada con
 * la limpieza de contexto de la vista. La autorización sigue siendo del BFF.
 */
export function clasificarErrorPaginacionContextos(
  error: unknown,
): AccionErrorPaginacionContextos {
  if (!(error instanceof ErrorApiClinica)) return "mostrar-error";
  if (error.status === 401) return "expirar-sesion";
  if (error.status === 403) return "restringir-contexto";
  return "mostrar-error";
}

export interface ContextoClinico {
  membershipId: string;
  clinicId: string;
  clinicName: string;
  validFrom: string;
  validUntil: string | null;
}

export interface PerfilProfesionalClinico {
  professionalId: string;
  dentistId: string | null;
  contexts: ContextoClinico[];
}

export interface SolicitudProfesionalClinica {
  id: string;
  status: "requested" | "cancelled";
  createdAt: string;
  preferredDate: string;
  preferredTime: string | null;
  isDemo: true;
}

export interface PacienteAutorizadoClinico {
  patientId: string;
}

export interface EntradaClinica {
  id: string;
  state: EstadoDatoClinico;
  value: string | null;
  codeSystem: string | null;
  code: string | null;
}

/** DTO especial del BFF: no reutiliza la forma completa de una entrada clínica. */
export interface AntecedenteClinico {
  state: EstadoDatoClinico;
  value: string | null;
  entryId?: string;
}

export interface EntradaClinicaCronologica extends EntradaClinica {
  kind: "background" | "diagnosis" | "treatment";
  recordedAt: string;
  replacesId: string | null;
  correctionReason: string | null;
}

export interface ExamenClinico {
  id: string;
  kind: "exam" | "document";
  title: string;
  examDate: string | null;
  availability: "available" | "unavailable";
}

export interface AtencionClinica {
  encounterId: string;
  attendedAt: string;
  recordedAt: string;
  status: "recorded" | "voided";
  replacesId: string | null;
  correctionReason: string | null;
  origin: {
    clinicId: string;
    clinicName: string;
    professionalId: string;
    professionalName: string | null;
  };
  background: AntecedenteClinico;
  clinicalEntries: EntradaClinicaCronologica[];
  diagnoses: EntradaClinica[];
  treatments: EntradaClinica[];
  exams: ExamenClinico[];
}

export interface HistorialClinico {
  environment: AmbienteClinico;
  estado: "listo" | "sin_datos";
  caso: {
    patientId: string;
    professionalContext: string | null;
    clinicContext: string | null;
  };
  entries: AtencionClinica[];
  nextCursor: string | null;
  requestId: string;
}

export interface PaginaClinica<T> {
  data: T;
  nextAfterId: string | null;
  requestId: string;
  environment: AmbienteClinico;
}

export interface CredencialesClinicas {
  obtenerAccessToken(): Promise<string | null>;
}

export interface DependenciasApiClinica extends CredencialesClinicas {
  fetchImpl?: typeof fetch;
}

interface ConsultaPaginada {
  afterId?: string | null;
  limit?: number;
}

interface RespuestaError {
  ok: false;
  code: CodigoErrorBackend;
  requestId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/;
const CODIGOS_ERROR = new Set<CodigoErrorBackend>([
  "INVALID_REQUEST",
  "INVALID_CURSOR",
  "AUTHENTICATION_REQUIRED",
  "ACCESS_DENIED",
  "NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "SERVICE_UNAVAILABLE",
]);

function esObjeto(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function esUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function esFechaIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const coincidencia = ISO.exec(value);
  if (!coincidencia || !Number.isFinite(Date.parse(value))) return false;

  const [, anio, mes, dia, hora, minuto, segundo] = coincidencia;
  const diasDelMes = new Date(Date.UTC(Number(anio), Number(mes), 0)).getUTCDate();
  return (
    Number(anio) >= 1000 &&
    Number(mes) >= 1 &&
    Number(mes) <= 12 &&
    Number(dia) >= 1 &&
    Number(dia) <= diasDelMes &&
    Number(hora) < 24 &&
    Number(minuto) < 60 &&
    Number(segundo) < 60
  );
}

function texto(value: unknown, maximo: number): string {
  if (typeof value !== "string" || value.length > maximo) {
    throw respuestaInvalida();
  }
  return value;
}

function uuid(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (!esUuid(value)) throw respuestaInvalida();
  return value;
}

function fecha(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (!esFechaIso(value)) throw respuestaInvalida();
  return value;
}

function arreglo(value: unknown, maximo: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximo) {
    throw respuestaInvalida();
  }
  return value;
}

function objeto(value: unknown): Record<string, unknown> {
  if (!esObjeto(value)) throw respuestaInvalida();
  return value;
}

function ambiente(value: unknown): AmbienteClinico {
  if (value === "qa_local" || value === "academic_remote") return value;
  throw respuestaInvalida();
}

function respuestaInvalida(): ErrorApiClinica {
  return new ErrorApiClinica(503, "INVALID_RESPONSE");
}

function parsearEntrada(value: unknown): EntradaClinica {
  const item = objeto(value);
  if (
    item.state !== "recorded" &&
    item.state !== "unknown" &&
    item.state !== "not_recorded"
  ) {
    throw respuestaInvalida();
  }

  return {
    id: uuid(item.id)!,
    state: item.state,
    value: item.value === null ? null : texto(item.value, 10000),
    codeSystem:
      item.codeSystem === null ? null : texto(item.codeSystem, 500),
    code: item.code === null ? null : texto(item.code, 500),
  };
}

function parsearAntecedente(value: unknown): AntecedenteClinico {
  const item = objeto(value);
  if (
    item.state !== "recorded" &&
    item.state !== "unknown" &&
    item.state !== "not_recorded"
  ) {
    throw respuestaInvalida();
  }

  const entryId = item.entryId;
  return {
    state: item.state,
    value: item.value === null ? null : texto(item.value, 10000),
    ...(entryId === undefined ? {} : { entryId: uuid(entryId)! }),
  };
}

function parsearAtencion(value: unknown): AtencionClinica {
  const item = objeto(value);
  const origen = objeto(item.origin);
  const background = parsearAntecedente(item.background);

  if (item.status !== "recorded" && item.status !== "voided") {
    throw respuestaInvalida();
  }

  return {
    encounterId: uuid(item.encounterId)!,
    attendedAt: fecha(item.attendedAt)!,
    recordedAt: fecha(item.recordedAt)!,
    status: item.status,
    replacesId: uuid(item.replacesId, true),
    correctionReason:
      item.correctionReason === null
        ? null
        : texto(item.correctionReason, 1000),
    origin: {
      clinicId: uuid(origen.clinicId)!,
      clinicName: texto(origen.clinicName, 200),
      professionalId: uuid(origen.professionalId)!,
      professionalName:
        origen.professionalName === null
          ? null
          : texto(origen.professionalName, 120),
    },
    background,
    clinicalEntries: arreglo(item.clinicalEntries, 100).map((entry) => {
      const cronologica = objeto(entry);
      const base = parsearEntrada(cronologica);
      if (
        cronologica.kind !== "background" &&
        cronologica.kind !== "diagnosis" &&
        cronologica.kind !== "treatment"
      ) {
        throw respuestaInvalida();
      }
      return {
        ...base,
        kind: cronologica.kind,
        recordedAt: fecha(cronologica.recordedAt)!,
        replacesId: uuid(cronologica.replacesId, true),
        correctionReason:
          cronologica.correctionReason === null
            ? null
            : texto(cronologica.correctionReason, 1000),
      };
    }),
    diagnoses: arreglo(item.diagnoses, 100).map(parsearEntrada),
    treatments: arreglo(item.treatments, 100).map(parsearEntrada),
    exams: arreglo(item.exams, 100).map((exam) => {
      const dato = objeto(exam);
      if (
        (dato.kind !== "exam" && dato.kind !== "document") ||
        (dato.availability !== "available" && dato.availability !== "unavailable") ||
        !(
          dato.examDate === null ||
          (typeof dato.examDate === "string" && FECHA.test(dato.examDate))
        )
      ) {
        throw respuestaInvalida();
      }
      return {
        id: uuid(dato.id)!,
        kind: dato.kind,
        title: texto(dato.title, 200),
        examDate: dato.examDate,
        availability: dato.availability,
      };
    }),
  };
}

function parsearPagina<T>(
  value: unknown,
  kind: "professional" | "requests" | "patients",
  parsearDatos: (datos: Record<string, unknown>) => T,
): PaginaClinica<T> {
  const respuesta = objeto(value);
  if (
    respuesta.ok !== true ||
    respuesta.apiVersion !== "clinical.workspace.v1" ||
    respuesta.kind !== kind
  ) {
    throw respuestaInvalida();
  }

  return {
    data: parsearDatos(objeto(respuesta.data)),
    nextAfterId: uuid(respuesta.nextAfterId, true),
    requestId: uuid(respuesta.requestId)!,
    environment: ambiente(respuesta.environment),
  };
}

export function parsearPerfilProfesional(value: unknown): PaginaClinica<PerfilProfesionalClinico> {
  return parsearPagina(value, "professional", (datos) => ({
    professionalId: uuid(datos.professionalId)!,
    dentistId: uuid(datos.dentistId, true),
    contexts: arreglo(datos.contexts, 50).map((contexto) => {
      const dato = objeto(contexto);
      return {
        membershipId: uuid(dato.membershipId)!,
        clinicId: uuid(dato.clinicId)!,
        clinicName: texto(dato.clinicName, 200),
        validFrom: fecha(dato.validFrom)!,
        validUntil: fecha(dato.validUntil, true),
      };
    }),
  }));
}

export function parsearSolicitudesProfesionales(
  value: unknown,
): PaginaClinica<{ membershipId: string; professionalId: string; items: SolicitudProfesionalClinica[] }> {
  return parsearPagina(value, "requests", (datos) => ({
    membershipId: uuid(datos.membershipId)!,
    professionalId: uuid(datos.professionalId)!,
    items: arreglo(datos.items, 50).map((item) => {
      const solicitud = objeto(item);
      if (
        (solicitud.status !== "requested" && solicitud.status !== "cancelled") ||
        solicitud.isDemo !== true ||
        typeof solicitud.preferredDate !== "string" ||
        !FECHA.test(solicitud.preferredDate) ||
        !(
          solicitud.preferredTime === null ||
          (typeof solicitud.preferredTime === "string" &&
            HORA.test(solicitud.preferredTime))
        )
      ) {
        throw respuestaInvalida();
      }
      return {
        id: uuid(solicitud.id)!,
        status: solicitud.status,
        createdAt: fecha(solicitud.createdAt)!,
        preferredDate: solicitud.preferredDate,
        preferredTime: solicitud.preferredTime,
        isDemo: true,
      };
    }),
  }));
}

export function parsearPacientesAutorizados(
  value: unknown,
): PaginaClinica<{ membershipId: string; items: PacienteAutorizadoClinico[] }> {
  return parsearPagina(value, "patients", (datos) => ({
    membershipId: uuid(datos.membershipId)!,
    items: arreglo(datos.items, 50).map((item) => ({
      patientId: uuid(objeto(item).patientId)!,
    })),
  }));
}

/**
 * Las páginas posteriores de membresías deben pertenecer al mismo profesional
 * ya validado por el primer resultado. No sustituye la autorización del BFF.
 */
export function coincideProfesional(
  esperado: string,
  recibido: string,
): boolean {
  return esperado === recibido;
}

/**
 * El backend ya ata la consulta a la sesión. Esta comprobación evita que una
 * respuesta cruzada se incorpore a la interfaz si el contrato se degrada.
 */
export function paginaSolicitudesCompatible(
  datos: { membershipId: string; professionalId: string },
  membershipIdEsperado: string,
  professionalIdEsperado: string,
): boolean {
  return (
    datos.membershipId === membershipIdEsperado &&
    coincideProfesional(professionalIdEsperado, datos.professionalId)
  );
}

export function parsearHistorialClinico(value: unknown): HistorialClinico {
  const respuesta = objeto(value);
  if (
    respuesta.ok !== true ||
    respuesta.apiVersion !== "clinical.v1" ||
    respuesta.origen !== "supabase" ||
    (respuesta.estado !== "listo" && respuesta.estado !== "sin_datos")
  ) {
    throw respuestaInvalida();
  }
  const caso = objeto(respuesta.caso);
  return {
    environment: ambiente(respuesta.environment),
    estado: respuesta.estado,
    caso: {
      patientId: uuid(caso.patientId)!,
      professionalContext: uuid(caso.professionalContext, true),
      clinicContext: uuid(caso.clinicContext, true),
    },
    entries: arreglo(respuesta.entries, 50).map(parsearAtencion),
    nextCursor:
      respuesta.nextCursor === null
        ? null
        : texto(respuesta.nextCursor, 2048),
    requestId: uuid(respuesta.requestId)!,
  };
}

function consultaPaginada(parametros: ConsultaPaginada): URLSearchParams {
  const query = new URLSearchParams();
  const limit = parametros.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ErrorApiClinica(400, "INVALID_REQUEST");
  }
  query.set("limit", String(limit));
  if (parametros.afterId) {
    if (!esUuid(parametros.afterId)) {
      throw new ErrorApiClinica(400, "INVALID_REQUEST");
    }
    query.set("afterId", parametros.afterId);
  }
  return query;
}

function ruta(path: string, query: URLSearchParams): string {
  const serializada = query.toString();
  return serializada ? `${path}?${serializada}` : path;
}

function errorDesdeRespuesta(status: number, value: unknown): ErrorApiClinica {
  if (esObjeto(value) && value.ok === false) {
    if (
      !CODIGOS_ERROR.has(value.code as CodigoErrorBackend) ||
      !esUuid(value.requestId)
    ) {
      return respuestaInvalida();
    }
    return new ErrorApiClinica(
      status,
      value.code as CodigoErrorBackend,
      value.requestId,
    );
  }

  if (status === 401) return new ErrorApiClinica(401, "AUTHENTICATION_REQUIRED");
  if (status === 403) return new ErrorApiClinica(403, "ACCESS_DENIED");
  if (status === 404) return new ErrorApiClinica(404, "NOT_FOUND");
  return respuestaInvalida();
}

export function esSolicitudAbortada(error: unknown): boolean {
  return (
    (error instanceof DOMException || error instanceof Error) &&
    error.name === "AbortError"
  );
}

export function crearClienteApiClinica({
  obtenerAccessToken,
  fetchImpl = fetch,
}: DependenciasApiClinica) {
  async function consultar<T>(
    path: string,
    signal: AbortSignal,
    parsear: (value: unknown) => T,
  ): Promise<T> {
    let token: string | null;
    try {
      token = await obtenerAccessToken();
    } catch {
      throw new ErrorApiClinica(503, "SESSION_UNAVAILABLE");
    }

    if (!token) {
      throw new ErrorApiClinica(401, "AUTHENTICATION_REQUIRED");
    }

    const respuesta = await fetchImpl(path, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });

    let cuerpo: unknown;
    try {
      cuerpo = await respuesta.json();
    } catch {
      if (!respuesta.ok) {
        throw errorDesdeRespuesta(respuesta.status, null);
      }
      throw respuestaInvalida();
    }

    if (!respuesta.ok) throw errorDesdeRespuesta(respuesta.status, cuerpo);

    try {
      return parsear(cuerpo);
    } catch (error) {
      if (error instanceof ErrorApiClinica) throw error;
      throw respuestaInvalida();
    }
  }

  return {
    obtenerPerfil(
      parametros: ConsultaPaginada = {},
      signal: AbortSignal,
    ) {
      return consultar(
        ruta("/api/professional/me", consultaPaginada(parametros)),
        signal,
        parsearPerfilProfesional,
      );
    },

    obtenerSolicitudes(
      membershipId: string,
      parametros: ConsultaPaginada = {},
      signal: AbortSignal,
    ) {
      if (!esUuid(membershipId)) {
        throw new ErrorApiClinica(400, "INVALID_REQUEST");
      }
      const query = consultaPaginada(parametros);
      query.set("membershipId", membershipId);
      return consultar(
        ruta("/api/professional/requests", query),
        signal,
        parsearSolicitudesProfesionales,
      );
    },

    obtenerPacientes(
      membershipId: string,
      parametros: ConsultaPaginada = {},
      signal: AbortSignal,
    ) {
      if (!esUuid(membershipId)) {
        throw new ErrorApiClinica(400, "INVALID_REQUEST");
      }
      const query = consultaPaginada(parametros);
      query.set("membershipId", membershipId);
      return consultar(
        ruta("/api/professional/patients", query),
        signal,
        parsearPacientesAutorizados,
      );
    },

    obtenerHistorial(
      patientId: string,
      membershipId: string,
      parametros: { cursor?: string | null; limit?: number } = {},
      signal: AbortSignal,
    ) {
      if (!esUuid(patientId) || !esUuid(membershipId)) {
        throw new ErrorApiClinica(400, "INVALID_REQUEST");
      }
      const limit = parametros.limit ?? 20;
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        throw new ErrorApiClinica(400, "INVALID_REQUEST");
      }
      const query = new URLSearchParams({ membershipId, limit: String(limit) });
      if (parametros.cursor) {
        if (parametros.cursor.length > 2048) {
          throw new ErrorApiClinica(400, "INVALID_CURSOR");
        }
        query.set("cursor", parametros.cursor);
      }
      return consultar(
        ruta(`/api/clinical/patients/${encodeURIComponent(patientId)}/history`, query),
        signal,
        parsearHistorialClinico,
      );
    },
  };
}
