import { NextResponse } from "next/server";
import type { RegisterRequest, RegisterResponse } from "@projectflow/contracts";
import { getAuthService } from "@/lib/auth/service";
import { setSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<RegisterRequest>;
    if (!body.name || !body.email || !body.password) return NextResponse.json({ error: "A név, e-mail és jelszó kötelező." }, { status: 400 });
    const next = body.next?.startsWith("/") ? body.next : "/dashboard";
    const result = await getAuthService().register({ name: body.name, email: body.email, password: body.password, next });

    if (!result.authenticated) {
      const response: RegisterResponse = { authenticated: false, requiresEmailConfirmation: result.requiresEmailConfirmation };
      return NextResponse.json(response);
    }

    await setSessionCookie(result.token);
    const response: RegisterResponse = {
      authenticated: true,
      requiresEmailConfirmation: false,
      user: { id: result.user.id, name: result.user.name, email: result.user.email },
    };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sikertelen regisztráció." }, { status: 400 });
  }
}
