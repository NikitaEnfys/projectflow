import { NextResponse } from "next/server";
import { getAuthService } from "@/lib/auth/service";
import { setSessionCookie } from "@/lib/auth/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next")?.startsWith("/") ? url.searchParams.get("next")! : "/dashboard";
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", webOrigin));
  try {
    const { token } = await getAuthService().completeCallback(code);
    await setSessionCookie(token);
    return NextResponse.redirect(new URL(next, webOrigin));
  } catch {
    return NextResponse.redirect(new URL("/login?error=auth_callback_failed", webOrigin));
  }
}
