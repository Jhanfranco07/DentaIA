import "server-only";
import { conAccesoAdministrativo } from "@/features/autorizacion/servidor";
import { crearProveedorAdministrativoSimulado } from "./servicios";
import { crearApiAdministrativa } from "./api";

// Fuente fijada por servidor. No hay selección de proveedor por parámetros ni acceso a Auth Admin.
const api = crearApiAdministrativa(conAccesoAdministrativo, crearProveedorAdministrativoSimulado());
export const listarUsuariosAdministrativos = api.listar;
export const validarPropuestaRol = api.validarRol;
