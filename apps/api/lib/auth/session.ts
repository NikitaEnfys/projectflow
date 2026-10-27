import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import {
  cookies,
  headers,
} from "next/headers";
import {
  SESSION_COOKIE_NAME,
} from "@projectflow/contracts";

export const SESSION_COOKIE =
  SESSION_COOKIE_NAME;

const SESSION_TTL_SECONDS =
  60 * 60 * 24 * 7;

const MIN_PRODUCTION_SECRET_BYTES =
  32;

type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  exp: number;
};

function getSecret() {
  const configured =
    process.env.SESSION_SECRET;

  if (configured) {
    if (
      process.env.NODE_ENV ===
        "production" &&
      Buffer.byteLength(
        configured,
        "utf8",
      ) <
        MIN_PRODUCTION_SECRET_BYTES
    ) {
      throw new Error(
        "A SESSION_SECRET production környezetben legalább 32 bájt hosszú legyen.",
      );
    }

    return configured;
  }

  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    return "projectflow-development-session-secret-change-me";
  }

  throw new Error(
    "A SESSION_SECRET környezeti változó kötelező production környezetben.",
  );
}

function encode(
  value: string,
) {
  return Buffer.from(
    value,
    "utf8",
  ).toString("base64url");
}

function decode(
  value: string,
) {
  return Buffer.from(
    value,
    "base64url",
  ).toString("utf8");
}

function sign(
  encodedPayload: string,
) {
  return createHmac(
    "sha256",
    getSecret(),
  )
    .update(
      encodedPayload,
    )
    .digest(
      "base64url",
    );
}

export function createSessionToken(
  input: {
    providerUserId: string;
    email: string;
    name: string;
  },
) {
  const payload: SessionPayload =
    {
      sub:
        input.providerUserId,
      email:
        input.email.toLowerCase(),
      name:
        input.name,
      exp:
        Math.floor(
          Date.now() / 1000,
        ) +
        SESSION_TTL_SECONDS,
    };

  const encoded =
    encode(
      JSON.stringify(
        payload,
      ),
    );

  return `${encoded}.${sign(encoded)}`;
}

function isSessionPayload(
  value: unknown,
): value is SessionPayload {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const payload =
    value as Partial<SessionPayload>;

  return (
    typeof payload.sub ===
      "string" &&
    Boolean(payload.sub) &&
    typeof payload.email ===
      "string" &&
    Boolean(payload.email) &&
    typeof payload.name ===
      "string" &&
    typeof payload.exp ===
      "number" &&
    Number.isInteger(
      payload.exp,
    )
  );
}

export function verifySessionToken(
  token:
    | string
    | null
    | undefined,
): SessionPayload | null {
  if (!token) {
    return null;
  }

  const parts =
    token.split(".");

  if (
    parts.length !== 2
  ) {
    return null;
  }

  const [
    encoded,
    signature,
  ] = parts;

  if (
    !encoded ||
    !signature
  ) {
    return null;
  }

  const expected =
    sign(encoded);

  const actualBuffer =
    Buffer.from(
      signature,
      "utf8",
    );
  const expectedBuffer =
    Buffer.from(
      expected,
      "utf8",
    );

  if (
    actualBuffer.length !==
      expectedBuffer.length ||
    !timingSafeEqual(
      actualBuffer,
      expectedBuffer,
    )
  ) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(
        decode(encoded),
      ) as unknown;

    if (
      !isSessionPayload(
        parsed,
      )
    ) {
      return null;
    }

    if (
      parsed.exp <=
      Math.floor(
        Date.now() / 1000,
      )
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      "production",
    sameSite:
      "lax" as const,
    path: "/",
    maxAge:
      SESSION_TTL_SECONDS,
    ...(process.env
      .SESSION_COOKIE_DOMAIN
      ? {
          domain:
            process.env
              .SESSION_COOKIE_DOMAIN,
        }
      : {}),
  };
}

export async function setSessionCookie(
  token: string,
) {
  const store =
    await cookies();

  store.set(
    SESSION_COOKIE,
    token,
    cookieOptions(),
  );
}

export async function clearSessionCookie() {
  const store =
    await cookies();

  store.set(
    SESSION_COOKIE,
    "",
    {
      ...cookieOptions(),
      maxAge: 0,
    },
  );
}

export async function readSessionToken() {
  const requestHeaders =
    await headers();

  const authorization =
    requestHeaders.get(
      "authorization",
    );

  if (
    authorization?.startsWith(
      "Bearer ",
    )
  ) {
    return (
      authorization
        .slice(
          "Bearer ".length,
        )
        .trim() ||
      null
    );
  }

  const store =
    await cookies();

  return (
    store.get(
      SESSION_COOKIE,
    )?.value ??
    null
  );
}
