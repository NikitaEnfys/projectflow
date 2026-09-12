import { NextRequest, NextResponse } from "next/server";

function applyCors(response: NextResponse, request: NextRequest) {
  const allowedOrigin =
    process.env.WEB_ORIGIN ?? "http://localhost:3000";
  const origin = request.headers.get("origin");

  if (!origin || origin === allowedOrigin) {
    response.headers.set(
      "Access-Control-Allow-Origin",
      origin ?? allowedOrigin,
    );
  }

  response.headers.set("Vary", "Origin");
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

export function proxy(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return applyCors(
      new NextResponse(null, { status: 204 }),
      request,
    );
  }

  return applyCors(NextResponse.next(), request);
}

export const config = {
  matcher: ["/api/:path*"],
};
