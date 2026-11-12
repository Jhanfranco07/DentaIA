import { CATALOGO_DEMO } from "./catalogo-demo";
import { inicialesDe } from "./formato";
import styles from "./directorio.module.css";

/** Avatares originales: perfiles ficticios 1–20 solamente; otros registros conservan iniciales. */
// La hoja 4×5 está ordenada exactamente como CATALOGO_DEMO (mujer/hombre alternados).
const AVATARES = CATALOGO_DEMO.map((perfil, indice) => ({ id: perfil.id, indice }));

// Cuatro perfiles ficticios originales publicados en dentists; no pertenecen al catálogo de 20.
// El orden coincide con el atlas de ilustraciones 2 × 2 (Daniel, Gabriel, Andrea, Valeria).
export const IDS_DEMO_LEGADO = [
  "a1560ae0-2fc1-4fbc-87c6-beee116cf2e5",
  "77a14fc8-1007-4f62-b65d-70c83a137caa",
  "99acc934-68a7-4fa7-8075-8deafb3e4cf8",
  "823f21dd-bf4b-4dec-9bd6-dd5416e7213d",
] as const;

export function tratamientoDemo(id: string): string {
  const indice = CATALOGO_DEMO.findIndex(perfil => perfil.id === id);
  return indice === -1 ? "" : indice % 2 === 0 ? "Dra. " : "Dr. ";
}
export default function AvatarOdontologo({ id, name, initials, avatarColor, hero = false }: {
  id: string; name: string; initials?: string | null; avatarColor?: string | null; hero?: boolean;
}) {
  const antiguo = IDS_DEMO_LEGADO.findIndex(identificador => identificador === id);
  if (antiguo !== -1) {
    const col = antiguo % 2, fila = Math.floor(antiguo / 2);
    return <span aria-hidden="true" data-avatar-demo={id} className={`${styles.avatar} ${styles.avatarLegado} ${hero ? styles.avatarHero : ""}`}
      style={{ backgroundPosition: `${col * 100}% ${fila * 100}%` }} />;
  }
  const rostro = AVATARES.find(a => a.id === id);
  const clase = `${styles.avatar} ${styles.avatarIlustrado} ${hero ? styles.avatarHero : ""}`;
  if (!rostro) return <span aria-hidden="true" className={`${styles.avatar} ${hero ? styles.avatarHero : ""}`} style={{ backgroundColor: avatarColor?.trim() || "#e3f6f0" }}>{inicialesDe(initials ?? "",name)}</span>;
  const col = rostro.indice % 4;
  const fila = Math.floor(rostro.indice / 4);
  // Ligerísimo recorte centrado sobre la nueva hoja: los rostros ya ocupan toda su celda.
  const escala = hero ? 1.05 : 1.02;
  const posX = ((col * escala + (escala - 1) / 2) / (4 * escala - 1)) * 100;
  const posY = ((fila * escala + (escala - 1) / 2) / (5 * escala - 1)) * 100;
  return <span aria-hidden="true" className={clase} style={{
    backgroundSize: `${4 * escala * 100}% ${5 * escala * 100}%`,
    backgroundPosition: `${posX}% ${posY}%`,
  }} />;
}
