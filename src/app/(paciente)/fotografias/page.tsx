"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./page.module.css";
import Link from "next/link";
import { mensajeFotografia } from "@/features/fotografias/mensajes";
import { eliminarFotografia, ErrorEliminacionFoto } from "@/features/fotografias/eliminar";
import AccesoRol from "@/features/autorizacion/AccesoRol";
import { useRouter } from "next/navigation";
import { useFotografiaPreparacion } from "@/features/analisis/FotografiaPreparacionContexto";
import { mensajeValidacionFotografia, validarFotografia } from "@/features/analisis/fotografia";

const BUCKET = "dental-photos";
const POLICY_VERSION = "1.0";

const CONSENT_PURPOSE = "academic_photo_storage";
const CONSENT_TEXT = `Acepto de forma expresa que las fotografías sintéticas o de prueba que seleccione sean almacenadas de forma privada en Supabase dentro del prototipo académico DentAI. La finalidad es demostrar el almacenamiento, consulta y eliminación segura de fotografías dentro del proyecto. La fotografía se almacenará en un bucket privado y podrá ser consultada o eliminada por el propietario. No se realizará análisis automatizado, diagnóstico clínico, entrenamiento de modelos de inteligencia artificial ni uso de las fotografías para otros fines. Puedo revocar este consentimiento y eliminar posteriormente las fotografías almacenadas.`;

const MIN_FILE_SIZE = 1;
const MAX_FILE_SIZE = 8_388_608;

const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

type Photo = {
  id: string;
  consent_id: string;
  object_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

type Preview = {
  photoId: string;
  url: string;
};

type Paso = 1 | 2 | 3 | 4 | 5;
const PASOS = ["Consentimiento", "Preparación", "Elegir imagen", "Revisión", "Confirmación"] as const;

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getErrorMessage(error: unknown, fallback: string) {
  const candidate = error as { code?: string; message?: string } | null;

  if (candidate?.code === "23514" && candidate.message?.includes("patient_consents_purpose_check")) {
    return "No se pudo registrar el consentimiento porque la finalidad no es válida. La operación fue detenida sin modificar las restricciones de la base de datos.";
  }

  if (
    candidate?.code === "401" ||
    candidate?.code === "403" ||
    candidate?.message?.toLowerCase().includes("jwt") ||
    candidate?.message?.toLowerCase().includes("session")
  ) {
    return "Tu sesión ya no es válida. Inicia sesión nuevamente desde /cuenta y vuelve a intentarlo.";
  }

  return candidate?.message || fallback;
}

async function validateImage(file: File) {
  if (!(file.type in ALLOWED_TYPES)) {
    throw new Error("Solo se permiten imágenes JPG, PNG o WebP.");
  }

  if (file.size < MIN_FILE_SIZE || file.size > MAX_FILE_SIZE) {
    throw new Error("La imagen debe tener un tamaño entre 1 byte y 8 MB.");
  }

  const url = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("El archivo no se puede decodificar como una imagen válida."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotosPageContent() {
  const router = useRouter();
  const { establecerFotografia } = useFotografiaPreparacion();
  const [userId, setUserId] = useState<string | null>(null);
  const [consentId, setConsentId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorCarga, setErrorCarga] = useState(false);
  const [message, setMessage] = useState("");
  const [paso, setPaso] = useState<Paso>(1);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const localPreviewRef = useRef<string | null>(null);
  const previewUrlsRef = useRef(new Set<string>());

  const clearMessages = () => {
    setError("");
    setMessage("");
  };

  async function loadData() {
    setLoading(true);
    clearMessages();
    setErrorCarga(false);

    try {
      const client = getSupabaseBrowserClient();

      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setUserId(null);
        setConsentId(null);
        setPhotos([]);
        return;
      }

      setUserId(user.id);

      const { data: consent, error: consentError } = await client
        .from("patient_consents")
        .select(
          "id, policy_version, consent_text, accepted_at, revoked_at"
        )
        .eq("user_id", user.id)
        .eq("policy_version", POLICY_VERSION)
        .is("revoked_at", null)
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (consentError) {
        throw consentError;
      }

      setConsentId(consent?.id ?? null);
      setAccepted(Boolean(consent));
      if (!consent) {
        if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = null;
        setSelectedFile(null);
        setLocalPreview(null);
      }
      setPaso((actual) => !consent ? 1 : actual === 1 ? 2 : actual);

      const { data: photoData, error: photosError } = await client
        .from("dental_photos")
        .select(
          "id, consent_id, object_path, original_filename, mime_type, size_bytes, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (photosError) {
        throw photosError;
      }

      setPhotos(photoData ?? []);
    } catch (err) {
      setError(mensajeFotografia(err, "No se pudo cargar la información."));
      setErrorCarga(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const client = getSupabaseBrowserClient();

    void loadData();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUserId(null);
        setConsentId(null);
        setPhotos([]);
        setAccepted(false);
        setPreviews((current) => {
          current.forEach((preview) => URL.revokeObjectURL(preview.url));
          return [];
        });
        previewUrlsRef.current.clear();
        if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = null;
        setSelectedFile(null);
        setLocalPreview(null);
        setMessage("");
        setError("Tu sesión se cerró. Inicia sesión de nuevo en Mi cuenta para continuar.");
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        window.setTimeout(() => {
          void loadData();
        }, 0);
      }
    });

    return () => {
      subscription.unsubscribe();
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    };
    // La suscripción controla cambios de sesión; la carga inicial se ejecuta una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    clearMessages();

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      localPreviewRef.current = null;
    }

    setSelectedFile(null);
    setLocalPreview(null);

    void validateImage(file)
      .then(() => {
        setSelectedFile(file);
        const url = URL.createObjectURL(file);
        localPreviewRef.current = url;
        setLocalPreview(url);
        setPaso(4);
      })
      .catch((err) => {
        setError(mensajeFotografia(err, "No se pudo validar la imagen."));

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        if (cameraInputRef.current) {
          cameraInputRef.current.value = "";
        }
      });
  }

  async function giveConsent() {
    clearMessages();

    if (!accepted) {
      setError("Debes aceptar explícitamente el consentimiento.");
      return;
    }

    setBusy(true);

    try {
      const client = getSupabaseBrowserClient();

      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("Debes iniciar sesión antes de dar consentimiento.");
      }

      if (CONSENT_TEXT.length < 20 || CONSENT_TEXT.length > 5000) {
        throw new Error("El texto de consentimiento no tiene una longitud válida.");
      }

      const { data, error: consentError } = await client
        .from("patient_consents")
        .insert({
          policy_version: POLICY_VERSION,
          consent_text: CONSENT_TEXT,
          purpose: CONSENT_PURPOSE,
        })
        .select("id")
        .single();

      if (consentError) {
        throw consentError;
      }

      setConsentId(data.id);
      setMessage("Consentimiento registrado correctamente.");
      setPaso(2);
    } catch (err) {
      setError(mensajeFotografia(err, "No se pudo registrar el consentimiento."));
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto() {
    clearMessages();

    if (!selectedFile) {
      setError("Selecciona una imagen antes de subirla.");
      return;
    }

    if (!consentId) {
      setError("Necesitas un consentimiento vigente antes de subir fotografías.");
      return;
    }

    setBusy(true);

    try {
      const client = getSupabaseBrowserClient();

      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("No existe una sesión activa.");
      }

      const {
        data: currentConsent,
        error: consentError,
      } = await client
        .from("patient_consents")
        .select("id")
        .eq("id", consentId)
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .maybeSingle();

      if (consentError) {
        throw consentError;
      }

      if (!currentConsent) {
        setConsentId(null);
        setAccepted(false);
        throw new Error(
          "El consentimiento ya no está vigente. Debes aceptar un nuevo consentimiento."
        );
      }

      await validateImage(selectedFile);

      const extension = ALLOWED_TYPES[selectedFile.type as keyof typeof ALLOWED_TYPES];

      if (!extension) {
        throw new Error("Tipo de imagen no permitido.");
      }

      const objectPath = `${user.id}/${consentId}/${crypto.randomUUID()}${extension}`;

      const { error: uploadError } = await client.storage
        .from(BUCKET)
        .upload(objectPath, selectedFile, {
          upsert: false,
          contentType: selectedFile.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: insertedPhoto, error: metadataError } = await client
        .from("dental_photos")
        .insert({
          consent_id: consentId,
          object_path: objectPath,
          original_filename: selectedFile.name,
          mime_type: selectedFile.type,
          size_bytes: selectedFile.size,
        })
        .select(
          "id, consent_id, object_path, original_filename, mime_type, size_bytes, created_at"
        )
        .single();

      if (metadataError) {
        const { error: cleanupError } = await client.storage
          .from(BUCKET)
          .remove([objectPath]);

        if (cleanupError) {
          throw new Error(
            `La fotografía se subió, pero no se pudo registrar su información y tampoco fue posible limpiar el archivo temporal. El estado requiere revisión administrativa. Detalle del registro: ${metadataError.message}`
          );
        }

        throw new Error(
          `La fotografía se subió, pero no se pudo registrar su información. El archivo temporal fue eliminado de Storage. Detalle: ${metadataError.message}`
        );
      }

      setPhotos((current) => [insertedPhoto, ...current]);
      setSelectedFile(null);

      if (localPreview) {
        URL.revokeObjectURL(localPreview);
        localPreviewRef.current = null;
      }

      setLocalPreview(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setMessage("Fotografía almacenada correctamente.");
      setPaso(5);
    } catch (err) {
      setError(mensajeFotografia(err, "No se pudo subir la fotografía."));
    } finally {
      setBusy(false);
    }
  }

  async function downloadPhoto(photo: Photo) {
    clearMessages();

    try {
      const client = getSupabaseBrowserClient();

      const { data, error: downloadError } = await client.storage
        .from(BUCKET)
        .download(photo.object_path);

      if (downloadError) {
        throw downloadError;
      }

      const url = URL.createObjectURL(data);
      previewUrlsRef.current.add(url);

      setPreviews((current) => {
        const previous = current.find((item) => item.photoId === photo.id);

        if (previous) {
          URL.revokeObjectURL(previous.url);
          previewUrlsRef.current.delete(previous.url);
        }

        return [
          ...current.filter((item) => item.photoId !== photo.id),
          {
            photoId: photo.id,
            url,
          },
        ];
      });
    } catch (err) {
      setError(mensajeFotografia(err, "No se pudo descargar la fotografía."));
    }
  }

  async function prepararAnalisis(photo: Photo) {
    clearMessages();
    if (!consentId) {
      setError("Necesitas un consentimiento de almacenamiento vigente para volver a abrir una fotografía guardada.");
      return;
    }
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      const { data, error: downloadError } = await client.storage.from(BUCKET).download(photo.object_path);
      if (downloadError) throw downloadError;
      const archivo = new File([data], photo.original_filename, { type: photo.mime_type || data.type });
      const validacion = validarFotografia(archivo);
      if (!validacion.valido) throw new Error(mensajeValidacionFotografia(validacion.motivo));
      establecerFotografia(archivo);
      router.push("/analisis");
    } catch (err) {
      const mensaje = err instanceof Error && err.message.startsWith("La fotografía")
        ? err.message
        : mensajeFotografia(err, "No se pudo abrir la fotografía guardada para preparar el análisis.");
      setError(mensaje);
    } finally {
      setBusy(false);
    }
  }

  function removePreview(photoId: string) {
    setPreviews((current) => {
      const preview = current.find((item) => item.photoId === photoId);

      if (preview) {
        URL.revokeObjectURL(preview.url);
        previewUrlsRef.current.delete(preview.url);
      }

      return current.filter((item) => item.photoId !== photoId);
    });
  }

  async function deletePhoto(photo: Photo) {
    clearMessages();

    const confirmed = window.confirm(
      `¿Eliminar la fotografía "${photo.original_filename}"?`
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);

    try {
      const client = getSupabaseBrowserClient();

      const resultado = await eliminarFotografia(client, userId, photo.id);

      removePreview(photo.id);

      setPhotos((current) =>
        current.filter((item) => item.id !== photo.id)
      );

      setMessage(resultado === "eliminada" ? "Fotografía eliminada correctamente." : "La fotografía ya no está disponible para esta sesión.");
    } catch (err) {
      if (err instanceof ErrorEliminacionFoto && err.archivoAusente) removePreview(photo.id);
      setError(mensajeFotografia(err, "No se pudo eliminar la fotografía."));
    } finally {
      setBusy(false);
    }
  }

  async function revokeConsent() {
    if (!consentId) {
      return;
    }

    clearMessages();

    const confirmed = window.confirm(
      "Al revocar el consentimiento no podrás subir nuevas fotografías con este consentimiento. Las fotografías anteriores permanecerán disponibles para consultarlas o eliminarlas."
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);

    try {
      const client = getSupabaseBrowserClient();

      const { error: revokeError } = await client
        .from("patient_consents")
        .update({
          revoked_at: new Date().toISOString(),
        })
        .eq("id", consentId)
        .eq("user_id", userId ?? "");

      if (revokeError) {
        throw revokeError;
      }

      setConsentId(null);
      setAccepted(false);
      descartarSeleccion();
      setPaso(1);
      setMessage(
        "Consentimiento revocado. Ya no puedes realizar nuevas cargas con este consentimiento."
      );
    } catch (err) {
      setError(mensajeFotografia(err, "No se pudo revocar el consentimiento."));
    } finally {
      setBusy(false);
    }
  }

  function descartarSeleccion() {
    if (localPreview) URL.revokeObjectURL(localPreview);
    localPreviewRef.current = null;
    setSelectedFile(null);
    setLocalPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    clearMessages();
    setPaso(3);
  }

  if (loading) {
    return (
      <section className={styles.page}>
        <section className={styles.card}>
          <p role="status">Preparando tus fotografías…</p>
        </section>
      </section>
    );
  }

  if (!userId) {
    return (
      <section className={styles.page}>
        <section className={styles.card}>
          <h1>Mis fotografías dentales</h1>
          <p>
            Inicia sesión para consultar y guardar tus fotografías de prueba en tu espacio personal.
          </p>

          <a href="/cuenta" className={styles.button}>
            Ir a mi cuenta
          </a>
        </section>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>TU ESPACIO PRIVADO</p>
        <h1>Mis fotografías dentales</h1>
        <p>
          Guarda y consulta tus imágenes de prueba. Tú decides cuándo dar o revocar el permiso de almacenamiento. Aquí no se analizan fotografías ni se realizan diagnósticos.
        </p>
      <Link href="/analisis" className={styles.secondaryButton}>Preparar análisis dental</Link>
      </header>

      {error && (
        <div className={styles.error} role="alert">
          {error}
          {errorCarga && <button type="button" className={styles.textButton} onClick={() => void loadData()}>Volver a cargar</button>}
        </div>
      )}

      {message && (
        <div className={styles.success} role="status">
          {message}
        </div>
      )}

      <nav className={styles.progress} aria-label="Progreso para guardar una fotografía">
        <ol>{PASOS.map((nombre, indice) => <li key={nombre} aria-current={paso === indice + 1 ? "step" : undefined} className={paso > indice + 1 ? styles.completed : undefined}><span>{indice + 1}</span>{nombre}</li>)}</ol>
        <p className={styles.progressCurrent}>Paso {paso} de 5 · {PASOS[paso - 1]}</p>
      </nav>

      {consentId && paso !== 1 && <div className={styles.consentSummary} role="status"><strong>Permiso activo para guardar imágenes</strong><button type="button" className={styles.textButton} onClick={() => setPaso(1)}>Administrar permiso</button></div>}

      {paso === 1 && <section className={styles.card}>
        <h2>Tu permiso para guardar imágenes</h2>

        <p>
          Al aceptar, las imágenes de prueba que subas se guardarán de forma privada y asociadas a tu cuenta. Puedes revocar el permiso para nuevas cargas y eliminar tus fotografías anteriores.
        </p>

        <ul>
          <li>
            <strong>Destino:</strong> tu galería privada en DentaIA.
          </li>
          <li>
            <strong>Finalidad:</strong> demostración académica del manejo de
            fotografías.
          </li>
          <li>
            <strong>Eliminación:</strong> podrás eliminar las fotografías
            guardadas en tu galería.
          </li>
          <li>
            <strong>IA:</strong> las fotografías no se analizarán ni utilizarán
            para entrenar modelos.
          </li>
        </ul>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            disabled={Boolean(consentId) || busy}
          />
          <span>
            Acepto expresamente el almacenamiento privado de fotografías de
            prueba bajo esta política.
          </span>
        </label>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            disabled={!accepted || Boolean(consentId) || busy}
            onClick={giveConsent}
          >
            {busy ? "Procesando..." : "Dar consentimiento"}
          </button>

          {consentId && (
            <button
              type="button"
              className={styles.dangerButton}
              disabled={busy}
              onClick={revokeConsent}
            >
              Revocar consentimiento
            </button>
          )}
        </div>

        {consentId && (
          <p className={styles.status}>
            Permiso de almacenamiento activo
          </p>
        )}
        {consentId && <button type="button" className={styles.button} onClick={() => setPaso(2)}>Continuar a preparación</button>}
      </section>}

      {paso === 2 && <section className={styles.card}>
        <p className={styles.stepLabel}>Paso 2 de 5</p>
        <h2>Prepara una imagen clara</h2>
        <p>Usa únicamente una imagen de prueba. Busca luz uniforme, mantén el dispositivo estable y revisa que la zona de interés quede enfocada.</p>
        <div className={styles.guidance}>
          <div><h3>Sonrisa frontal</h3><p>Coloca la cámara frente al rostro y muestra la sonrisa completa. Esta vista sirve para preparar la imagen; no permite diagnosticar caries.</p></div>
          <div><h3>Imagen intraoral</h3><p>Acerca la cámara a la zona que deseas mostrar sin perder nitidez. Evita reflejos fuertes y vuelve a tomarla si sale borrosa.</p></div>
        </div>
        <p className={styles.privacyNote}>La imagen permanece en tu dispositivo hasta que la revises y pulses «Subir fotografía». Aquí no se realiza análisis automatizado.</p>
        <button type="button" className={styles.button} onClick={() => setPaso(3)}>Continuar a elegir imagen</button>
      </section>}

      {(paso === 3 || paso === 4) && <section className={styles.card}>
        <p className={styles.stepLabel}>Paso {paso} de 5</p>
        <h2>{paso === 3 ? "Elige una fotografía" : "Revisa antes de guardar"}</h2>

        {paso === 3 && <><p>
          Elige una imagen de prueba en formato JPG, PNG o WebP de hasta 8 MB. No subas fotografías de pacientes reales en esta demostración.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          aria-label="Seleccionar fotografía de prueba"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={!consentId || busy}
        />

        <div className={styles.actions}>
          <button type="button" className={styles.button} disabled={!consentId || busy} onClick={() => cameraInputRef.current?.click()}>
            Tomar fotografía
          </button>
          <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="Tomar fotografía con la cámara trasera" onChange={handleFileChange} disabled={!consentId || busy} style={{ display: "none" }} />
        </div>
        <p>En celulares compatibles se abrirá la cámara trasera. Si está denegada o no disponible, selecciona una imagen guardada en el dispositivo.</p>
        <button type="button" className={styles.textButton} onClick={() => setPaso(2)}>Volver a preparación</button></>}

        {paso === 4 && localPreview && selectedFile && (
          <div className={styles.previewBox}>
            <img
              src={localPreview}
              alt="Fotografía seleccionada antes de guardarla"
              className={styles.preview}
            />

            <div>
              <p>
                <strong>{selectedFile.name}</strong>
              </p>
              <p>
                {selectedFile.type} · {formatBytes(selectedFile.size)}
              </p>
            </div>
          </div>
        )}

        {paso === 4 && <div className={styles.actions}><button type="button" className={styles.secondaryButton} onClick={descartarSeleccion} disabled={busy}>Descartar o reemplazar</button><button
          type="button"
          className={styles.button}
          disabled={!consentId || !selectedFile || busy}
          onClick={uploadPhoto}
        >
          {busy ? "Subiendo..." : "Subir fotografía"}
        </button></div>}
      </section>}

      {paso === 5 && <section className={styles.card}>
        <p className={styles.stepLabel}>Paso 5 de 5</p>
        <h2>Fotografía guardada</h2>
        <p>La imagen se almacenó en tu galería privada. Puedes verla o eliminarla desde «Mis fotografías». No se ha realizado análisis ni diagnóstico.</p>
        <button type="button" className={styles.button} onClick={() => setPaso(2)}>Guardar otra fotografía</button>
      </section>}

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Mis fotografías</h2>
            <p>
              Aquí encontrarás las imágenes que guardaste con tu cuenta. Puedes abrirlas o eliminarlas cuando lo necesites.
            </p>
          </div>

          <span className={styles.counter}>{photos.length}</span>
        </div>

        {photos.length === 0 ? (
          <p>Aún no hay fotografías guardadas. Cuando subas una imagen de prueba con tu permiso, aparecerá aquí.</p>
        ) : (
          <div className={styles.photoGrid}>
            {photos.map((photo) => {
              const preview = previews.find(
                (item) => item.photoId === photo.id
              );

              return (
                <article className={styles.photoCard} key={photo.id}>
                  {preview ? (
                    <img
                      src={preview.url}
                      alt={`Vista previa de ${photo.original_filename}`}
                      className={styles.photo}
                    />
                  ) : (
                    <div className={styles.placeholder}>
                      Imagen privada
                    </div>
                  )}

                  <div className={styles.photoInfo}>
                    <strong>{photo.original_filename}</strong>

                    <span>
                      {photo.mime_type} · {formatBytes(photo.size_bytes)}
                    </span>

                    <div className={styles.actions}>
                      {preview ? (
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => removePreview(photo.id)}
                        >
                          Ocultar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          disabled={busy}
                          onClick={() => downloadPhoto(photo)}
                        >
                          Ver fotografía
                        </button>
                      )}

                      <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={busy || !consentId}
                        title={!consentId ? "Hace falta un consentimiento de almacenamiento vigente." : undefined}
                        onClick={() => void prepararAnalisis(photo)}
                      >
                        Preparar análisis
                      </button>

                      <button
                        type="button"
                        className={styles.dangerButton}
                        disabled={busy}
                        onClick={() => deletePhoto(photo)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

export default function PhotosPage() {
  return <AccesoRol rolesRequeridos={["paciente"]} modulo="las fotografías del paciente"><PhotosPageContent /></AccesoRol>;
}
