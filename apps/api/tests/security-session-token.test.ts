import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth/session";

describe(
  "session token security",
  () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("érvényes tokent visszaolvas", () => {
      const token =
        createSessionToken({
          providerUserId:
            "provider-user-1",
          email:
            "Demo@Example.com",
          name: "Demo",
        });

      expect(
        verifySessionToken(
          token,
        ),
      ).toMatchObject({
        sub:
          "provider-user-1",
        email:
          "demo@example.com",
        name: "Demo",
      });
    });

    it("módosított aláírást elutasít", () => {
      const token =
        createSessionToken({
          providerUserId:
            "provider-user-1",
          email:
            "demo@example.com",
          name: "Demo",
        });

      const [
        payload,
        signature,
      ] = token.split(".");

      const tampered =
        `${payload}.${signature.slice(
          0,
          -1,
        )}${
          signature.endsWith("a")
            ? "b"
            : "a"
        }`;

      expect(
        verifySessionToken(
          tampered,
        ),
      ).toBeNull();
    });

    it("extra tokenrészt elutasít", () => {
      const token =
        createSessionToken({
          providerUserId:
            "provider-user-1",
          email:
            "demo@example.com",
          name: "Demo",
        });

      expect(
        verifySessionToken(
          `${token}.extra`,
        ),
      ).toBeNull();
    });

    it("lejárt tokent elutasít", () => {
      vi.useFakeTimers();

      vi.setSystemTime(
        new Date(
          "2026-01-01T00:00:00Z",
        ),
      );

      const token =
        createSessionToken({
          providerUserId:
            "provider-user-1",
          email:
            "demo@example.com",
          name: "Demo",
        });

      vi.setSystemTime(
        new Date(
          "2026-01-09T00:00:00Z",
        ),
      );

      expect(
        verifySessionToken(
          token,
        ),
      ).toBeNull();
    });

    it("érvénytelen formátumot elutasít", () => {
      expect(
        verifySessionToken(
          "not-a-session-token",
        ),
      ).toBeNull();
    });
  },
);
