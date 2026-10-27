import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  isTrustedMutationSource,
} from "@/lib/security/request-origin";
import {
  consumeRateLimit,
} from "@/lib/security/rate-limit";

const DEFAULT_WEB_ORIGIN =
  "http://localhost:3000";

function allowedOrigin() {
  return (
    process.env.WEB_ORIGIN ??
    DEFAULT_WEB_ORIGIN
  );
}

function clientAddress(
  request: NextRequest,
) {
  const forwarded =
    request.headers.get(
      "x-forwarded-for",
    );

  if (forwarded) {
    return (
      forwarded
        .split(",")[0]
        ?.trim() ||
      "unknown"
    );
  }

  return (
    request.headers.get(
      "x-real-ip",
    ) ??
    "unknown"
  );
}

function endpointRateLimit(
  request: NextRequest,
) {
  if (
    request.method !== "POST"
  ) {
    return true;
  }

  const pathname =
    request.nextUrl.pathname;
  const ip =
    clientAddress(request);

  if (
    pathname ===
    "/api/auth/login"
  ) {
    return consumeRateLimit({
      key:
        `login:ip:${ip}`,
      limit: 30,
      windowMs:
        5 * 60 * 1000,
    }).allowed;
  }

  if (
    pathname ===
    "/api/auth/register"
  ) {
    return consumeRateLimit({
      key:
        `register:ip:${ip}`,
      limit: 10,
      windowMs:
        15 * 60 * 1000,
    }).allowed;
  }

  if (
    /^\/api\/organizations\/[^/]+\/invitations$/.test(
      pathname,
    )
  ) {
    return consumeRateLimit({
      key:
        `invitation:ip:${ip}`,
      limit: 30,
      windowMs:
        60 * 60 * 1000,
    }).allowed;
  }

  return true;
}

function tooManyRequestsResponse(
  request: NextRequest,
) {
  const response =
    NextResponse.json(
      {
        error:
          "Túl sok kérés. Próbáld újra később.",
      },
      {
        status: 429,
      },
    );

  response.headers.set(
    "Cache-Control",
    "no-store",
  );

  return applyCors(
    response,
    request,
  );
}

function applyCors(
  response: NextResponse,
  request: NextRequest,
) {
  const configuredOrigin =
    allowedOrigin();
  const origin =
    request.headers.get(
      "origin",
    );

  if (
    origin === configuredOrigin
  ) {
    response.headers.set(
      "Access-Control-Allow-Origin",
      configuredOrigin,
    );
  }

  response.headers.set(
    "Vary",
    "Origin",
  );
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization,Content-Type",
  );
  response.headers.set(
    "Access-Control-Allow-Credentials",
    "true",
  );

  return response;
}

function forbiddenCrossSiteResponse(
  request: NextRequest,
) {
  const response =
    NextResponse.json(
      {
        error:
          "A kérés forrása nem engedélyezett.",
      },
      {
        status: 403,
      },
    );

  return applyCors(
    response,
    request,
  );
}

export function proxy(
  request: NextRequest,
) {
  const trusted =
    isTrustedMutationSource({
      method: request.method,
      allowedOrigin:
        allowedOrigin(),
      origin:
        request.headers.get(
          "origin",
        ),
      referer:
        request.headers.get(
          "referer",
        ),
      secFetchSite:
        request.headers.get(
          "sec-fetch-site",
        ),
      authorization:
        request.headers.get(
          "authorization",
        ),
    });

  if (!trusted) {
    return forbiddenCrossSiteResponse(
      request,
    );
  }

  if (
    !endpointRateLimit(
      request,
    )
  ) {
    return tooManyRequestsResponse(
      request,
    );
  }

  if (
    request.method ===
    "OPTIONS"
  ) {
    return applyCors(
      new NextResponse(
        null,
        {
          status: 204,
        },
      ),
      request,
    );
  }

  const response =
    NextResponse.next();

  response.headers.set(
    "Cache-Control",
    "no-store",
  );

  return applyCors(
    response,
    request,
  );
}

export const config = {
  matcher: [
    "/api/:path*",
  ],
};
