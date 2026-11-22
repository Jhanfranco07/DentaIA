import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Controles estáticos de la migración candidata. NO sustituyen pruebas RLS
 * con sesiones auténticas y transacciones en la base de QA.
 */
const sql = readFileSync(join(process.cwd(), "docs/sql/DI-207-propuesta-esquema-rutinas.sql"), "utf8");

describe("DI-207: esquema candidato denegado por defecto", () => {
  it("habilita RLS en todas las tablas nuevas", () => {
    for (const tabla of [
      "public.routine_followup_consents",
      "public.routine_plan_proposals",
      "public.routine_proposal_activities",
      "clinical.routine_followup_audit",
    ]) expect(sql).toContain(`alter table ${tabla} enable row level security;`);
  });
  it("no entrega permisos de escritura directa a pacientes o profesionales", () => {
    expect(sql).not.toMatch(/grant\s+(?:all|insert|update|delete)\s+on\s+[^;]+\s+to\s+authenticated/i);
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role;");
  });
  it("aísla las lecturas mediante dueño y JWT de rol paciente", () => {
    expect(sql).toContain("patient_id = (select auth.uid())");
    expect(sql).toContain("'app_metadata'");
    expect(sql).toContain("'paciente'");
    expect(sql).toContain("routine_proposals_select_owner");
  });
  it("impone integridad de pacientes, actividades y una asignación aceptada", () => {
    expect(sql).toContain("foreign key(consent_id, patient_id)");
    expect(sql).toContain("foreign key(plan_id, activity_id)");
    expect(sql).toContain("where status = 'aceptada'");
    expect(sql).toContain("routine_consent_status_dates");
  });
  it("separa la auditoría de los datos expuestos a Data API", () => {
    expect(sql).toContain("create table clinical.routine_followup_audit");
    expect(sql).not.toMatch(/grant\s+select\s+on\s+clinical\.routine_followup_audit\s+to\s+authenticated/i);
  });
});
