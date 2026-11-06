import "server-only";
import { conAccesoAdministrativo } from "../autorizacion/servidor";
import { crearConsultaUsuariosReales } from "./api-usuarios-reales";
import { crearLecturasSupabase } from "./lecturas-supabase";
import { crearProveedorUsuariosReales } from "./usuarios-reales";

// Crear el SDK privilegiado únicamente dentro de una petición autorizada, no al importar/build.
export const listarUsuariosReales = crearConsultaUsuariosReales(
  conAccesoAdministrativo, crearProveedorUsuariosReales(crearLecturasSupabase),
);
