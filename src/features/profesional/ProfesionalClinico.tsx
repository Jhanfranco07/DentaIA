"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSesion } from "@/features/cuenta/useSesion";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import {
  type ContextoClinico,
  clasificarErrorPaginacionContextos,
  coincideProfesional,
  crearClienteApiClinica,
  ErrorApiClinica,
  esSolicitudAbortada,
  paginaSolicitudesCompatible,
  type PacienteAutorizadoClinico,
  type PerfilProfesionalClinico,
  type SolicitudProfesionalClinica,
} from "./api-clinica";
import {
  crearControlConsultasClinicas,
  finalizarPaginacionRestringida,
} from "./control-consultas-clinicas";
import {
  crearControlRevalidacionHistorial,
  estadoRevalidacionHistorial,
} from "./control-revalidacion-historial";
import EstadoHistorialClinico, {
  type VistaHistorialClinico,
} from "./EstadoHistorialClinico";
import styles from "./profesional.module.css";
import { Icono } from "@/components/Identidad";

const INTERVALO_REVALIDACION_HISTORIAL_MS = 60_000;

type EstadoRecurso =
  | "inactivo"
  | "cargando"
  | "listo"
  | "vacio"
  | "denegado"
  | "error";

interface EstadoPerfil {
  estado: EstadoRecurso;
  perfil: PerfilProfesionalClinico | null;
  nextAfterId: string | null;
  cargandoMas: boolean;
  mensaje: string;
}

interface EstadoLista<T> {
  estado: EstadoRecurso;
  items: T[];
  nextAfterId: string | null;
  cargandoMas: boolean;
  mensaje: string;
}

interface EstadoHistorial {
  vista: VistaHistorialClinico;
  cargandoMas: boolean;
}

const perfilInactivo = (): EstadoPerfil => ({
  estado: "inactivo",
  perfil: null,
  nextAfterId: null,
  cargandoMas: false,
  mensaje: "",
});

function listaInactiva<T>(): EstadoLista<T> {
  return {
    estado: "inactivo",
    items: [],
    nextAfterId: null,
    cargandoMas: false,
    mensaje: "",
  };
}

const historialInactivo = (): EstadoHistorial => ({
  vista: { estado: "inactivo", historial: null },
  cargandoMas: false,
});

function unirPorClave<T>(
  anteriores: T[],
  nuevas: T[],
  obtenerClave: (item: T) => string,
): T[] {
  const vistos = new Set<string>();
  return [...anteriores, ...nuevas].filter((item) => {
    const clave = obtenerClave(item);
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

function mensajeSeguro(error: unknown): string {
  if (!(error instanceof ErrorApiClinica)) {
    return "El servicio no está disponible. Inténtalo nuevamente más tarde.";
  }
  if (error.status === 404) {
    return "El servicio clínico no está habilitado en este entorno.";
  }
  if (error.status === 403) {
    return "No tienes acceso a este recurso en el contexto seleccionado.";
  }
  if (error.status === 401) {
    return "Tu sesión ya no es válida. Inicia sesión nuevamente.";
  }
  if (error.code === "INVALID_RESPONSE") {
    return "El servicio respondió con un formato no compatible.";
  }
  return "No se pudo completar la consulta clínica.";
}

export default function ProfesionalClinico() {
  const { usuario, cargando: cargandoSesion, errorSesion, verificar } = useSesion();
  const control = useRef(crearControlConsultasClinicas());
  const controlRevalidacion = useRef(crearControlRevalidacionHistorial());
  const contextoActual = useRef("");
  const pacienteActual = useRef("");
  const [reintentoSesion, setReintentoSesion] = useState(0);
  const [revisionHistorial, setRevisionHistorial] = useState(0);
  const [avisoHistorial, setAvisoHistorial] = useState("");
  const [sesionRemotaExpirada, setSesionRemotaExpirada] = useState(false);
  const [mensajeContexto, setMensajeContexto] = useState("");
  const [perfil, setPerfil] = useState<EstadoPerfil>(perfilInactivo);
  const [solicitudes, setSolicitudes] = useState<
    EstadoLista<SolicitudProfesionalClinica>
  >(listaInactiva);
  const [pacientes, setPacientes] = useState<
    EstadoLista<PacienteAutorizadoClinico>
  >(listaInactiva);
  const [contextoId, setContextoId] = useState("");
  const [pacienteId, setPacienteId] = useState("");
  const [historial, setHistorial] = useState<EstadoHistorial>(historialInactivo);

  const api = useMemo(
    () =>
      crearClienteApiClinica({
        async obtenerAccessToken() {
          const { data, error } = await getSupabaseBrowserClient().auth.getSession();
          if (error) throw error;
          return data.session?.access_token ?? null;
        },
      }),
    [],
  );

  const limpiarDatosPrivados = useCallback(() => {
    control.current.invalidarTodo();
    controlRevalidacion.current.invalidar();
    contextoActual.current = "";
    pacienteActual.current = "";
    setContextoId("");
    setPacienteId("");
    setPerfil(perfilInactivo());
    setSolicitudes(listaInactiva());
    setPacientes(listaInactiva());
    setHistorial(historialInactivo());
    setAvisoHistorial("");
  }, []);

  const expirarSesion = useCallback(() => {
    limpiarDatosPrivados();
    setSesionRemotaExpirada(true);
  }, [limpiarDatosPrivados]);

  const restringirContexto = useCallback((mensaje: string) => {
    control.current.invalidarTodo();
    controlRevalidacion.current.invalidar();
    pacienteActual.current = "";
    contextoActual.current = "";
    setPacienteId("");
    setContextoId("");
    setSolicitudes(listaInactiva());
    setPacientes(listaInactiva());
    setHistorial(historialInactivo());
    setPerfil((actual) => finalizarPaginacionRestringida(actual));
    setAvisoHistorial("");
    setMensajeContexto(mensaje);
  }, []);

  const iniciarRevalidacionHistorial = useCallback((revision: number) => {
    if (!contextoActual.current || !pacienteActual.current) return;
    control.current.cancelar("historial");
    setHistorial(estadoRevalidacionHistorial());
    setAvisoHistorial("");
    setRevisionHistorial(revision);
  }, []);

  const revalidarHistorial = useCallback(() => {
    if (!contextoActual.current || !pacienteActual.current) return;
    const revision = controlRevalidacion.current.solicitar();
    if (revision !== null) iniciarRevalidacionHistorial(revision);
  }, [iniciarRevalidacionHistorial]);

  useEffect(() => {
    if (cargandoSesion) return;

    limpiarDatosPrivados();
    setMensajeContexto("");
    if (!usuario) return;

    setSesionRemotaExpirada(false);
    setPerfil({
      estado: "cargando",
      perfil: null,
      nextAfterId: null,
      cargandoMas: false,
      mensaje: "",
    });
    const consulta = control.current.iniciar("perfil");

    void api
      .obtenerPerfil({}, consulta.signal)
      .then((pagina) => {
        if (!consulta.vigente()) return;
        const primerContexto = pagina.data.contexts[0]?.membershipId ?? "";
        contextoActual.current = primerContexto;
        setContextoId(primerContexto);
        setPerfil({
          estado: pagina.data.contexts.length ? "listo" : "vacio",
          perfil: pagina.data,
          nextAfterId: pagina.nextAfterId,
          cargandoMas: false,
          mensaje: "",
        });
      })
      .catch((error: unknown) => {
        if (!consulta.vigente() || esSolicitudAbortada(error)) return;
        if (error instanceof ErrorApiClinica && error.status === 401) {
          expirarSesion();
          return;
        }
        setPerfil({
          estado:
            error instanceof ErrorApiClinica && error.status === 403
              ? "denegado"
              : "error",
          perfil: null,
          nextAfterId: null,
          cargandoMas: false,
          mensaje: mensajeSeguro(error),
        });
      })
      .finally(consulta.finalizar);

    return () => control.current.cancelar("perfil");
  }, [api, cargandoSesion, expirarSesion, limpiarDatosPrivados, reintentoSesion, usuario?.id]);

  useEffect(() => {
    if (!usuario || sesionRemotaExpirada || !contextoId) return;
    const professionalId = perfil.perfil?.professionalId;
    if (!professionalId) {
      restringirContexto("No se pudo verificar el contexto profesional seleccionado.");
      return;
    }

    pacienteActual.current = "";
    setPacienteId("");
    setMensajeContexto("");
    setHistorial(historialInactivo());
    setAvisoHistorial("");
    setSolicitudes({
      estado: "cargando",
      items: [],
      nextAfterId: null,
      cargandoMas: false,
      mensaje: "",
    });
    setPacientes({
      estado: "cargando",
      items: [],
      nextAfterId: null,
      cargandoMas: false,
      mensaje: "",
    });

    const solicitudesConsulta = control.current.iniciar("solicitudes");
    const pacientesConsulta = control.current.iniciar("pacientes");

    void api
      .obtenerSolicitudes(contextoId, {}, solicitudesConsulta.signal)
      .then((pagina) => {
        if (!solicitudesConsulta.vigente() || contextoActual.current !== contextoId) return;
        if (
          !paginaSolicitudesCompatible(
            pagina.data,
            contextoId,
            professionalId,
          )
        ) {
          restringirContexto("El servicio respondió con un contexto no compatible.");
          return;
        }
        setSolicitudes({
          estado: pagina.data.items.length ? "listo" : "vacio",
          items: pagina.data.items,
          nextAfterId: pagina.nextAfterId,
          cargandoMas: false,
          mensaje: "",
        });
      })
      .catch((error: unknown) => {
        if (!solicitudesConsulta.vigente() || esSolicitudAbortada(error)) return;
        if (error instanceof ErrorApiClinica && error.status === 401) {
          expirarSesion();
          return;
        }
        if (error instanceof ErrorApiClinica && error.status === 403) {
          restringirContexto(mensajeSeguro(error));
          return;
        }
        setSolicitudes({
          ...listaInactiva(),
          estado: "error",
          mensaje: mensajeSeguro(error),
        });
      })
      .finally(solicitudesConsulta.finalizar);

    void api
      .obtenerPacientes(contextoId, {}, pacientesConsulta.signal)
      .then((pagina) => {
        if (!pacientesConsulta.vigente() || contextoActual.current !== contextoId) return;
        if (pagina.data.membershipId !== contextoId) {
          restringirContexto("El servicio respondió con un contexto no compatible.");
          return;
        }
        setPacientes({
          estado: pagina.data.items.length ? "listo" : "vacio",
          items: pagina.data.items,
          nextAfterId: pagina.nextAfterId,
          cargandoMas: false,
          mensaje: "",
        });
      })
      .catch((error: unknown) => {
        if (!pacientesConsulta.vigente() || esSolicitudAbortada(error)) return;
        if (error instanceof ErrorApiClinica && error.status === 401) {
          expirarSesion();
          return;
        }
        if (error instanceof ErrorApiClinica && error.status === 403) {
          restringirContexto(mensajeSeguro(error));
          return;
        }
        setPacientes({
          ...listaInactiva(),
          estado: "error",
          mensaje: mensajeSeguro(error),
        });
      })
      .finally(pacientesConsulta.finalizar);

    return () => {
      control.current.cancelar("solicitudes");
      control.current.cancelar("pacientes");
    };
  }, [
    api,
    contextoId,
    expirarSesion,
    perfil.perfil?.professionalId,
    restringirContexto,
    sesionRemotaExpirada,
    usuario?.id,
  ]);

  useEffect(() => {
    if (!usuario || sesionRemotaExpirada || !contextoId || !pacienteId) {
      return;
    }

    const contexto = perfil.perfil?.contexts.find(
      (item) => item.membershipId === contextoId,
    );
    if (!contexto) return;
    const revalidacion = controlRevalidacion.current.activa(revisionHistorial)
      ? revisionHistorial
      : null;

    setHistorial({
      vista: { estado: "cargando", historial: null },
      cargandoMas: false,
    });
    const consulta = control.current.iniciar("historial");

    void api
      .obtenerHistorial(pacienteId, contextoId, {}, consulta.signal)
      .then((respuesta) => {
        if (
          !consulta.vigente() ||
          contextoActual.current !== contextoId ||
          pacienteActual.current !== pacienteId
        ) {
          return;
        }
        if (
          respuesta.caso.patientId !== pacienteId ||
          respuesta.caso.clinicContext !== contexto.clinicId ||
          respuesta.caso.professionalContext !== perfil.perfil?.professionalId
        ) {
          restringirContexto("El servicio respondió con un contexto no compatible.");
          return;
        }
        setHistorial({
          vista: {
            estado: respuesta.estado === "sin_datos" ? "vacio" : "listo",
            historial: respuesta,
          },
          cargandoMas: false,
        });
        setAvisoHistorial(
          revalidacion === null
            ? ""
            : "La cronología se actualizó; se reinició la paginación desde la primera página.",
        );
      })
      .catch((error: unknown) => {
        if (!consulta.vigente() || esSolicitudAbortada(error)) return;
        if (error instanceof ErrorApiClinica && error.status === 401) {
          expirarSesion();
          return;
        }
        if (error instanceof ErrorApiClinica && error.status === 403) {
          controlRevalidacion.current.invalidar();
          pacienteActual.current = "";
          setPacienteId("");
          setPacientes((actual) => ({
            ...actual,
            items: actual.items.filter((item) => item.patientId !== pacienteId),
          }));
          setHistorial({
            vista: { estado: "denegado", historial: null, mensaje: mensajeSeguro(error) },
            cargandoMas: false,
          });
          return;
        }
        setAvisoHistorial("");
        setHistorial({
          vista: { estado: "error", historial: null, mensaje: mensajeSeguro(error) },
          cargandoMas: false,
        });
      })
      .finally(() => {
        consulta.finalizar();
        if (revalidacion === null) return;
        const siguiente = controlRevalidacion.current.finalizar(revalidacion);
        if (siguiente !== null) iniciarRevalidacionHistorial(siguiente);
      });

    return () => control.current.cancelar("historial");
  }, [
    api,
    contextoId,
    expirarSesion,
    iniciarRevalidacionHistorial,
    pacienteId,
    perfil.perfil?.contexts,
    restringirContexto,
    revisionHistorial,
    sesionRemotaExpirada,
    usuario?.id,
  ]);

  useEffect(() => {
    if (
      historial.vista.estado !== "listo" ||
      !historial.vista.historial ||
      !contextoActual.current ||
      !pacienteActual.current
    ) {
      return;
    }

    const revalidarSiEsVisible = () => {
      if (document.visibilityState === "visible") revalidarHistorial();
    };
    window.addEventListener("focus", revalidarSiEsVisible);
    document.addEventListener("visibilitychange", revalidarSiEsVisible);
    const intervalo = window.setInterval(
      revalidarSiEsVisible,
      INTERVALO_REVALIDACION_HISTORIAL_MS,
    );

    return () => {
      window.removeEventListener("focus", revalidarSiEsVisible);
      document.removeEventListener("visibilitychange", revalidarSiEsVisible);
      window.clearInterval(intervalo);
    };
  }, [historial.vista, revalidarHistorial]);

  function cambiarContexto(nuevoContextoId: string) {
    control.current.invalidarTodo();
    contextoActual.current = nuevoContextoId;
    pacienteActual.current = "";
    setMensajeContexto("");
    setContextoId(nuevoContextoId);
    setPacienteId("");
    setSolicitudes(listaInactiva());
    setPacientes(listaInactiva());
    setHistorial(historialInactivo());
    setAvisoHistorial("");
    controlRevalidacion.current.invalidar();
  }

  function cambiarPaciente(nuevoPacienteId: string) {
    control.current.cancelar("historial");
    controlRevalidacion.current.invalidar();
    pacienteActual.current = nuevoPacienteId;
    setPacienteId(nuevoPacienteId);
    setHistorial(historialInactivo());
    setAvisoHistorial("");
  }

  async function cargarMasContextos() {
    const professionalId = perfil.perfil?.professionalId;
    if (!perfil.nextAfterId || perfil.cargandoMas || !usuario || !professionalId) return;
    const consulta = control.current.iniciar("perfil");
    setPerfil((actual) => ({ ...actual, cargandoMas: true }));
    try {
      const pagina = await api.obtenerPerfil(
        { afterId: perfil.nextAfterId },
        consulta.signal,
      );
      if (!consulta.vigente()) return;
      if (!coincideProfesional(professionalId, pagina.data.professionalId)) {
        restringirContexto("El servicio respondió con un profesional no compatible.");
        setPerfil({
          ...perfilInactivo(),
          estado: "error",
          mensaje: "El servicio respondió con un profesional no compatible.",
        });
        return;
      }
      setPerfil((actual) => {
        if (!actual.perfil) return actual;
        return {
          ...actual,
          estado: "listo",
          perfil: {
            ...actual.perfil,
            contexts: unirPorClave(
              actual.perfil.contexts,
              pagina.data.contexts,
              (contexto) => contexto.membershipId,
            ),
          },
          nextAfterId: pagina.nextAfterId,
          cargandoMas: false,
          mensaje: "",
        };
      });
    } catch (error) {
      if (!consulta.vigente() || esSolicitudAbortada(error)) return;
      const accion = clasificarErrorPaginacionContextos(error);
      if (accion === "expirar-sesion") {
        expirarSesion();
      } else if (accion === "restringir-contexto") {
        restringirContexto(mensajeSeguro(error));
      } else {
        setPerfil((actual) => ({
          ...actual,
          cargandoMas: false,
          mensaje: mensajeSeguro(error),
        }));
      }
    } finally {
      consulta.finalizar();
    }
  }

  async function cargarMasSolicitudes() {
    const professionalId = perfil.perfil?.professionalId;
    if (
      !solicitudes.nextAfterId ||
      solicitudes.cargandoMas ||
      !contextoId ||
      !professionalId
    ) {
      return;
    }
    const consulta = control.current.iniciar("solicitudes");
    setSolicitudes((actual) => ({ ...actual, cargandoMas: true }));
    try {
      const pagina = await api.obtenerSolicitudes(
        contextoId,
        { afterId: solicitudes.nextAfterId },
        consulta.signal,
      );
      if (!consulta.vigente() || contextoActual.current !== contextoId) return;
      if (
        !paginaSolicitudesCompatible(
          pagina.data,
          contextoId,
          professionalId,
        )
      ) {
        restringirContexto("El servicio respondió con un contexto no compatible.");
        return;
      }
      setSolicitudes((actual) => ({
        ...actual,
        estado: "listo",
        items: unirPorClave(actual.items, pagina.data.items, (item) => item.id),
        nextAfterId: pagina.nextAfterId,
        cargandoMas: false,
        mensaje: "",
      }));
    } catch (error) {
      if (!consulta.vigente() || esSolicitudAbortada(error)) return;
      if (error instanceof ErrorApiClinica && error.status === 401) {
        expirarSesion();
      } else if (error instanceof ErrorApiClinica && error.status === 403) {
        restringirContexto(mensajeSeguro(error));
      } else {
        setSolicitudes((actual) => ({ ...actual, cargandoMas: false, mensaje: mensajeSeguro(error) }));
      }
    } finally {
      consulta.finalizar();
    }
  }

  async function cargarMasPacientes() {
    if (!pacientes.nextAfterId || pacientes.cargandoMas || !contextoId) return;
    const consulta = control.current.iniciar("pacientes");
    setPacientes((actual) => ({ ...actual, cargandoMas: true }));
    try {
      const pagina = await api.obtenerPacientes(
        contextoId,
        { afterId: pacientes.nextAfterId },
        consulta.signal,
      );
      if (!consulta.vigente() || contextoActual.current !== contextoId) return;
      if (pagina.data.membershipId !== contextoId) {
        restringirContexto("El servicio respondió con un contexto no compatible.");
        return;
      }
      setPacientes((actual) => ({
        ...actual,
        estado: "listo",
        items: unirPorClave(
          actual.items,
          pagina.data.items,
          (item) => item.patientId,
        ),
        nextAfterId: pagina.nextAfterId,
        cargandoMas: false,
        mensaje: "",
      }));
    } catch (error) {
      if (!consulta.vigente() || esSolicitudAbortada(error)) return;
      if (error instanceof ErrorApiClinica && error.status === 401) {
        expirarSesion();
      } else if (error instanceof ErrorApiClinica && error.status === 403) {
        restringirContexto(mensajeSeguro(error));
      } else {
        setPacientes((actual) => ({ ...actual, cargandoMas: false, mensaje: mensajeSeguro(error) }));
      }
    } finally {
      consulta.finalizar();
    }
  }

  async function cargarMasHistorial() {
    const respuestaActual = historial.vista.historial;
    if (
      !respuestaActual?.nextCursor ||
      historial.cargandoMas ||
      !contextoId ||
      !pacienteId
    ) {
      return;
    }
    const contexto = perfil.perfil?.contexts.find(
      (item) => item.membershipId === contextoId,
    );
    if (!contexto) return;

    const consulta = control.current.iniciar("historial");
    setHistorial((actual) => ({ ...actual, cargandoMas: true }));
    try {
      const pagina = await api.obtenerHistorial(
        pacienteId,
        contextoId,
        { cursor: respuestaActual.nextCursor },
        consulta.signal,
      );
      if (
        !consulta.vigente() ||
        contextoActual.current !== contextoId ||
        pacienteActual.current !== pacienteId
      ) {
        return;
      }
      if (
        pagina.caso.patientId !== pacienteId ||
        pagina.caso.clinicContext !== contexto.clinicId ||
        pagina.caso.professionalContext !== perfil.perfil?.professionalId
      ) {
        restringirContexto("El servicio respondió con un contexto no compatible.");
        return;
      }
      setHistorial((actual) => {
        const anterior = actual.vista.historial;
        if (!anterior) return actual;
        const entries = unirPorClave(
          anterior.entries,
          pagina.entries,
          (entry) => entry.encounterId,
        );
        return {
          vista: {
            estado: entries.length ? "listo" : "vacio",
            historial: { ...pagina, entries },
          },
          cargandoMas: false,
        };
      });
    } catch (error) {
      if (!consulta.vigente() || esSolicitudAbortada(error)) return;
      if (error instanceof ErrorApiClinica && error.status === 401) {
        expirarSesion();
      } else if (error instanceof ErrorApiClinica && error.status === 403) {
        pacienteActual.current = "";
        setPacienteId("");
    controlRevalidacion.current.invalidar();
    setAvisoHistorial("");
        setPacientes((actual) => ({
          ...actual,
          items: actual.items.filter((item) => item.patientId !== pacienteId),
        }));
        setHistorial({
          vista: { estado: "denegado", historial: null, mensaje: mensajeSeguro(error) },
          cargandoMas: false,
        });
      } else {
        setHistorial((actual) => {
          if (!actual.vista.historial) {
            return { ...actual, cargandoMas: false };
          }
          return {
            vista: {
              ...actual.vista,
              mensaje: mensajeSeguro(error),
            },
            cargandoMas: false,
          };
        });
      }
    } finally {
      consulta.finalizar();
    }
  }

  const contextos = perfil.perfil?.contexts ?? [];
  const sesionNoDisponible = !cargandoSesion && (!usuario || sesionRemotaExpirada);

  return (
    <section className={styles.pagina} aria-labelledby="titulo-profesional">
      <header className={styles.encabezado}>
        <p className={styles.etiquetaSuperior}>DENTAIA / PORTAL PROFESIONAL</p>
        <h1 id="titulo-profesional">Panel del odontólogo</h1>
        <p>
          Consulta solicitudes, pacientes autorizados e historial clínico mediante
          servicios protegidos del entorno clínico.
        </p>
      </header>

      <aside className={styles.avisoClinico} aria-label="Protección de datos clínicos">
        <span className={styles.iconoProteccion}><Icono nombre="escudo" size={19} /></span>
        <div><strong>Consulta clínica protegida</strong>
          <p>El servidor valida sesión, rol, membresía y consentimiento vigente antes de entregar historial.</p>
        </div>
      </aside>

      {cargandoSesion && (
        <div className={styles.estadoCarga} role="status" aria-live="polite">
          Verificando sesión profesional…
        </div>
      )}

      {sesionNoDisponible && (
        <div className={styles.estadoDenegado} role="alert">
          <strong>Inicia sesión para acceder al portal profesional.</strong>
          <p>{errorSesion || "No se muestran datos clínicos sin una sesión válida."}</p>
          <div className={styles.accionesEstado}>
            <Link href="/cuenta" className="text-link">Ir a Mi cuenta</Link>
            {sesionRemotaExpirada && (
              <button
                type="button"
                className={styles.botonSecundario}
                onClick={() => {
                  setReintentoSesion((actual) => actual + 1);
                  void verificar();
                }}
              >
                Revalidar sesión
              </button>
            )}
          </div>
        </div>
      )}

      {!cargandoSesion && usuario && !sesionRemotaExpirada && (
        <>
          <section id="contexto-clinico" className={styles.tarjeta} aria-labelledby="titulo-contexto">
            <header className={styles.cabeceraSeccion}>
              <p className={styles.etiquetaSeccion}>CONTEXTO VERIFICADO</p>
              <h2 id="titulo-contexto">Clínica de trabajo</h2>
              <p>Selecciona una membresía activa devuelta por el servidor.</p>
            </header>

            {perfil.perfil?.dentistId
              ? <p className={styles.ayudaResultado}>Vista pública del perfil: <Link href={`/directorio/${encodeURIComponent(perfil.perfil.dentistId)}`}>ver cómo aparece en el directorio</Link>. Los datos solo se pueden modificar mediante el flujo autorizado del profesional.</p>
              : perfil.estado === "listo" && <p className={styles.estadoVacio}>Esta cuenta todavía no tiene un perfil público de odontólogo vinculado.</p>}

            {perfil.estado === "cargando" && <div className={styles.estadoCarga} role="status">Cargando membresías clínicas…</div>}
            {perfil.estado === "denegado" && <div className={styles.estadoDenegado} role="alert">{perfil.mensaje}</div>}
            {perfil.estado === "error" && <div className={styles.estadoError} role="alert">{perfil.mensaje}</div>}
            {perfil.estado === "vacio" && <div className={styles.estadoVacio} role="status">No tienes membresías clínicas activas disponibles.</div>}

            {perfil.estado === "listo" && (
              <div className={styles.controles}>
                <div className={styles.campo}>
                  <label htmlFor="clinica-contexto-real">Clínica de contexto</label>
                  <select
                    id="clinica-contexto-real"
                    value={contextoId}
                    onChange={(event) => cambiarContexto(event.target.value)}
                  >
                    {contextos.map((contexto: ContextoClinico) => (
                      <option key={contexto.membershipId} value={contexto.membershipId}>
                        {contexto.clinicName}
                      </option>
                    ))}
                  </select>
                </div>
                <p className={styles.ayudaResultado}>
                  El cambio de clínica cancela consultas en curso y elimina los
                  datos clínicos mostrados anteriormente.
                </p>
              </div>
            )}

            {perfil.nextAfterId && (
              <button type="button" className={styles.botonSecundario} onClick={() => void cargarMasContextos()} disabled={perfil.cargandoMas}>
                {perfil.cargandoMas ? "Cargando clínicas…" : "Cargar más clínicas"}
              </button>
            )}
            {perfil.perfil && perfil.estado !== "error" && perfil.estado !== "denegado" && (
              <AvisoPaginacion
                mensaje={perfil.mensaje}
                etiqueta="clínicas"
                cargando={perfil.cargandoMas}
                onReintentar={() => void cargarMasContextos()}
              />
            )}
          </section>

          {mensajeContexto && <div className={styles.estadoDenegado} role="alert">{mensajeContexto}</div>}

          <section id="solicitudes-profesionales" className={styles.tarjeta} aria-labelledby="titulo-solicitudes-profesionales">
            <header className={styles.cabeceraSeccion}>
              <p className={styles.etiquetaSeccion}>SOLICITUDES ASIGNADAS</p>
              <h2 id="titulo-solicitudes-profesionales">Solicitudes de demostración</h2>
              <p>La respuesta profesional no incluye datos de contacto ni mensajes del paciente.</p>
            </header>
            <ListaSolicitudes estado={solicitudes} onMore={() => void cargarMasSolicitudes()} />
          </section>

          <section id="historial-clinico" className={styles.tarjeta} aria-labelledby="titulo-historial-real">
            <header className={styles.cabeceraSeccion}>
              <p className={styles.etiquetaSeccion}>HISTORIAL COMPARTIDO</p>
              <h2 id="titulo-historial-real">Pacientes autorizados</h2>
              <p>Solo aparecen pacientes con autorización vigente para la clínica seleccionada.</p>
            </header>

            <div className={styles.controles}>
              <div className={styles.campo}>
                <label htmlFor="paciente-autorizado">Paciente autorizado</label>
                <select
                  id="paciente-autorizado"
                  value={pacienteId}
                  disabled={pacientes.estado !== "listo"}
                  onChange={(event) => cambiarPaciente(event.target.value)}
                >
                  <option value="">
                    {pacientes.estado === "cargando" ? "Cargando pacientes…" : "Selecciona un paciente"}
                  </option>
                  {pacientes.items.map((paciente, indice) => (
                    <option key={paciente.patientId} value={paciente.patientId}>
                      Paciente autorizado {indice + 1}
                    </option>
                  ))}
                </select>
              </div>
              <p className={styles.ayudaResultado}>
                Cambiar de paciente elimina inmediatamente el historial anterior.
              </p>
            </div>

            {pacientes.estado === "vacio" && <div className={styles.estadoVacio} role="status">No hay pacientes autorizados en este contexto.</div>}
            {pacientes.estado === "denegado" && <div className={styles.estadoDenegado} role="alert">{pacientes.mensaje}</div>}
            {pacientes.estado === "error" && <div className={styles.estadoError} role="alert">{pacientes.mensaje}</div>}
            {pacientes.nextAfterId && (
              <button type="button" className={styles.botonSecundario} onClick={() => void cargarMasPacientes()} disabled={pacientes.cargandoMas}>
                {pacientes.cargandoMas ? "Cargando pacientes…" : "Cargar más pacientes"}
              </button>
            )}
            {pacientes.estado !== "error" && pacientes.estado !== "denegado" && (
              <AvisoPaginacion
                mensaje={pacientes.mensaje}
                etiqueta="pacientes"
                cargando={pacientes.cargandoMas}
                onReintentar={() => void cargarMasPacientes()}
              />
            )}

            <EstadoHistorialClinico vista={historial.vista} />
            {avisoHistorial && (
              <div className={styles.estadoVacio} role="status" aria-live="polite">
                {avisoHistorial}
              </div>
            )}
            {historial.vista.historial?.nextCursor && (
              <button type="button" className={styles.botonSecundario} onClick={() => void cargarMasHistorial()} disabled={historial.cargandoMas}>
                {historial.cargandoMas ? "Cargando historial…" : "Cargar más atenciones"}
              </button>
            )}
            {historial.vista.historial && (
              <AvisoPaginacion
                mensaje={historial.vista.mensaje ?? ""}
                etiqueta="historial"
                cargando={historial.cargandoMas}
                onReintentar={() => void cargarMasHistorial()}
              />
            )}
          </section>
        </>
      )}
    </section>
  );
}

function ListaSolicitudes({
  estado,
  onMore,
}: {
  estado: EstadoLista<SolicitudProfesionalClinica>;
  onMore(): void;
}) {
  if (estado.estado === "inactivo") {
    return <div className={styles.estadoVacio} role="status">Selecciona una clínica para consultar solicitudes asignadas.</div>;
  }
  if (estado.estado === "cargando") {
    return <div className={styles.estadoCarga} role="status">Cargando solicitudes asignadas…</div>;
  }
  if (estado.estado === "vacio") {
    return (
      <>
        <div className={styles.estadoVacio} role="status">
          No hay solicitudes asignadas para esta clínica.
        </div>
        <AvisoPaginacion
          mensaje={estado.mensaje}
          etiqueta="solicitudes"
          cargando={estado.cargandoMas}
          onReintentar={onMore}
        />
      </>
    );
  }
  if (estado.estado === "denegado") {
    return <div className={styles.estadoDenegado} role="alert">{estado.mensaje}</div>;
  }
  if (estado.estado === "error") {
    return <div className={styles.estadoError} role="alert">{estado.mensaje}</div>;
  }
  return (
    <>
      <ul className={styles.listaSolicitudes}>
        {estado.items.map((solicitud) => (
          <li key={solicitud.id} className={styles.solicitudProfesional}>
            <div>
              <strong>Solicitud de demostración</strong>
              <span>Fecha preferida: {solicitud.preferredDate}{solicitud.preferredTime ? ` · ${solicitud.preferredTime}` : ""}</span>
            </div>
            <span className={styles.identificador}>
              {solicitud.status === "requested" ? "Solicitada" : "Cancelada"}
            </span>
          </li>
        ))}
      </ul>
      {estado.nextAfterId && (
        <button type="button" className={styles.botonSecundario} onClick={onMore} disabled={estado.cargandoMas}>
          {estado.cargandoMas ? "Cargando solicitudes…" : "Cargar más solicitudes"}
        </button>
      )}
      <AvisoPaginacion
        mensaje={estado.mensaje}
        etiqueta="solicitudes"
        cargando={estado.cargandoMas}
        onReintentar={onMore}
      />
    </>
  );
}

function AvisoPaginacion({
  mensaje,
  etiqueta,
  cargando,
  onReintentar,
}: {
  mensaje: string;
  etiqueta: string;
  cargando: boolean;
  onReintentar(): void;
}) {
  if (!mensaje) return null;
  return (
    <div className={styles.estadoError} role="status" aria-live="polite">
      <strong>No se pudo cargar más {etiqueta}.</strong>
      <p>{mensaje}</p>
      <div className={styles.accionesEstado}>
        <button
          type="button"
          className={styles.botonSecundario}
          onClick={onReintentar}
          disabled={cargando}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
