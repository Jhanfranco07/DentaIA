import { CATALOGO_DEMO } from "./catalogo-demo";
import { inicialesDe } from "./formato";
import styles from "./directorio.module.css";

/** Avatares originales: perfiles ficticios 1–20 solamente; otros registros conservan iniciales. */
// La hoja 4×5 está ordenada exactamente como CATALOGO_DEMO (mujer/hombre alternados).
const AVATARES = CATALOGO_DEMO.map((perfil, indice) => ({ id: perfil.id, indice }));
export function tratamientoDemo(id: string): string {
  const indice = CATALOGO_DEMO.findIndex(perfil => perfil.id === id);
  return indice === -1 ? "" : indice % 2 === 0 ? "Dra. " : "Dr. ";
}
export default function AvatarOdontologo({ id, name, initials, avatarColor, hero = false }: {
  id: string; name: string; initials?: string | null; avatarColor?: string | null; hero?: boolean;
}) {
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
