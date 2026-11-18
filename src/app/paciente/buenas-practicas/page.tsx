import Link from "next/link";
import styles from "./buenas-practicas.module.css";

const recomendaciones = [
  { n: "01", titulo: "Cepillado cuidadoso", texto: "Cepíllate dos veces al día con una pasta dental con flúor y un cepillo de cerdas suaves. Dedica tiempo a todas las superficies sin ejercer presión excesiva." },
  { n: "02", titulo: "Limpieza entre los dientes", texto: "Limpia los espacios interdentales cada día con hilo dental u otro dispositivo apropiado para ti. Si tienes dificultades, pide orientación a tu odontólogo." },
  { n: "03", titulo: "Alimentación y hábitos", texto: "Limita la frecuencia de bebidas azucaradas y alimentos que favorecen la acumulación de placa. Evita fumar y mantén hábitos constantes de higiene." },
  { n: "04", titulo: "Revisión profesional", texto: "Si notas cambios de color, dolor, encías que sangran, dientes ausentes o apiñamiento que te preocupa, solicita una evaluación odontológica." },
];

export default function BuenasPracticasDentales() {
  return <main className={styles.page}>
    <div className={styles.container}>
      <nav className={styles.breadcrumb} aria-label="Navegación"><Link href="/panel">Mi espacio</Link><span aria-hidden="true">/</span><span>Buenas prácticas</span></nav>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>BIENESTAR BUCODENTAL</span>
        <h1>Pequeños hábitos para cuidar tu sonrisa.</h1>
        <p>Esta guía acompaña tus resultados visuales de DentaIA con recomendaciones generales de higiene dental. No sustituye una atención profesional.</p>
      </header>
      <section className={styles.grid} aria-label="Recomendaciones para el cuidado bucal">
        {recomendaciones.map(item => <article className={styles.card} key={item.n}><span className={styles.number}>{item.n}</span><h2>{item.titulo}</h2><p>{item.texto}</p></article>)}
      </section>
      <aside className={styles.note}><strong>Si el análisis marcó amarillo o una posible ausencia dental</strong><p>Una fotografía puede cambiar con la luz, los filtros o los reflejos. No permite identificar por sí sola la causa de un cambio de color ni confirmar que falte un diente. Consulta con un odontólogo antes de decidir cualquier tratamiento o blanqueamiento.</p></aside>
      <div className={styles.actions}><Link href="/panel/odontologos" className={styles.primary}>Buscar un odontólogo</Link><Link href="/panel" className={styles.secondary}>Volver a mi espacio</Link></div>
    </div>
  </main>;
}
