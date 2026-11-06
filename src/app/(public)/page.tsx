"use client";

import { useState } from "react";
import HeroCarousel from "@/components/HeroCarousel";

type Vista =
  | "inicio"
  | "odontologos"
  | "como"
  | "privacidad";

const doctores = [
  {
    id: "a",
    nombre: "Dra. Valeria Santos",
    especialidad: "Odontología general",
    zona: "Miraflores",
    precio: "S/ 65",
    iniciales: "VS",
    color: "#f4e7e4",
  },
  {
    id: "b",
    nombre: "Dr. Daniel Flores",
    especialidad: "Ortodoncia",
    zona: "Surco",
    precio: "S/ 80",
    iniciales: "DF",
    color: "#dde9ed",
  },
  {
    id: "c",
    nombre: "Dra. Andrea Rivera",
    especialidad: "Odontopediatría",
    zona: "San Borja",
    precio: "S/ 75",
    iniciales: "AR",
    color: "#e9e5fa",
  },
  {
    id: "d",
    nombre: "Dr. Gabriel Torres",
    especialidad: "Odontología general",
    zona: "Pachacámac",
    precio: "S/ 55",
    iniciales: "GT",
    color: "#f5efd9",
  },
];

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="pill">{children}</span>;
}

export default function Home() {
  const [vista, setVista] = useState<Vista>("inicio");
  const [search, setSearch] = useState("");
  const [zona, setZona] = useState("Todas");
  const [perfil, setPerfil] = useState<string | null>(null);

  function nav(v: Vista) {
    setVista(v);
    setPerfil(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Los enlaces del CSS (.site-nav a, .text-link, etc.) son <a>, así que
  // los usamos con href="#" y evitamos el salto de página con preventDefault.
  function go(e: React.MouseEvent<HTMLAnchorElement>, v: Vista) {
    e.preventDefault();
    nav(v);
  }

  const match = doctores.filter(
    (d) =>
      (zona === "Todas" || d.zona === zona) &&
      (d.nombre + " " + d.especialidad + " " + d.zona)
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <>
      {/* ───────────── INICIO ───────────── */}
      {vista === "inicio" && (
        <main id="contenido">
          <section className="home-hero">
            <HeroCarousel />
            <div className="home-hero-inner">
              <div className="hero-copy">
                <span className="eyebrow hero-eyebrow">
                  <span aria-hidden="true" />
                  CONOCE DENTAI
                </span>

                <h1>
                  Una forma más simple de <span>cuidar tu sonrisa.</span>
                </h1>

                <p className="hero-description">
                  Encuentra orientación, conoce profesionales y descubre
                  herramientas pensadas para ayudarte a tomar mejores
                  decisiones sobre tu salud bucal.
                </p>

                <div className="actions">
                  <button
                    className="action"
                    onClick={() => nav("como")}
                  >
                    Conocer DentAI <span aria-hidden="true">→</span>
                  </button>

                  <button
                    className="action action-secondary"
                    onClick={() => nav("odontologos")}
                  >
                    Encontrar odontólogo <span aria-hidden="true">↗</span>
                  </button>
                </div>

                <div className="hero-disclaimer">
                  <span className="disclaimer-icon" aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <strong>Tu bienestar es lo primero</strong>
                    <br />
                    Sin diagnósticos automáticos · Prototipo académico
                  </div>
                </div>
              </div>

              <button className="hero-tag" onClick={() => nav("analizar")}>
                <span className="hero-tag-title">Prueba DentAI ahora</span>
                <span className="hero-tag-text">
                  Recorre la demostración paso a paso{" "}
                  <span aria-hidden="true">→</span>
                </span>
              </button>
            </div>

            <div className="home-principles">
              <span>
                <b aria-hidden="true">◈</b> Información clara
              </span>
              <span>
                <b aria-hidden="true">⌖</b> Encuentra profesionales según tu
                ubicación
              </span>
              <span>
                <b aria-hidden="true">♡</b> Privacidad y control
              </span>
            </div>
          </section>

          <section className="home-section">
            <div className="section-heading-row">
              <div className="section-heading">
                <span className="eyebrow">DESCUBRE DENTAI</span>
                <h2>
                  Todo lo que necesitas,{" "}
                  <span className="heading-muted">más fácil.</span>
                </h2>
              </div>
              <p>
                Explora herramientas diseñadas para acompañarte en tu
                experiencia de cuidado bucal.
              </p>
            </div>

            <div className="feature-grid">
              {[
                {
                  n: "01",
                  icon: "✧",
                  title: "Obtén orientación",
                  text: "Accede a información clara y recursos pensados para ayudarte a conocer mejor tu salud bucal.",
                  link: "Cómo funciona",
                  to: "como" as Vista,
                },
                {
                  n: "02",
                  icon: "⌖",
                  title: "Encuentra profesionales",
                  text: "Explora opciones de atención y descubre profesionales disponibles según tu ubicación.",
                  link: "Ver directorio",
                  to: "odontologos" as Vista,
                },
                {
                  n: "03",
                  icon: "♡",
                  title: "Mantén el control",
                  text: "Gestiona tu experiencia y tus datos de forma sencilla, con privacidad desde el inicio.",
                  link: "Ver privacidad",
                  to: "privacidad" as Vista,
                },
              ].map((x) => (
                <article className="surface feature-card" key={x.n}>
                  <div className="feature-card-top">
                    <span className="feature-icon" aria-hidden="true">
                      {x.icon}
                    </span>
                    <span className="step-number">{x.n}</span>
                  </div>

                  <h3>{x.title}</h3>
                  <p>{x.text}</p>

                  <a
                    className="text-link"
                    href="#"
                    onClick={(e) => go(e, x.to)}
                  >
                    {x.link} <span aria-hidden="true">→</span>
                  </a>
                </article>
              ))}
            </div>
          </section>

          <section className="home-invitation">
            <div>
              <span className="eyebrow">EMPIEZA AQUÍ</span>
              <h2>
                Tu sonrisa merece
                <br />
                una atención informada.
              </h2>
              <p>Los pacientes pueden preparar una fotografía desde su dispositivo. El motor de análisis automático aún está pendiente de integración.</p>
            </div>
            <a className="action" href="/analisis">Iniciar análisis dental <span aria-hidden="true">→</span></a>
          </section>
        </main>
      )}

      {/* ───────────── ODONTÓLOGOS ───────────── */}
      {vista === "odontologos" && (
        <main id="contenido" className="module-shell">
          <div className="page-intro">
            <Pill>DIRECTORIO DE EJEMPLO</Pill>

            <h1>
              Encuentra el apoyo <span className="marca-acento">adecuado.</span>
            </h1>

            <p>
              Explora cómo se presentarán los perfiles.{" "}
              <b>Todos los odontólogos y precios son ficticios</b> y no
              permiten solicitar citas reales.
            </p>
          </div>

          <div className="filters">
            <input
              aria-label="Buscar odontólogo"
              placeholder="Buscar por nombre, especialidad o distrito…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              aria-label="Filtrar distrito"
              value={zona}
              onChange={(e) => setZona(e.target.value)}
            >
              {["Todas", ...new Set(doctores.map((x) => x.zona))].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>

          <p className="count">{match.length} profesionales de demostración</p>

          <div className="dentist-grid">
            {match.map((d) => (
              <article className="surface dentist-card" key={d.id}>
                <div
                  className="dentist-avatar"
                  style={{ background: d.color }}
                >
                  {d.iniciales}
                </div>

                <div className="dentist-detail">
                  <span className="fake-tag">PERFIL FICTICIO</span>

                  <h3>{d.nombre}</h3>

                  <p>{d.especialidad}</p>

                  <div className="dentist-meta">
                    <span>⌖ {d.zona}</span>
                    <span>Precio ilustrativo {d.precio}</span>
                  </div>

                  <button
                    className="action action-secondary action-small action-full"
                    onClick={() => setPerfil(perfil === d.id ? null : d.id)}
                  >
                    {perfil === d.id
                      ? "Cerrar información"
                      : "Ver perfil de ejemplo"}{" "}
                    →
                  </button>

                  {perfil === d.id && (
                    <div className="profile-extra">
                      <strong>Perfil de demostración</strong>

                      <p>
                        Especialidad: {d.especialidad}. Distrito: {d.zona}.
                        Este perfil no corresponde a una persona real; no es
                        posible reservar ni contactar.
                      </p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

          {match.length === 0 && (
            <div className="empty">
              No hay resultados para esa búsqueda. Prueba con otro distrito.
            </div>
          )}
        </main>
      )}

      {/* ───────────── CÓMO FUNCIONA ───────────── */}
      {vista === "como" && (
        <main id="contenido" className="module-shell">
          <div className="page-intro">
            <Pill>NUESTRO ENFOQUE</Pill>

            <h1>
              Tecnología con{" "}
              <span className="marca-acento">responsabilidad.</span>
            </h1>

            <p>
              DentAI nace como un prototipo académico de orientación
              preventiva para pacientes.
            </p>
          </div>

          <div className="info-grid">
            {[
              {
                i: "01",
                h: "Fotografía local",
                t: "Seleccionas una imagen y ves una vista previa en tu dispositivo. No se envía a un servidor.",
              },
              {
                i: "02",
                h: "Guía educativa simulada",
                t: "Mostramos un ejemplo de cómo podría verse un reporte. No hay IA conectada ni evaluación real.",
              },
              {
                i: "03",
                h: "Profesionales ficticios",
                t: "Exploras un directorio de prueba. En etapas posteriores se requerirán datos verificados y autorizados.",
              },
              {
                i: "04",
                h: "Validación futura",
                t: "La IA real requerirá datos adecuados, pruebas de precisión, privacidad y asesoría odontológica.",
              },
            ].map((a) => (
              <div className="surface panel info-card" key={a.i}>
                <span className="step-num">{a.i}</span>

                <h3>{a.h}</h3>

                <p>{a.t}</p>
              </div>
            ))}
          </div>

          <div className="center-actions">
            <a className="action" href="/analisis">Preparar una fotografía →</a>
          </div>
        </main>
      )}

      {/* ───────────── PRIVACIDAD ───────────── */}
      {vista === "privacidad" && (
        <main id="contenido" className="module-shell">
          <div className="page-intro">
            <Pill>PRIVACIDAD Y ÉTICA</Pill>

            <h1>
              Tus datos importan{" "}
              <span className="marca-acento">desde el inicio.</span>
            </h1>

            <p>
              Información sobre las limitaciones y el tratamiento de imágenes
              de esta demostración.
            </p>
          </div>

          <section className="surface panel privacy">
            <h2>¿Qué sucede con mi fotografía?</h2>

            <p>
              La imagen seleccionada se muestra únicamente en tu navegador
              mediante una URL local temporal. Este prototipo no tiene
              servidor de carga ni almacenamiento, y no procesa imágenes con
              modelos de IA.
            </p>

            <h2>¿Se genera un diagnóstico?</h2>

            <p>
              No. El informe es un ejemplo educativo igual para cualquier
              usuario y no está relacionado con la fotografía. Si tienes dolor,
              sangrado persistente o alguna preocupación de salud, consulta a
              un odontólogo.
            </p>

            <h2>¿Son reales los odontólogos?</h2>

            <p>
              No. Todos los perfiles, distritos asociados y precios son datos
              ficticios creados solo para mostrar la interfaz.
            </p>

            <h2>¿Cuál es el propósito?</h2>

            <p>
              Evaluar usabilidad, necesidades y posibilidades técnicas del
              proyecto académico de DentAI para pacientes.
            </p>
          </section>
        </main>
      )}


    </>
  );
}
