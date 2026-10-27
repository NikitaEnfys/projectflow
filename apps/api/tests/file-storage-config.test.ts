import {
  describe,
  expect,
  it,
} from "vitest";
import {
  validateAttachment,
} from "@/lib/files/validation";

describe(
  "Supabase Storage canonical MIME",
  () => {
    it("octet-stream TXT inputból canonical text/plain lesz", () => {
      const result =
        validateAttachment({
          name:
            "notes.txt",
          type:
            "application/octet-stream",
          bytes:
            new TextEncoder().encode(
              "hello",
            ),
        });

      expect(
        result.mimeType,
      ).toBe(
        "text/plain",
      );
    });

    it("CSV text/plain inputból canonical text/csv lesz", () => {
      const result =
        validateAttachment({
          name:
            "export.csv",
          type:
            "text/plain",
          bytes:
            new TextEncoder().encode(
              "a,b\n1,2",
            ),
        });

      expect(
        result.mimeType,
      ).toBe(
        "text/csv",
      );
    });
  },
);
