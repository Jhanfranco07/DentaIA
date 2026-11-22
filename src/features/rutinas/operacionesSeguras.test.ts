import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const operaciones = readFileSync(join(process.cwd(), "docs/sql/DI-207-operaciones-transaccionales.sql"), "utf8");
const consultas = readFileSync(join(process.cwd(), "docs/sql/DI-207-consultas-autorizadas.sql"), "utf8");

describe("DI-207: protección estática de funciones privilegiadas", () => {
  it("limita las dos funciones RPC al servicio de servidor", () => {
    for (const sql of [operaciones, consultas]) {
      expect(sql).toMatch(/security definer\s+set search_path = pg_catalog/i);
      expect(sql).toMatch(/revoke all on function public\.[a-z_]+\([^;]+\)\s+from public,\s*anon,\s*authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.[a-z_]+\([^;]+\)\s+to service_role;/i);
    }
  });
  it("verifica profesional realmente validado y membresía activa", () => {
    for (const sql of [operaciones, consultas]) {
      expect(sql).toContain("pa.status='verified'");
      expect(sql).toContain("cm.status='active'");
      expect(sql).toContain("cm.valid_until>now()");
    }
  });
  it("requiere aprobación del paciente antes de proponer actividades", () => {
    expect(operaciones).toContain("v_consent.status<>'aprobado'");
    expect(operaciones).toContain("v_consent.patient_id<>p_actor_user_id");
    expect(operaciones).toContain("v_proposal.status<>'propuesta'");
    expect(operaciones).toContain("cardinality(p_activity_ids)");
  });
  it("limita el progreso profesional a las actividades del plan aceptado", () => {
    expect(consultas).toContain("m.patient_id=c.patient_id");
    expect(consultas).toContain("p.status='aceptada'");
    expect(consultas).toContain("a.proposal_id=p.id and a.activity_id=m.activity_id");
    expect(consultas).toContain("c.expires_at>now()");
  });
});
