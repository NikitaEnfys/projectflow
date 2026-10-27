import {
  createClient,
} from "@supabase/supabase-js";

const url =
  process.env.SUPABASE_URL;

const key =
  process.env
    .SUPABASE_SECRET_KEY;

const bucket =
  process.env
    .SUPABASE_STORAGE_BUCKET ??
  "projectflow-attachments";

if (!url || !key) {
  throw new Error(
    "SUPABASE_URL és SUPABASE_SECRET_KEY szükséges.",
  );
}

if (
  process.env.NODE_ENV ===
  "production"
) {
  throw new Error(
    "A bootstrap scriptet ne futtasd production NODE_ENV mellett automatikusan.",
  );
}

const supabase =
  createClient(
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

const options = {
  public: false,
  allowedMimeTypes: [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/plain",
    "text/csv",
  ],
  fileSizeLimit:
    10 * 1024 * 1024,
};

const {
  data: existing,
  error: getError,
} =
  await supabase.storage
    .getBucket(
      bucket,
    );

if (
  getError &&
  !/not found/i.test(
    getError.message,
  )
) {
  throw new Error(
    `Bucket lekérdezési hiba: ${getError.message}`,
  );
}

if (existing) {
  const {
    error,
  } =
    await supabase.storage
      .updateBucket(
        bucket,
        options,
      );

  if (error) {
    throw new Error(
      `Bucket frissítési hiba: ${error.message}`,
    );
  }

  console.log(
    `Supabase Storage bucket frissítve: ${bucket}`,
  );
} else {
  const {
    error,
  } =
    await supabase.storage
      .createBucket(
        bucket,
        options,
      );

  if (error) {
    throw new Error(
      `Bucket létrehozási hiba: ${error.message}`,
    );
  }

  console.log(
    `Supabase Storage bucket létrehozva: ${bucket}`,
  );
}

console.log(
  "private=true, maxFileSize=10MB, MIME allowlist beállítva.",
);
