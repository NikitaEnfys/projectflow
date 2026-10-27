"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  apiFetch,
} from "@/lib/api/client";

type UserRef = {
  id: string;
  name: string;
  email: string;
};

type Attachment = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  visibility:
    | "INTERNAL"
    | "CLIENT_VISIBLE";
  createdAt: string;
  uploadedById: string;
  uploadedBy: UserRef;
};

type Props = {
  projectId: string;
  taskId: string;
  taskClientVisible: boolean;
  canUpload: boolean;
  canManage: boolean;
  clientViewer: boolean;
  currentUserId: string;
};

function formatBytes(
  bytes: number,
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

export function TaskAttachments({
  projectId,
  taskId,
  taskClientVisible,
  canUpload,
  canManage,
  clientViewer,
  currentUserId,
}: Props) {
  const inputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const [
    attachments,
    setAttachments,
  ] = useState<
    Attachment[]
  >([]);

  const [
    visibility,
    setVisibility,
  ] = useState<
    | "INTERNAL"
    | "CLIENT_VISIBLE"
  >(
    clientViewer
      ? "CLIENT_VISIBLE"
      : "INTERNAL",
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function fetchAttachments() {
    const response =
      await apiFetch(
        `/api/projects/${projectId}/tasks/${taskId}/attachments`,
      );

    if (!response.ok) {
      const data =
        await response
          .json()
          .catch(
            () => null,
          );

      throw new Error(
        data?.error ??
          "Nem sikerült betölteni a fájlokat.",
      );
    }

    return (
      await response.json()
    ) as Attachment[];
  }

  async function reload() {
    setLoading(true);
    setError("");

    try {
      setAttachments(
        await fetchAttachments(),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Nem sikerült betölteni a fájlokat.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled =
      false;

    async function loadForTask() {
      try {
        const response =
          await apiFetch(
            `/api/projects/${projectId}/tasks/${taskId}/attachments`,
          );

        if (!response.ok) {
          const data =
            await response
              .json()
              .catch(
                () => null,
              );

          throw new Error(
            data?.error ??
              "Nem sikerült betölteni a fájlokat.",
          );
        }

        const next =
          (await response.json()) as
            Attachment[];

        if (
          !cancelled
        ) {
          setAttachments(
            next,
          );
          setError("");
        }
      } catch (error) {
        if (
          !cancelled
        ) {
          setError(
            error instanceof Error
              ? error.message
              : "Nem sikerült betölteni a fájlokat.",
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false,
          );
        }
      }
    }

    void loadForTask();

    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    taskId,
  ]);

  async function upload(
    event:
      React.FormEvent,
  ) {
    event.preventDefault();

    const file =
      inputRef.current
        ?.files?.[0];

    if (!file) {
      setError(
        "Válassz fájlt.",
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const body =
        new FormData();

      body.set(
        "file",
        file,
      );

      body.set(
        "visibility",
        clientViewer
          ? "CLIENT_VISIBLE"
          : visibility,
      );

      const response =
        await apiFetch(
          `/api/projects/${projectId}/tasks/${taskId}/attachments`,
          {
            method: "POST",
            body,
          },
        );

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(
              () => null,
            );

        throw new Error(
          data?.error ??
            "A feltöltés nem sikerült.",
        );
      }

      if (
        inputRef.current
      ) {
        inputRef.current.value =
          "";
      }

      await reload();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "A feltöltés nem sikerült.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function download(
    attachment: Attachment,
  ) {
    setBusy(true);
    setError("");

    try {
      const response =
        await apiFetch(
          `/api/projects/${projectId}/tasks/${taskId}/attachments/${attachment.id}`,
        );

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(
              () => null,
            );

        throw new Error(
          data?.error ??
            "A letöltés nem sikerült.",
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob,
        );

      const anchor =
        document.createElement(
          "a",
        );

      anchor.href = url;
      anchor.download =
        attachment.originalName;

      document.body.appendChild(
        anchor,
      );

      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(
        url,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "A letöltés nem sikerült.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(
    attachment: Attachment,
  ) {
    if (
      !confirm(
        `Biztosan törlöd ezt a fájlt: ${attachment.originalName}?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response =
        await apiFetch(
          `/api/projects/${projectId}/tasks/${taskId}/attachments/${attachment.id}`,
          {
            method:
              "DELETE",
          },
        );

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(
              () => null,
            );

        throw new Error(
          data?.error ??
            "A fájl törlése nem sikerült.",
        );
      }

      await reload();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "A fájl törlése nem sikerült.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-[#edf0f5] pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="font-semibold">
            Fájlok
          </h4>
          <p className="mt-1 text-xs text-[#8993a5]">
            PDF, PNG, JPG/JPEG,
            TXT vagy CSV · maximum
            10 MB.
          </p>
        </div>

        <span className="pf-chip">
          {
            attachments.length
          }{" "}
          fájl
        </span>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-[#fff2f4] p-3 text-sm text-[#b33d50]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-[#8993a5]">
          Fájlok betöltése…
        </p>
      ) : attachments.length ===
        0 ? (
        <p className="mt-4 text-sm text-[#8993a5]">
          Még nincs feltöltött
          fájl.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {attachments.map(
            (attachment) => {
              const canDelete =
                canManage ||
                attachment
                  .uploadedById ===
                  currentUserId;

              return (
                <article
                  key={
                    attachment.id
                  }
                  className="rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-semibold text-[#3f485b]">
                        {
                          attachment.originalName
                        }
                      </p>

                      <p className="mt-1 text-xs text-[#8993a5]">
                        {formatBytes(
                          attachment.sizeBytes,
                        )}
                        {" · "}
                        {
                          attachment.uploadedBy
                            .name
                        }
                        {" · "}
                        {new Date(
                          attachment.createdAt,
                        ).toLocaleString(
                          "hu-HU",
                        )}
                      </p>

                      <p className="mt-1 text-[11px] text-[#9aa2b0]">
                        {attachment.visibility ===
                        "CLIENT_VISIBLE"
                          ? "Ügyfélnek látható"
                          : "Belső fájl"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void download(
                            attachment,
                          )
                        }
                        className="pf-button-secondary disabled:opacity-50"
                      >
                        Letöltés
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void remove(
                              attachment,
                            )
                          }
                          className="rounded-lg border border-[#efc9cf] bg-[#fff7f8] px-3 py-2 text-sm font-semibold text-[#b33d50] disabled:opacity-50"
                        >
                          Törlés
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}

      {canUpload && (
        <form
          onSubmit={upload}
          className="mt-4 grid gap-3 rounded-xl border border-dashed border-[#d9deea] bg-white p-4 md:grid-cols-[1fr_auto_auto]"
        >
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-medium text-[#667084]">
              Fájl kiválasztása
            </span>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,application/pdf,image/png,image/jpeg,text/plain,text/csv"
              disabled={busy}
              className="block w-full min-w-0 rounded-lg border bg-white p-2 text-sm"
            />
          </label>

          {!clientViewer &&
            taskClientVisible && (
              <label>
                <span className="mb-1 block text-xs font-medium text-[#667084]">
                  Láthatóság
                </span>

                <select
                  value={
                    visibility
                  }
                  disabled={busy}
                  onChange={(
                    event,
                  ) =>
                    setVisibility(
                      event
                        .target
                        .value as
                        | "INTERNAL"
                        | "CLIENT_VISIBLE",
                    )
                  }
                  className="rounded-lg border bg-white p-2.5 text-sm"
                >
                  <option value="INTERNAL">
                    Belső
                  </option>
                  <option value="CLIENT_VISIBLE">
                    Ügyfélnek látható
                  </option>
                </select>
              </label>
            )}

          <button
            disabled={busy}
            className="self-end pf-button-primary disabled:opacity-50"
          >
            {busy
              ? "Folyamatban…"
              : "Feltöltés"}
          </button>
        </form>
      )}

      {canUpload &&
        !clientViewer &&
        !taskClientVisible && (
          <p className="mt-2 text-xs text-[#8993a5]">
            Ez a feladat nem
            ügyfélnek látható, ezért
            a feltöltött fájlok csak
            belső fájlok lehetnek.
          </p>
        )}

      {clientViewer &&
        canUpload && (
          <p className="mt-2 text-xs text-[#8993a5]">
            Ügyfélként feltöltött
            fájl automatikusan
            ügyfélnek látható.
          </p>
        )}
    </div>
  );
}
