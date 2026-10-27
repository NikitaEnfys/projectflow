import {
  createClient,
} from "@supabase/supabase-js";

const DEFAULT_BUCKET =
  "projectflow-attachments";

function getBucketName() {
  return (
    process.env
      .SUPABASE_STORAGE_BUCKET ??
    DEFAULT_BUCKET
  );
}

function getStorageClient() {
  const url =
    process.env.SUPABASE_URL;

  const key =
    process.env
      .SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "A Supabase Storage használatához SUPABASE_URL és SUPABASE_SECRET_KEY szükséges.",
    );
  }

  return createClient(
    url,
    key,
    {
      auth: {
        persistSession:
          false,
        autoRefreshToken:
          false,
        detectSessionInUrl:
          false,
      },
    },
  );
}

export async function writeStoredFile(
  storageKey: string,
  bytes: Uint8Array,
  mimeType: string,
) {
  const supabase =
    getStorageClient();

  const {
    error,
  } =
    await supabase.storage
      .from(
        getBucketName(),
      )
      .upload(
        storageKey,
        bytes,
        {
          contentType:
            mimeType,
          upsert: false,
          cacheControl:
            "0",
        },
      );

  if (error) {
    throw new Error(
      `Supabase Storage upload hiba: ${error.message}`,
    );
  }
}

export async function readStoredFile(
  storageKey: string,
) {
  const supabase =
    getStorageClient();

  const {
    data,
    error,
  } =
    await supabase.storage
      .from(
        getBucketName(),
      )
      .download(
        storageKey,
      );

  if (
    error ||
    !data
  ) {
    throw new Error(
      `Supabase Storage download hiba: ${
        error?.message ??
        "nincs adat"
      }`,
    );
  }

  return new Uint8Array(
    await data.arrayBuffer(),
  );
}

export async function removeStoredFile(
  storageKey: string,
) {
  const supabase =
    getStorageClient();

  const {
    error,
  } =
    await supabase.storage
      .from(
        getBucketName(),
      )
      .remove([
        storageKey,
      ]);

  if (error) {
    throw new Error(
      `Supabase Storage delete hiba: ${error.message}`,
    );
  }
}
