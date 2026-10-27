import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  checkRateLimit,
  clearRateLimit,
  consumeRateLimit,
  recordRateLimitEvent,
  resetRateLimitsForTests,
} from "@/lib/security/rate-limit";

describe(
  "rate-limit sliding window",
  () => {
    beforeEach(() => {
      resetRateLimitsForTests();
    });

    it("enged a limit eléréséig", () => {
      const now = 1000;

      expect(
        consumeRateLimit({
          key: "test:a",
          limit: 2,
          windowMs: 1000,
          now,
        }).allowed,
      ).toBe(true);

      expect(
        consumeRateLimit({
          key: "test:a",
          limit: 2,
          windowMs: 1000,
          now: now + 1,
        }).allowed,
      ).toBe(true);

      expect(
        consumeRateLimit({
          key: "test:a",
          limit: 2,
          windowMs: 1000,
          now: now + 2,
        }).allowed,
      ).toBe(false);
    });

    it("az időablakból kieső eseményt eltávolítja", () => {
      recordRateLimitEvent({
        key: "test:b",
        windowMs: 1000,
        now: 1000,
      });

      expect(
        checkRateLimit({
          key: "test:b",
          limit: 1,
          windowMs: 1000,
          now: 1500,
        }).allowed,
      ).toBe(false);

      expect(
        checkRateLimit({
          key: "test:b",
          limit: 1,
          windowMs: 1000,
          now: 2001,
        }).allowed,
      ).toBe(true);
    });

    it("külön kulcsokat külön bucketként kezel", () => {
      consumeRateLimit({
        key: "ip:1",
        limit: 1,
        windowMs: 1000,
        now: 1000,
      });

      expect(
        consumeRateLimit({
          key: "ip:1",
          limit: 1,
          windowMs: 1000,
          now: 1001,
        }).allowed,
      ).toBe(false);

      expect(
        consumeRateLimit({
          key: "ip:2",
          limit: 1,
          windowMs: 1000,
          now: 1001,
        }).allowed,
      ).toBe(true);
    });

    it("clear után újra enged", () => {
      consumeRateLimit({
        key: "test:c",
        limit: 1,
        windowMs: 1000,
        now: 1000,
      });

      clearRateLimit(
        "test:c",
      );

      expect(
        checkRateLimit({
          key: "test:c",
          limit: 1,
          windowMs: 1000,
          now: 1001,
        }).allowed,
      ).toBe(true);
    });
  },
);
