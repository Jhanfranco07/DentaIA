import type { AccionAdministrativa, OperacionAdministrativa } from "../autorizacion/autorizacion";
import type { ProveedorUsuariosReales } from "./usuarios-reales";

type Ejecutor = (request: Request, accion: AccionAdministrativa, operacion: OperacionAdministrativa) => Promise<Response>;

export function crearConsultaUsuariosReales(ejecutar: Ejecutor, proveedor: ProveedorUsuariosReales) {
  return (request: Request) => ejecutar(request, "usuarios.consultar_reales", async () => {
    const entrada: Record<string, unknown> = {};
    for (const [clave, valor] of new URL(request.url).searchParams) {
      if (!["q", "rol", "estado", "pagina", "tamano"].includes(clave) || Object.hasOwn(entrada, clave)) {
        return Response.json({ error: "Parámetros no permitidos o duplicados." }, { status: 400 });
      }
      entrada[clave] = ["pagina", "tamano"].includes(clave) && /^\d+$/.test(valor) ? Number(valor) : valor;
    }
    const r = await proveedor.listar(entrada);
    if (!r.ok) return Response.json({ error: r.mensaje, codigo: r.codigo }, { status: r.status });
    const { total, pagina, paginas, tamano } = r.valor;
    return Response.json({ origen: "supabase", consistencia: "lectura_no_transaccional", total, pagina, paginas, tamano,
      usuarios: r.valor.usuarios.map(({ id, perfil, cuenta, asignacion }) => ({ id, cuenta,
        perfil: { estado: perfil.estado, nombre: perfil.nombre },
        asignacion: { estado: asignacion.estado, roles: [...asignacion.roles] },
      })) });
  });
}
