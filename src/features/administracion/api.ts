import type { AccionAdministrativa, OperacionAdministrativa } from "../autorizacion/autorizacion";
import type { ProveedorAdministrativo } from "./servicios";

type Ejecutor = (request: Request, accion: AccionAdministrativa, operacion: OperacionAdministrativa) => Promise<Response>;
/** La autorización envuelve incluso el parseo del cuerpo: ninguna consulta antes del guard. */
export function crearApiAdministrativa(ejecutar: Ejecutor, proveedor: ProveedorAdministrativo) {
  return {
    listar(request: Request) {
      return ejecutar(request, "usuarios.consultar_demo", async () => {
        const parametros = new URL(request.url).searchParams;
        const entrada: Record<string, unknown> = {};
        for (const clave of parametros.keys()) {
          if (parametros.getAll(clave).length !== 1) return Response.json({ error: "Parámetros duplicados." }, { status: 400 });
          if (!["q", "rol", "estado", "pagina", "tamano"].includes(clave)) return Response.json({ error: "Parámetro no permitido." }, { status: 400 });
          const valor = parametros.get(clave)!;
          entrada[clave] = ["pagina", "tamano"].includes(clave) && /^\d+$/.test(valor) ? Number(valor) : valor;
        }
        const resultado = await proveedor.listar(entrada);
        if (!resultado.ok) return Response.json({ error: resultado.mensaje, codigo: resultado.codigo }, { status: resultado.status });
        const { origen, total, pagina, paginas, tamano, usuarios } = resultado.valor;
        // Proyección explícita: no serializar objetos Auth/perfiles completos ni campos adicionales.
        return Response.json({ origen, total, pagina, paginas, tamano, usuarios: usuarios.map(({ id, etiqueta, roles, origenRoles, estado }) =>
          ({ id, etiqueta, roles, origenRoles, estado })) });
      });
    },
    validarRol(request: Request) {
      return ejecutar(request, "roles.validar_propuesta", async contexto => {
        if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
          return Response.json({ error: "Se requiere un cuerpo JSON." }, { status: 400 });
        }
        // La operación solo recibe una propuesta pequeña, nunca un usuario completo.
        const lector = request.body?.getReader();
        if (!lector) return Response.json({ error: "Falta la propuesta." }, { status: 400 });
        const partes: Uint8Array[] = [];
        let longitud = 0;
        while (true) {
          const { value, done } = await lector.read();
          if (done) break;
          longitud += value.byteLength;
          if (longitud > 2048) {
            await lector.cancel();
            return Response.json({ error: "Propuesta demasiado extensa." }, { status: 413 });
          }
          partes.push(value);
        }
        const bytes = new Uint8Array(longitud);
        let posicion = 0;
        for (const parte of partes) { bytes.set(parte, posicion); posicion += parte.byteLength; }
        const texto = new TextDecoder().decode(bytes);
        let entrada: unknown;
        try { entrada = JSON.parse(texto); } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
        const resultado = await proveedor.validarPropuesta(entrada, contexto.usuarioId);
        if (!resultado.ok) return Response.json({ error: resultado.mensaje, codigo: resultado.codigo }, { status: resultado.status });
        const { modo, aplicado, usuarioId, rol, mensaje } = resultado.valor;
        return Response.json({ modo, aplicado, usuarioId, rol, mensaje });
      });
    },
  };
}
