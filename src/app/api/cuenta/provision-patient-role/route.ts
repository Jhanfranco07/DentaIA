import { NextResponse } from "next/server";
import { rolesDesdeAppMetadata } from "@/features/autorizacion/roles";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromRequest } from "@/lib/supabase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tieneAsignacionDentaia(metadata: unknown): boolean {
  return typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
    && Object.hasOwn(metadata, "dentaia");
}

function noCache() {
  return { "Cache-Control": "no-store" };
}

export async function POST(request: Request) {
  try {
    const identidad = await getUserFromRequest(request);
    if (!identidad?.id) {
      return NextResponse.json({ error: "Inicia sesión para activar tu cuenta." }, {
        status: 401,
        headers: noCache(),
      });
    }
    if (identidad.is_anonymous === true || !identidad.confirmed_at) {
      return NextResponse.json({ error: "Confirma tu cuenta antes de activarla." }, {
        status: 403,
        headers: noCache(),
      });
    }

    const admin = getSupabaseAdmin();
    const { data: consulta, error: errorConsulta } = await admin.auth.admin.getUserById(identidad.id);
    if (errorConsulta || !consulta.user || consulta.user.id !== identidad.id) {
      console.error("No se pudo verificar la cuenta para activar el rol de paciente.");
      return NextResponse.json({ error: "No se pudo verificar la cuenta." }, {
        status: 503,
        headers: noCache(),
      });
    }

    const metadata = consulta.user.app_metadata ?? {};
    if (tieneAsignacionDentaia(metadata)) {
      if (rolesDesdeAppMetadata(metadata).length > 0) {
        return NextResponse.json({ ok: true }, { headers: noCache() });
      }
      return NextResponse.json({ error: "La asignación de acceso requiere revisión." }, {
        status: 409,
        headers: noCache(),
      });
    }

    const { data: actualizacion, error: errorActualizacion } = await admin.auth.admin.updateUserById(
      identidad.id,
      {
        app_metadata: {
          ...metadata,
          dentaia: { version: 1, estado: "activo", roles: ["paciente"] },
        },
      },
    );
    if (errorActualizacion || !actualizacion.user
      || !rolesDesdeAppMetadata(actualizacion.user.app_metadata).includes("paciente")) {
      console.error("No se pudo asignar el rol inicial de paciente.");
      return NextResponse.json({ error: "No se pudo activar el perfil de paciente." }, {
        status: 503,
        headers: noCache(),
      });
    }

    return NextResponse.json({ ok: true }, { headers: noCache() });
  } catch {
    console.error("No se pudo completar la activación del rol inicial de paciente.");
    return NextResponse.json({ error: "No se pudo activar el perfil de paciente." }, {
      status: 503,
      headers: noCache(),
    });
  }
}
