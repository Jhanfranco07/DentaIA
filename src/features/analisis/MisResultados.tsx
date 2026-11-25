
import PremiumHistory from "@/features/premium-vision/PremiumHistory";
import styles from "./mis-resultados.module.css";

export default function MisResultados() {
  return <section className={styles.pagina}>
    <header className={styles.encabezado}>
      <h1>Mis resultados</h1>
      <p>Consulta tus evaluaciones y administra qué resultados compartes con tu odontólogo.</p>
    </header>
    <PremiumHistory />
  </section>;
}
