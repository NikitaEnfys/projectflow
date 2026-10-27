import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  NextRequest,
} from "next/server";
import {
  proxy,
} from "@/proxy";
import {
  resetRateLimitsForTests,
} from "@/lib/security/rate-limit";

const origin =
  "http://localhost:3000";

function request(
  path: string,
  ip: string,
) {
  return new NextRequest(
    `http://localhost:3001${path}`,
    {
      method: "POST",
      headers: {
        origin,
        "sec-fetch-site":
          "same-site",
        "x-forwarded-for":
          ip,
      },
    },
  );
}

describe(
  "API proxy security integration",
  () => {
    beforeEach(() => {
      process.env.WEB_ORIGIN =
        origin;

      resetRateLimitsForTests();
    });

    it("engedélyezett originről normál login kérést továbbenged", () => {
      const response =
        proxy(
          request(
            "/api/auth/login",
            "203.0.113.10",
          ),
        );

      expect(
        response.status,
      ).not.toBe(403);
      expect(
        response.status,
      ).not.toBe(429);
    });

    it("idegen origin unsafe kérést 403-mal blokkol", () => {
      const req =
        new NextRequest(
          "http://localhost:3001/api/auth/login",
          {
            method: "POST",
            headers: {
              origin:
                "https://attacker.example",
              "sec-fetch-site":
                "cross-site",
              "x-forwarded-for":
                "203.0.113.11",
            },
          },
        );

      const response =
        proxy(req);

      expect(
        response.status,
      ).toBe(403);
    });

    it("azonos IP túl sok login próbálkozását 429-cel blokkolja", () => {
      const ip =
        "203.0.113.12";

      for (
        let i = 0;
        i < 30;
        i += 1
      ) {
        const response =
          proxy(
            request(
              "/api/auth/login",
              ip,
            ),
          );

        expect(
          response.status,
        ).not.toBe(429);
      }

      const blocked =
        proxy(
          request(
            "/api/auth/login",
            ip,
          ),
        );

      expect(
        blocked.status,
      ).toBe(429);
    });

    it("másik IP saját külön login bucketet kap", () => {
      for (
        let i = 0;
        i < 30;
        i += 1
      ) {
        proxy(
          request(
            "/api/auth/login",
            "203.0.113.20",
          ),
        );
      }

      const response =
        proxy(
          request(
            "/api/auth/login",
            "203.0.113.21",
          ),
        );

      expect(
        response.status,
      ).not.toBe(429);
    });

    it("register endpoint szigorúbb IP limitet használ", () => {
      const ip =
        "203.0.113.30";

      for (
        let i = 0;
        i < 10;
        i += 1
      ) {
        expect(
          proxy(
            request(
              "/api/auth/register",
              ip,
            ),
          ).status,
        ).not.toBe(429);
      }

      expect(
        proxy(
          request(
            "/api/auth/register",
            ip,
          ),
        ).status,
      ).toBe(429);
    });

    it("invitation POST endpoint is kap IP burst limitet", () => {
      const ip =
        "203.0.113.40";
      const path =
        "/api/organizations/demo-org/invitations";

      for (
        let i = 0;
        i < 30;
        i += 1
      ) {
        expect(
          proxy(
            request(
              path,
              ip,
            ),
          ).status,
        ).not.toBe(429);
      }

      expect(
        proxy(
          request(
            path,
            ip,
          ),
        ).status,
      ).toBe(429);
    });
  },
);
