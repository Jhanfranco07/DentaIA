import Image from "next/image";
import styles from "./hero-carousel.module.css";

/**
 * Decorative, non-rotating hero photograph.
 * No autoplay means a pause control is not required and avoids persistent
 * movement / needless network requests while preserving the landing visual.
 */
export default function HeroCarousel() {
  return (
    <div className={styles.carousel} aria-hidden="true">
      <Image
        src="/hero/hero-1.jpg"
        alt=""
        fill
        sizes="100vw"
        priority
        fetchPriority="high"
        quality={80}
        className={styles.photo}
      />
      <div className={styles.grade} />
      <div className={styles.scrim} />
    </div>
  );
}
