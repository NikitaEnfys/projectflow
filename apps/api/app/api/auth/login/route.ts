import {
  NextResponse,
} from "next/server";
import type {
  LoginRequest,
  LoginResponse,
} from "@projectflow/contracts";
import {
  getAuthService,
} from "@/lib/auth/service";
import {
  setSessionCookie,
} from "@/lib/auth/session";
import {
  checkLoginAccountLimit,
  clearLoginFailures,
  recordFailedLogin,
} from "@/lib/security/login-protection";

const GENERIC_LOGIN_ERROR =
  "Hibás e-mail cím vagy jelszó.";

export async function POST(
  request: Request,
) {
  let email = "";

  try {
    const body =
      (await request.json()) as
        Partial<LoginRequest>;

    email =
      typeof body.email ===
      "string"
        ? body.email
            .trim()
            .toLowerCase()
        : "";

    const password =
      typeof body.password ===
      "string"
        ? body.password
        : "";

    if (
      !email ||
      !password
    ) {
      return NextResponse.json(
        {
          error:
            "Az e-mail és a jelszó kötelező.",
        },
        {
          status: 400,
        },
      );
    }

    const accountLimit =
      checkLoginAccountLimit(
        email,
      );

    if (
      !accountLimit.allowed
    ) {
      return NextResponse.json(
        {
          error:
            "Túl sok sikertelen bejelentkezési kísérlet. Próbáld újra később.",
        },
        {
          status: 429,
        },
      );
    }

    const {
      token,
      user,
    } =
      await getAuthService().login(
        email,
        password,
      );

    clearLoginFailures(
      email,
    );

    await setSessionCookie(
      token,
    );

    const response:
      LoginResponse = {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };

    return NextResponse.json(
      response,
    );
  } catch {
    if (email) {
      recordFailedLogin(
        email,
      );
    }

    return NextResponse.json(
      {
        error:
          GENERIC_LOGIN_ERROR,
      },
      {
        status: 401,
      },
    );
  }
}
