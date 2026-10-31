"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Vista =
  | "inicio"
  | "analizar"
  | "resultados"
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

const ICON = {
  tooth: "✦",
  photo: "▧",
  shield: "◈",
  location: "⌖",
  right: "→",
  star: "✧",
};

const POLICY_VERSION = "1.0";

const CONSENT_TEXT = `Acepto de forma expresa que las fotografías
sintéticas o de prueba que seleccione sean almacenadas de forma privada en Supabase dentro del prototipo académico
DentAI. La finalidad es demostrar el almacenamiento, consulta y eliminación segura de fotografías dentro del proyecto.
La fotografía se almacenará en un bucket privado y podrá ser consultada o eliminada por el propietario. No se
realizará análisis automatizado, diagnóstico clínico, entrenamiento de modelos de inteligencia artificial ni uso de
las fotografías para otros fines. Puedo revocar este consentimiento y eliminar posteriormente las fotografías
almacenadas.`;

function Logo() {
  return (
    <div className="logo">
      <span className="logo-symbol">✦</span>
      <span>
        Dent<span className="teal">AI</span>
      </span>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="pill">
      <span className="pill-dot" /> {children}
    </span>
  );
}

export default function Home() {
  const [vista, setVista] = useState<Vista>("inicio");
  const [consent, setConsent] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState("");
  const [zona, setZona] = useState("Todas");
  const [menu, setMenu] = useState(false);
  const [perfil, setPerfil] = useState<string | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);

  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (img) URL.revokeObjectURL(img);
    };
  }, [img]);

  function nav(v: Vista) {
    setVista(v);
    setMenu(false);
    setPerfil(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function load(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];

    if (!f) return;

    setErr("");
    setDone(false);

    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setErr("Solo puedes usar JPG, PNG o WebP.");
      return;
    }

    if (f.size > 8 * 1024 * 1024) {
      setErr("El archivo supera 8 MB.");
      return;
    }

    if (img) URL.revokeObjectURL(img);

    setFile(f);
    setImg(URL.createObjectURL(f));

    e.target.value = "";
  }

  function reset() {
    if (img) URL.revokeObjectURL(img);

    setImg(null);
    setFile(null);
    setDone(false);
    setErr("");
    setConsent(false);
  }

  async function handleConsent() {
    setErr("");
    setDone(false);

    if (!img || !file || !consent) {
      setErr(
        "Selecciona una imagen y confirma el consentimiento antes de continuar."
      );
      return;
    }

    setSavingConsent(true);

    try {
      const client = getSupabaseBrowserClient();

      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();

      if (userError) {
        throw new Error(
          `No se pudo obtener la sesión del usuario: ${userError.message}`
        );
      }

      if (!user) {
        throw new Error(
          "No hay una sesión iniciada. Ingresa con un usuario de prueba antes de registrar el consentimiento."
        );
      }

      const { data, error: consentError } = await client
        .from("patient_consents")
        .insert({
          user_id: user.id,
          policy_version: POLICY_VERSION,
          consent_text: CONSENT_TEXT,

          // PRUEBA CONTROLADA:
          // Se envía NULL para comprobar si el DEFAULT de purpose
          // está provocando el CHECK constraint de Supabase.
          purpose: null as unknown as string,
        })
        .select("id")
        .single();

      if (consentError) {
        throw new Error(
          `No se pudo registrar el consentimiento: ${consentError.message}`
        );
      }

      if (!data?.id) {
        throw new Error(
          "Supabase no devolvió el ID del consentimiento registrado."
        );
      }

      console.log("Consentimiento registrado:", data.id);

      setDone(true);
    } catch (error) {
      console.error("Error registrando consentimiento:", error);

      setErr(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al registrar el consentimiento."
      );
    } finally {
      setSavingConsent(false);
    }
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
      <header className="header">
        <div className="wrap nav">
          <button
            className="logo-button"
            onClick={() => nav("inicio")}
            aria-label="Ir al inicio"
          >
            <Logo />
          </button>

          <nav
            className={menu ? "navlinks show" : "navlinks"}
            aria-label="Navegación principal"
          >
            <button
              className={vista === "inicio" ? "active" : ""}
              onClick={() => nav("inicio")}
            >
              Inicio
            </button>

            <button
              className={vista === "como" ? "active" : ""}
              onClick={() => nav("como")}
            >
              Cómo funciona
            </button>

            <button
              className={vista === "odontologos" ? "active" : ""}
              onClick={() => nav("odontologos")}
            >
              Encontrar odontólogos
            </button>
          </nav>

          <div className="navend">
            <span className="nav-status">
              <span className="status-dot" /> Prototipo académico
            </span>

            <button
              className="btn btn-primary btn-small"
              onClick={() => nav("analizar")}
            >
              Probar DentAI <span>→</span>
            </button>

            <button
              className="hamb"
              onClick={() => setMenu(!menu)}
              aria-label="Abrir menú"
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      {vista === "inicio" && (
        <>
          <section className="hero">
            <div className="wrap hero-grid">
              <div className="hero-copy">
                <Pill>CONOCE DENTAI</Pill>

                <h1>
                  Una forma más simple de <span className="teal">cuidar tu sonrisa.</span>
                </h1>

                <p className="hero-sub">
                  Encuentra orientación, conoce profesionales y descubre herramientas
                  pensadas para ayudarte a tomar mejores decisiones sobre tu salud bucal.
                </p>

                <div className="hero-actions">
                  <button
                    className="btn btn-primary btn-large"
                    onClick={() => nav("analizar")}
                  >
                    Conocer DentAI <span>→</span>
                  </button>

                  <button
                    className="btn btn-outline btn-large"
                    onClick={() => nav("odontologos")}
                  >
                    Encontrar odontólogo <span>↗</span>
                  </button>
                </div>

                <div className="hero-proof">
                  <div className="proof-icon">✓</div>

                  <div>
                    <strong>Tu bienestar es lo primero</strong>
                    <small>
                      Sin diagnósticos automáticos · Prototipo académico
                    </small>
                  </div>
                </div>
              </div>

              <div className="hero-art">
                <div className="orb orb1" />
                <div className="orb orb2" />

                <div className="main-visual">
                  <div className="visual-top">
                    <span>✦</span> Una sonrisa más informada
                  </div>

                  <div className="smile-card">
                      <div className="smile-icon">✦</div>

                      <div>
                        <strong>Todo en un solo lugar</strong>
                        <small>Herramientas para cuidar tu sonrisa</small>
                      </div>
                    </div>

                    <div className="visual-divider" />

                    <div className="visual-label">Descubre lo que puedes hacer</div>

                    <div className="visual-step">
                      <span>01</span> Explora orientación <b>↗</b>
                    </div>

                    <div className="visual-step">
                      <span>02</span> Conoce profesionales <b>↗</b>
                    </div>

                    <div className="visual-step">
                      <span>03</span> Gestiona tu experiencia <b>↗</b>
                    </div>

                    <div className="visual-note">
                      Una experiencia digital pensada para ti
                    </div>
                </div>

                <div className="floating-badge">✦ &nbsp;Hecho para ti</div>
              </div>
            </div>
          </section>

          <section className="trust">
            <div className="wrap trust-grid">
              <div>
                <span className="trust-icon">◈</span>
                <strong>Información clara</strong>
                <small>Contenido pensado para ayudarte</small>
              </div>

              <div>
                <span className="trust-icon">⌖</span>
                <strong>Encuentra profesionales</strong>
                <small>Explora opciones según ubicación</small>
              </div>

              <div>
                <span className="trust-icon">♡</span>
                <strong>Privacidad y control</strong>
                <small>Tú decides cómo usar tus datos</small>
              </div>
            </div>
          </section>

          <section className="section wrap">
            <div className="section-head">
              <Pill>DESCUBRE DENTAI</Pill>
              <h2>
                Todo lo que necesitas, <span className="teal">más fácil.</span>
              </h2>
              <p>
                Explora herramientas diseñadas para acompañarte en tu experiencia
                de cuidado bucal.
              </p>
            </div>

            <div className="steps-grid">
              {[
                {
                  n: "01",
                  icon: "✧",
                  title: "Obtén orientación",
                  text: "Accede a información clara y recursos pensados para ayudarte a conocer mejor tu salud bucal.",
                },
                {
                  n: "02",
                  icon: "⌖",
                  title: "Encuentra profesionales",
                  text: "Explora opciones de atención y descubre profesionales disponibles según tu ubicación.",
                },
                {
                  n: "03",
                  icon: "♡",
                  title: "Mantén el control",
                  text: "Gestiona tu experiencia y tus datos de forma sencilla, con privacidad desde el inicio.",
                },
              ].map((x) => (
                <div className="feature" key={x.n}>
                  <div className="feature-top">
                    <div className="feature-icon">{x.icon}</div>
                    <span>{x.n}</span>
                  </div>

                  <h3>{x.title}</h3>
                  <p>{x.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="wrap cta-panel">
            <div>
              <Pill>EMPIEZA AQUÍ</Pill>

              <h2>
                Tu sonrisa merece
                <br />
                una atención informada.
              </h2>

              <p>
                Explora el recorrido de DentAI en una demostración segura y
                sencilla.
              </p>
            </div>

            <button
              className="btn btn-white btn-large"
              onClick={() => nav("analizar")}
            >
              Probar el recorrido →
            </button>
          </section>
        </>
      )}

      {vista === "analizar" && (
        <main className="page-bg">
          <div className="wrap content-pad">
            <div className="page-heading">
              <Pill>PASO 01 · FOTOGRAFÍA</Pill>

              <h1>
                Empecemos con <span className="teal">tu sonrisa.</span>
              </h1>

              <p>
                Esta demostración no utiliza IA: la imagen se muestra solo en
                tu navegador y no se guarda ni se envía.
              </p>
            </div>

            <div className="upload-grid">
              <section className="panel">
                <div className="panel-title">
                  <span className="panel-icon">▧</span>

                  <div>
                    <h2>Tu fotografía dental</h2>
                    <p>
                      Procura que los dientes estén iluminados y enfocados.
                    </p>
                  </div>
                </div>

                {!img ? (
                  <div
                    className="drop"
                    onClick={() => input.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      e.key === "Enter" && input.current?.click()
                    }
                  >
                    <div className="upload-symbol">↥</div>

                    <strong>Selecciona una fotografía</strong>

                    <span>Desde tu celular o computadora</span>

                    <button
                      className="btn btn-outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        input.current?.click();
                      }}
                    >
                      Elegir archivo
                    </button>

                    <small>JPG, PNG, WebP · Máximo 8 MB</small>
                  </div>
                ) : (
                  <div className="preview">
                    <img
                      src={img}
                      alt="Fotografía seleccionada para vista previa local"
                    />

                    <div className="preview-caption">
                      <span>{file?.name}</span>

                      <button onClick={reset}>Quitar foto ✕</button>
                    </div>
                  </div>
                )}

                <input
                  ref={input}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={load}
                  className="sr-only"
                  aria-label="Seleccionar fotografía"
                />

                <label className="check">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />

                  <span>
                    Entiendo que esta es una{" "}
                    <b>demostración educativa</b>, no un diagnóstico. La
                    fotografía permanece en este dispositivo.{" "}
                    <button
                      className="link-inline"
                      onClick={(e) => {
                        e.preventDefault();
                        nav("privacidad");
                      }}
                    >
                      Ver privacidad.
                    </button>
                  </span>
                </label>

                {err && (
                  <p className="error" role="alert">
                    {err}
                  </p>
                )}

                <button
                  className="btn btn-primary btn-full"
                  disabled={!img || !consent || savingConsent}
                  onClick={handleConsent}
                >
                  {savingConsent
                    ? "Registrando consentimiento..."
                    : "Dar consentimiento →"}
                </button>

                {done && (
                  <div className="notice success">
                    <b>¡Consentimiento registrado!</b>

                    <p>
                      El consentimiento fue registrado correctamente en
                      Supabase. La imagen todavía no se ha subido.
                    </p>

                    <button
                      className="btn btn-primary"
                      onClick={() => nav("resultados")}
                    >
                      Ver reporte de ejemplo →
                    </button>
                  </div>
                )}
              </section>

              <aside className="sidebar">
                <div className="tip-panel">
                  <h3>✧ Consejos para tu foto</h3>

                  <p>◉ Usa buena iluminación.</p>
                  <p>◉ Evita imágenes borrosas.</p>
                  <p>◉ Enfoca claramente tus dientes.</p>
                  <p>◉ No muestres a otras personas.</p>
                </div>

                <div className="tip-panel neutral">
                  <h3>◈ Información importante</h3>

                  <p>
                    Este prototipo <b>no detecta enfermedades</b> y no
                    sustituye la consulta profesional.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </main>
      )}

      {vista === "resultados" && (
        <main className="page-bg">
          <div className="wrap content-pad">
            <div className="page-heading">
              <Pill>INFORME DEMOSTRATIVO</Pill>

              <h1>
                Conocer es el <span className="teal">primer paso.</span>
              </h1>

              <p>
                Así podría presentarse una guía educativa.{" "}
                <b>
                  No se ha procesado tu fotografía ni generado un diagnóstico.
                </b>
              </p>
            </div>

            <div className="result-banner">
              <span>ⓘ</span>

              <div>
                <strong>Reporte de demostración — datos ficticios</strong>

                <p>
                  Los ejemplos siguientes son información general. No indican
                  que tengas alguna condición.
                </p>
              </div>
            </div>

            <div className="result-grid">
              {[
                {
                  icon: "♡",
                  title: "Hábitos de higiene",
                  body: "Una rutina consistente de cepillado e higiene interdental contribuye al cuidado de la boca.",
                },
                {
                  icon: "✧",
                  title: "Observación preventiva",
                  body: "Si notas molestias, cambios o dolor, un odontólogo es quien debe realizar la evaluación.",
                },
                {
                  icon: "⌖",
                  title: "Tu siguiente paso",
                  body: "Puedes comparar opciones de atención y buscar orientación profesional cuando la necesites.",
                },
              ].map((v) => (
                <article className="panel result-card" key={v.title}>
                  <span className="result-icon">{v.icon}</span>
                  <h3>{v.title}</h3>
                  <p>{v.body}</p>
                </article>
              ))}
            </div>

            <div className="result-actions">
              <button
                className="btn btn-primary btn-large"
                onClick={() => nav("odontologos")}
              >
                Encontrar odontólogos →
              </button>

              <button
                className="btn btn-outline btn-large"
                onClick={() => {
                  reset();
                  nav("analizar");
                }}
              >
                Iniciar otra demostración
              </button>
            </div>
          </div>
        </main>
      )}

      {vista === "odontologos" && (
        <main className="page-bg">
          <div className="wrap content-pad">
            <div className="page-heading">
              <Pill>DIRECTORIO DE EJEMPLO</Pill>

              <h1>
                Encuentra el apoyo <span className="teal">adecuado.</span>
              </h1>

              <p>
                Explora cómo se presentarán los perfiles.{" "}
                <b>
                  Todos los odontólogos y precios son ficticios
                </b>{" "}
                y no permiten solicitar citas reales.
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
                {["Todas", ...new Set(doctores.map((x) => x.zona))].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  )
                )}
              </select>
            </div>

            <p className="count">
              {match.length} profesionales de demostración
            </p>

            <div className="dentist-grid">
              {match.map((d) => (
                <article className="dentist-card" key={d.id}>
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
                      className="btn btn-outline btn-full"
                      onClick={() =>
                        setPerfil(perfil === d.id ? null : d.id)
                      }
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
          </div>
        </main>
      )}

      {vista === "como" && (
        <main className="page-bg">
          <div className="wrap content-pad">
            <div className="page-heading">
              <Pill>NUESTRO ENFOQUE</Pill>

              <h1>
                Tecnología con <span className="teal">responsabilidad.</span>
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
                <div className="panel info-card" key={a.i}>
                  <span className="step-num">{a.i}</span>

                  <h3>{a.h}</h3>

                  <p>{a.t}</p>
                </div>
              ))}
            </div>

            <div className="center-actions">
              <button
                className="btn btn-primary btn-large"
                onClick={() => nav("analizar")}
              >
                Probar el recorrido →
              </button>
            </div>
          </div>
        </main>
      )}

      {vista === "privacidad" && (
        <main className="page-bg">
          <div className="wrap content-pad">
            <div className="page-heading">
              <Pill>PRIVACIDAD Y ÉTICA</Pill>

              <h1>
                Tus datos importan{" "}
                <span className="teal">desde el inicio.</span>
              </h1>

              <p>
                Información sobre las limitaciones y el tratamiento de imágenes
                de esta demostración.
              </p>
            </div>

            <section className="panel privacy">
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
                usuario y no está relacionado con la fotografía. Si tienes
                dolor, sangrado persistente o alguna preocupación de salud,
                consulta a un odontólogo.
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
          </div>
        </main>
      )}

      <footer className="footer">
        <div className="wrap footgrid">
          <div>
            <Logo />

            <p>
              Una nueva forma de explorar la orientación preventiva bucal.
            </p>
          </div>

          <div>
            <strong>EXPLORAR</strong>

            <button onClick={() => nav("como")}>Cómo funciona</button>

            <button onClick={() => nav("odontologos")}>
              Odontólogos
            </button>

            <button onClick={() => nav("privacidad")}>
              Privacidad
            </button>
          </div>

          <div>
            <strong>INFORMACIÓN</strong>

            <p>Proyecto Final de Carrera III</p>
            <p>Prototipo académico · 2026</p>
          </div>
        </div>

        <div className="wrap footer-bottom">
          © DentAI · Demostración académica. No es un dispositivo médico ni
          ofrece diagnóstico.
        </div>
      </footer>
    </>
  );
}