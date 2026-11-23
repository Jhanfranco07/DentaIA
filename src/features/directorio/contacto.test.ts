import { describe, expect, it } from "vitest";
import { normalizarWhatsapp, enlaceWhatsappProfesional } from "./contacto";

describe("Directorio: contacto externo seguro", () => {
  it("acepta formato internacional y nueve dígitos peruanos", () => {
    expect(normalizarWhatsapp("912 345 678")).toBe("+51912345678");
    expect(normalizarWhatsapp("+51 912-345-678")).toBe("+51912345678");
  });
  it("rechaza enlaces, números falsos y caracteres no permitidos", () => {
    for (const valor of ["", "123", "https://wa.me/51912345678",
      "+0000000000", "+51<javascript>", "999999999999999999", "+51;alert(1)"]) {
      expect(normalizarWhatsapp(valor)).toBeNull();
    }
  });
  it("genera URL que no incluye información clínica del paciente", () => {
    const url = enlaceWhatsappProfesional("+51912345678","Odontólogo");
    expect(url?.startsWith("https://wa.me/51912345678?text=")).toBe(true);
    expect(decodeURIComponent(url ?? "")).toContain("DentaIA");
    expect(url).not.toContain("imagen");
    expect(enlaceWhatsappProfesional("invalido","Otro")).toBeNull();
  });
});
