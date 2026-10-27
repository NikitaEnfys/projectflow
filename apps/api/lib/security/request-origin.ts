type RequestSourceInput = {
  method: string;
  allowedOrigin: string;
  origin: string | null;
  referer: string | null;
  secFetchSite: string | null;
  authorization: string | null;
};

const SAFE_METHODS =
  new Set([
    "GET",
    "HEAD",
    "OPTIONS",
  ]);

function normalizedOrigin(
  value: string,
) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isTrustedMutationSource({
  method,
  allowedOrigin,
  origin,
  referer,
  secFetchSite,
  authorization,
}: RequestSourceInput) {
  const normalizedMethod =
    method.toUpperCase();

  if (
    SAFE_METHODS.has(
      normalizedMethod,
    )
  ) {
    return true;
  }

  if (
    secFetchSite ===
    "cross-site"
  ) {
    return false;
  }

  const trustedOrigin =
    normalizedOrigin(
      allowedOrigin,
    );

  if (!trustedOrigin) {
    return false;
  }

  if (origin) {
    if (origin === "null") {
      return false;
    }

    return (
      normalizedOrigin(origin) ===
      trustedOrigin
    );
  }

  if (referer) {
    return (
      normalizedOrigin(referer) ===
      trustedOrigin
    );
  }

  if (
    authorization?.startsWith(
      "Bearer ",
    )
  ) {
    return true;
  }

  return false;
}
