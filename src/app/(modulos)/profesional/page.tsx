
"use client";

import { useState } from "react";
import Link from "next/link";

type Estado = "contenido" | "cargando" | "vacio" | "error";

const solicitudesDemo = [
  {
    id: "DEMO-001",
    paciente: "Paciente ficticio 01",
    fecha: "2026-11-04",
    estado: "Pendiente",
  },
  {
    id: "DEMO-002",
    paciente: "Paciente ficticio 02",
    fecha: "2026-11-05",
    estado: "En revisión",
  },
];

export default function ProfesionalPage() {
  const [estado, setEstado] = useState<Estado>("contenido");

  return (
    <main style={{
      maxWidth: 1100,
      margin: "0 auto",
      padding: "40px 24px",
      color: "#193447",
    }}>
      <header style={{ marginBottom: 28 }}>
        <p style={{ color: "#087f8c", fontWeight: 700 }}>
          DENTAIA / PORTAL PROFESIONAL
        </p>
        <h1 style={{ fontSize: 34, margin: "12px 0" }}>
          Panel del odontólogo
        </h1>
        <p>
          Gestión visual de solicitudes y acceso futuro a información
          clínica autorizada.
        </p>
      </header>

      <aside style={{
        background: "#e8f6f7",
        padding: 18,
        borderRadius: 12,
        marginBottom: 24,
      }}>
        <strong>Entorno de demostración</strong>
        <p>
          Los pacientes y solicitudes mostrados son ficticios.
          Esta pantalla no consulta historiales clínicos reales.
        </p>
      </aside>

      <nav aria-label="Navegación profesional" style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 30,
      }}>
        <a href="#solicitudes">Solicitudes</a>
        <a href="#historial">Historial clínico</a>
        <Link href="/">Inicio</Link>
      </nav>

      <section id="solicitudes" style={{
        background: "#fff",
        border: "1px solid #d9e5e9",
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
      }}>
        <h2>Solicitudes profesionales</h2>
        <p>Vista preliminar para validar la interfaz.</p>

        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          margin: "20px 0",
        }}>
          {(["contenido", "cargando", "vacio", "error"] as const)
            .map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => setEstado(opcion)}
                aria-pressed={estado === opcion}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #087f8c",
                  background: estado === opcion ? "#087f8c" : "#fff",
                  color: estado === opcion ? "#fff" : "#087f8c",
                  cursor: "pointer",
                }}
              >
                {opcion === "contenido" ? "Con datos" :
                 opcion === "cargando" ? "Carga" :
                 opcion === "vacio" ? "Vacío" : "Error"}
              </button>
            ))}
        </div>

        <div role="status" aria-live="polite">
          {estado === "cargando" && (
            <p>Cargando solicitudes de demostración...</p>
          )}

          {estado === "vacio" && (
            <p>No hay solicitudes para mostrar.</p>
          )}

          {estado === "error" && (
            <p role="alert">
              No se pudieron cargar las solicitudes.
              Intenta nuevamente más tarde.
            </p>
          )}

          {estado === "contenido" && (
            <div style={{ display: "grid", gap: 12 }}>
              {solicitudesDemo.map((solicitud) => (
                <article key={solicitud.id} style={{
                  border: "1px solid #d9e5e9",
                  padding: 16,
                  borderRadius: 10,
                }}>
                  <strong>{solicitud.paciente}</strong>
                  <p>Fecha: {solicitud.fecha}</p>
                  <p>Estado: {solicitud.estado}</p>
                  <small>{solicitud.id} · Dato sintético</small>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="historial" style={{
        background: "#fff",
        border: "1px solid #d9e5e9",
        borderRadius: 16,
        padding: 24,
      }}>
        <h2>Historial clínico compartido</h2>
        <p>
          Módulo pendiente de implementación en DI-156.
          El acceso requerirá autenticación, autorización
          y consentimiento verificables en el backend.
        </p>
      </section>
    </main>
  );
}
