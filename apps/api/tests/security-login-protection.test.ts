import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  LOGIN_ACCOUNT_LIMIT,
  LOGIN_ACCOUNT_WINDOW_MS,
  checkLoginAccountLimit,
  clearLoginFailures,
  recordFailedLogin,
} from "@/lib/security/login-protection";
import {
  resetRateLimitsForTests,
} from "@/lib/security/rate-limit";

describe(
  "login account throttling",
  () => {
    beforeEach(() => {
      resetRateLimitsForTests();
    });

    it("az első sikertelen próbálkozások után még enged", () => {
      const email =
        "USER@EXAMPLE.COM";

      for (
        let i = 0;
        i <
        LOGIN_ACCOUNT_LIMIT;
        i += 1
      ) {
        expect(
          checkLoginAccountLimit(
            email,
            1000 + i,
          ).allowed,
        ).toBe(true);

        recordFailedLogin(
          email,
          1000 + i,
        );
      }

      expect(
        checkLoginAccountLimit(
          email,
          2000,
        ).allowed,
      ).toBe(false);
    });

    it("az e-mail kulcs kis- és nagybetűfüggetlen", () => {
      recordFailedLogin(
        "Demo@Example.com",
        1000,
      );

      for (
        let i = 1;
        i <
        LOGIN_ACCOUNT_LIMIT;
        i += 1
      ) {
        recordFailedLogin(
          "demo@example.com",
          1000 + i,
        );
      }

      expect(
        checkLoginAccountLimit(
          "DEMO@EXAMPLE.COM",
          2000,
        ).allowed,
      ).toBe(false);
    });

    it("sikeres login után törölhető a failure bucket", () => {
      const email =
        "demo@example.com";

      for (
        let i = 0;
        i <
        LOGIN_ACCOUNT_LIMIT;
        i += 1
      ) {
        recordFailedLogin(
          email,
          1000 + i,
        );
      }

      clearLoginFailures(
        email,
      );

      expect(
        checkLoginAccountLimit(
          email,
          2000,
        ).allowed,
      ).toBe(true);
    });

    it("az observation window után újra enged", () => {
      const email =
        "demo@example.com";

      for (
        let i = 0;
        i <
        LOGIN_ACCOUNT_LIMIT;
        i += 1
      ) {
        recordFailedLogin(
          email,
          1000 + i,
        );
      }

      expect(
        checkLoginAccountLimit(
          email,
          1000 +
            LOGIN_ACCOUNT_WINDOW_MS +
            100,
        ).allowed,
      ).toBe(true);
    });
  },
);
