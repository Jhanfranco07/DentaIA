import "server-only";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listarUsuariosReales } from "./servidor-usuarios-reales";
import { ejecutarMatrizLectura } from "./validacion-lectura";

export async function validarLecturaDesdeSesion(request: Request) {
  const informe = await ejecutarMatrizLectura(async (query, identidad) => {
    const headers = new Headers();
    // Propagación normal dentro de la app. Nunca se registra o devuelve la cabecera.
    if (identidad === "actual" && request.headers.has("authorization")) headers.set("authorization", request.headers.get("authorization")!);
    if (identidad === "invalida") headers.set("authorization", "Bearer token-sintetico-de-qa-sin-identidad");
    const url = new URL("http://localhost:3000/api/administracion/usuarios/reales");
    url.search = query.toString();
    // Handler real: aplica DI-150 y consulta Supabase en cada caso. No hay mocks.
    // Invocación interna para no imprimir nombres/UUID de búsqueda en logs HTTP.
    return listarUsuariosReales(new Request(url, { method: "GET", headers, signal: request.signal }));
  });
  const ejecucionId = randomUUID();
  const evidencia = { fecha: new Date().toISOString(), ejecucionId,
    fuente: "HTTP_herramienta_local_y_handler_real_con_Supabase", sesionPresentada: request.headers.has("authorization"),
    ...informe };
  let evidenciaLocal = false;
  try {
    await writeFile(join(tmpdir(), `DentaIA-DI151-lectura-real-${ejecucionId}.json`), JSON.stringify(evidencia, null, 2), { flag: "wx", mode: 0o600 });
    evidenciaLocal = true;
  } catch { /* No exponer rutas, contenido o errores del entorno. */ }
  const status = [401, 403].includes(informe.httpInicial) ? informe.httpInicial : informe.httpInicial === 503 ? 503 : 200;
  return Response.json({ ...evidencia, evidenciaLocal }, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", Vary: "Authorization",
  } });
}
