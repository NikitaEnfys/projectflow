import {
  describe,
  expect,
  it,
} from "vitest";
import {
  isRetryableTransactionError,
} from "@/lib/repositories";

describe(
  "isRetryableTransactionError",
  () => {
    it("felismeri a Prisma P2034 hibát", () => {
      expect(
        isRetryableTransactionError({
          code: "P2034",
        }),
      ).toBe(true);
    });

    it("felismeri a PostgreSQL 40001 serialization failure hibát", () => {
      expect(
        isRetryableTransactionError({
          originalCode:
            "40001",
        }),
      ).toBe(true);
    });

    it("felismeri az adapter TransactionWriteConflict hibát", () => {
      expect(
        isRetryableTransactionError({
          kind:
            "TransactionWriteConflict",
        }),
      ).toBe(true);
    });

    it("beágyazott cause hibában is felismeri a retry feltételt", () => {
      expect(
        isRetryableTransactionError({
          cause: {
            originalCode:
              "40001",
          },
        }),
      ).toBe(true);
    });

    it("nem retry-ol ismeretlen hibát", () => {
      expect(
        isRetryableTransactionError({
          code: "P2002",
        }),
      ).toBe(false);
    });

    it("nem retry-ol primitív értéket", () => {
      expect(
        isRetryableTransactionError(
          "failure",
        ),
      ).toBe(false);
    });
  },
);
