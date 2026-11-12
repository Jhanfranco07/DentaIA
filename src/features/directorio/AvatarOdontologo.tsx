import { CATALOGO_DEMO } from "./catalogo-demo";
import { inicialesDe } from "./formato";
import styles from "./directorio.module.css";

/** Avatares originales: perfiles ficticios 1–20 solamente; otros registros conservan iniciales. */
const CIRCULOS_FEMENINOS = [0,2,5,7,8,10,12,14,16,18] as const;
const CIRCULOS_MASCULINOS = [1,3,4,6,9,11,13,15,17,19] as const;
const AVATARES = CATALOGO_DEMO.map((perfil,indice) => ({
  id: perfil.id,
  indice: indice % 2 === 0 ? CIRCULOS_FEMENINOS[indice/2] : CIRCULOS_MASCULINOS[(indice-1)/2],
}));
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
  // Recorte centrado de cada retrato dentro de la hoja: la imagen original tiene márgenes
  // transparentes amplios, por eso los rostros se veían demasiado pequeños.
  const escala = hero ? 1.72 : 1.34;
  const posX = ((col * escala + (escala - 1) / 2) / (4 * escala - 1)) * 100;
  const posY = ((fila * escala + (escala - 1) / 2) / (5 * escala - 1)) * 100;
  return <span aria-hidden="true" className={clase} style={{
    backgroundSize: `${4 * escala * 100}% ${5 * escala * 100}%`,
    backgroundPosition: `${posX}% ${posY}%`,
  }} />;
}
