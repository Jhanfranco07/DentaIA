import Link from "next/link";
import styles from "./modules.module.css";

export default function ModulesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/">DentAI · Inicio</Link>
        <nav aria-label="Módulos de DentaIA" className={styles.nav}>
          <Link href="/cuenta">Cuenta</Link>
          <Link href="/directorio">Directorio</Link>
          <Link href="/solicitudes">Solicitudes</Link>
          <Link href="/fotografias">Fotografías</Link>
          {process.env.NODE_ENV === "development" && <Link href="/desarrollo/acceso">Acceso de prueba</Link>}
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
