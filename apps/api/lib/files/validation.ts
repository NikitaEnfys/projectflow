import {
  extname,
} from "node:path";

export const MAX_ATTACHMENT_BYTES =
  10 * 1024 * 1024;

export const MAX_ATTACHMENT_NAME_LENGTH =
  120;

const MIME_BY_EXTENSION =
  new Map<
    string,
    {
      accepted:
        readonly string[];
      canonical: string;
    }
  >([
    [
      ".pdf",
      {
        accepted: [
          "application/pdf",
        ],
        canonical:
          "application/pdf",
      },
    ],
    [
      ".png",
      {
        accepted: [
          "image/png",
        ],
        canonical:
          "image/png",
      },
    ],
    [
      ".jpg",
      {
        accepted: [
          "image/jpeg",
        ],
        canonical:
          "image/jpeg",
      },
    ],
    [
      ".jpeg",
      {
        accepted: [
          "image/jpeg",
        ],
        canonical:
          "image/jpeg",
      },
    ],
    [
      ".txt",
      {
        accepted: [
          "text/plain",
          "application/octet-stream",
        ],
        canonical:
          "text/plain",
      },
    ],
    [
      ".csv",
      {
        accepted: [
          "text/csv",
          "text/plain",
          "application/vnd.ms-excel",
          "application/octet-stream",
        ],
        canonical:
          "text/csv",
      },
    ],
  ]);

export type ValidatedAttachment = {
  extension: string;
  mimeType: string;
};

export class AttachmentValidationError
  extends Error {}

function hasPrefix(
  bytes: Uint8Array,
  prefix: number[],
) {
  return prefix.every(
    (value, index) =>
      bytes[index] === value,
  );
}

function validText(
  bytes: Uint8Array,
) {
  if (
    bytes.some(
      (value) => value === 0,
    )
  ) {
    return false;
  }

  try {
    new TextDecoder(
      "utf-8",
      {
        fatal: true,
      },
    ).decode(bytes);

    return true;
  } catch {
    return false;
  }
}

function validSignature(
  extension: string,
  bytes: Uint8Array,
) {
  switch (
    extension
  ) {
    case ".pdf":
      return hasPrefix(
        bytes,
        [
          0x25,
          0x50,
          0x44,
          0x46,
          0x2d,
        ],
      );

    case ".png":
      return hasPrefix(
        bytes,
        [
          0x89,
          0x50,
          0x4e,
          0x47,
          0x0d,
          0x0a,
          0x1a,
          0x0a,
        ],
      );

    case ".jpg":
    case ".jpeg":
      return hasPrefix(
        bytes,
        [
          0xff,
          0xd8,
          0xff,
        ],
      );

    case ".txt":
    case ".csv":
      return validText(
        bytes,
      );

    default:
      return false;
  }
}

export function validateAttachment(
  input: {
    name: string;
    type: string;
    bytes: Uint8Array;
  },
): ValidatedAttachment {
  const name =
    input.name.trim();

  if (
    !name ||
    name.length >
      MAX_ATTACHMENT_NAME_LENGTH
  ) {
    throw new AttachmentValidationError(
      `A fájlnév 1–${MAX_ATTACHMENT_NAME_LENGTH} karakter lehet.`,
    );
  }

  if (
    /[\\/:*?"<>|\u0000-\u001f]/.test(
      name,
    )
  ) {
    throw new AttachmentValidationError(
      "A fájlnév tiltott karaktert tartalmaz.",
    );
  }

  if (
    input.bytes.byteLength ===
    0
  ) {
    throw new AttachmentValidationError(
      "Üres fájl nem tölthető fel.",
    );
  }

  if (
    input.bytes.byteLength >
    MAX_ATTACHMENT_BYTES
  ) {
    throw new AttachmentValidationError(
      "A fájl legfeljebb 10 MB lehet.",
    );
  }

  const extension =
    extname(
      name,
    ).toLowerCase();

  const mimeRule =
    MIME_BY_EXTENSION.get(
      extension,
    );

  if (!mimeRule) {
    throw new AttachmentValidationError(
      "Csak PDF, PNG, JPG/JPEG, TXT és CSV fájl tölthető fel.",
    );
  }

  const declaredMime =
    input.type
      .trim()
      .toLowerCase();

  if (
    declaredMime &&
    !mimeRule.accepted.includes(
      declaredMime,
    )
  ) {
    throw new AttachmentValidationError(
      "A fájl MIME típusa nem egyezik az engedélyezett típussal.",
    );
  }

  if (
    !validSignature(
      extension,
      input.bytes,
    )
  ) {
    throw new AttachmentValidationError(
      "A fájl tartalma nem egyezik a kiterjesztésével.",
    );
  }

  return {
    extension,
    mimeType:
      mimeRule.canonical,
  };
}
