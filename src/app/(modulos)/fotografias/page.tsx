"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./page.module.css";

const BUCKET = "dental-photos";
const POLICY_VERSION = "1.0";

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

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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

export default function PhotosPage() {
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
  const [message, setMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearMessages = () => {
    setError("");
    setMessage("");
  };

  async function loadData() {
    setLoading(true);
    clearMessages();

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
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar la información."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();

    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));

      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
    // La carga inicial debe ejecutarse una sola vez.
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
    }

    setSelectedFile(null);
    setLocalPreview(null);

    void validateImage(file)
      .then(() => {
        setSelectedFile(file);
        setLocalPreview(URL.createObjectURL(file));
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo validar la imagen."
        );

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
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
          purpose:
            "Almacenamiento privado de fotografías sintéticas/de prueba para el prototipo académico DentAI.",
        })
        .select("id")
        .single();

      if (consentError) {
        throw consentError;
      }

      setConsentId(data.id);
      setMessage("Consentimiento registrado correctamente.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo registrar el consentimiento."
      );
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
        await client.storage.from(BUCKET).remove([objectPath]);

        throw new Error(
          `La fotografía se subió, pero no se pudo registrar su información. El archivo fue eliminado de Storage. Detalle: ${metadataError.message}`
        );
      }

      setPhotos((current) => [insertedPhoto, ...current]);
      setSelectedFile(null);

      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }

      setLocalPreview(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setMessage("Fotografía almacenada correctamente.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo subir la fotografía."
      );
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

      setPreviews((current) => {
        const previous = current.find((item) => item.photoId === photo.id);

        if (previous) {
          URL.revokeObjectURL(previous.url);
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
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo descargar la fotografía."
      );
    }
  }

  function removePreview(photoId: string) {
    setPreviews((current) => {
      const preview = current.find((item) => item.photoId === photoId);

      if (preview) {
        URL.revokeObjectURL(preview.url);
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

      const { error: storageError } = await client.storage
        .from(BUCKET)
        .remove([photo.object_path]);

      if (storageError) {
        throw new Error(
          `No se pudo eliminar el archivo de Storage. No se eliminarán los metadatos. Puedes reintentar. Detalle: ${storageError.message}`
        );
      }

      const { error: metadataError } = await client
        .from("dental_photos")
        .delete()
        .eq("id", photo.id)
        .eq("user_id", userId ?? "");

      if (metadataError) {
        throw new Error(
          `El archivo fue eliminado de Storage, pero no se pudieron eliminar los metadatos. Puedes reintentar la eliminación de los metadatos. Detalle: ${metadataError.message}`
        );
      }

      removePreview(photo.id);

      setPhotos((current) =>
        current.filter((item) => item.id !== photo.id)
      );

      setMessage("Fotografía eliminada correctamente.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo eliminar la fotografía."
      );
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
        .eq("id", consentId);

      if (revokeError) {
        throw revokeError;
      }

      setConsentId(null);
      setAccepted(false);
      setMessage(
        "Consentimiento revocado. Ya no puedes realizar nuevas cargas con este consentimiento."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo revocar el consentimiento."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <p>Cargando módulo de fotografías...</p>
        </section>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>Fotografías</h1>
          <p>
            Debes iniciar sesión desde la herramienta de desarrollo antes de
            utilizar este módulo.
          </p>

          <a href="/desarrollo/acceso" className={styles.button}>
            Ir al acceso de prueba
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>DentAI · Prototipo académico</p>
        <h1>Consentimiento y fotografías</h1>
        <p>
          Este módulo permite demostrar el almacenamiento privado de imágenes
          sintéticas o de prueba. No realiza análisis mediante IA ni diagnóstico
          clínico.
        </p>
      </header>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className={styles.success} role="status">
          {message}
        </div>
      )}

      <section className={styles.card}>
        <h2>Antes de almacenar una fotografía</h2>

        <p>
          La vista previa local del MVP es diferente del almacenamiento en
          Supabase. Si aceptas, la fotografía seleccionada será enviada a un
          bucket privado de Supabase.
        </p>

        <ul>
          <li>
            <strong>Destino:</strong> almacenamiento privado de Supabase.
          </li>
          <li>
            <strong>Finalidad:</strong> demostración académica del manejo de
            fotografías.
          </li>
          <li>
            <strong>Eliminación:</strong> podrás eliminar las fotografías
            almacenadas desde este módulo.
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
            Consentimiento vigente · Política {POLICY_VERSION}
          </p>
        )}
      </section>

      <section className={styles.card}>
        <h2>Subir fotografía</h2>

        <p>
          Solo se aceptan JPG, PNG y WebP entre 1 byte y 8 MB. La imagen debe
          poder ser decodificada correctamente por el navegador.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={!consentId || busy}
        />

        {localPreview && selectedFile && (
          <div className={styles.previewBox}>
            <img
              src={localPreview}
              alt="Vista previa local de la fotografía seleccionada"
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

        <button
          type="button"
          className={styles.button}
          disabled={!consentId || !selectedFile || busy}
          onClick={uploadPhoto}
        >
          {busy ? "Subiendo..." : "Subir fotografía"}
        </button>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Mis fotografías</h2>
            <p>
              Los archivos se descargan mediante Storage API y se muestran
              usando una URL temporal local.
            </p>
          </div>

          <span className={styles.counter}>{photos.length}</span>
        </div>

        {photos.length === 0 ? (
          <p>No tienes fotografías almacenadas.</p>
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
                          Consultar
                        </button>
                      )}

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
    </main>
  );
}