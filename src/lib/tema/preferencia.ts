export type Tema = "claro" | "oscuro";
export const CLAVE_TEMA = "dentaia-tema";

type Almacen = Pick<Storage, "getItem" | "setItem">;

export function leerTema(almacen: Almacen): Tema {
  try {
    const actual = almacen.getItem(CLAVE_TEMA);
    if (actual === "claro" || actual === "oscuro") return actual;
    // Conservar una elección explícita del antiguo selector del paciente.
    const anterior = almacen.getItem("dentaia-tema-paciente");
    if (actual === null && (anterior === "claro" || anterior === "oscuro")) return anterior;
  } catch { /* El tema sigue funcionando sin almacenamiento. */ }
  return "claro";
}

export function guardarTema(almacen: Almacen, tema: Tema) {
  try { almacen.setItem(CLAVE_TEMA, tema); } catch { /* Preferencia opcional. */ }
}

export function temaDesdeEvento(valor: string | null): Tema {
  return valor === "oscuro" ? "oscuro" : "claro";
}
