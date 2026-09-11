import { NextResponse } from "next/server";
import type { LoginRequest, LoginResponse } from "@projectflow/contracts";
import { getAuthService } from "@/lib/auth/service";
import { setSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<LoginRequest>;
    if (!body.email || !body.password) return NextResponse.json({ error: "Az e-mail és a jelszó kötelező." }, { status: 400 });
    const { token, user } = await getAuthService().login(body.email, body.password);
    await setSessionCookie(token);
    const response: LoginResponse = { user: { id: user.id, name: user.name, email: user.email } };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sikertelen bejelentkezés." }, { status: 401 });
  }
}
