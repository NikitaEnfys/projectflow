import {
  describe,
  expect,
  it,
} from "vitest";
import {
  AttachmentValidationError,
  validateAttachment,
} from "@/lib/files/validation";

function bytes(
  values: number[],
) {
  return new Uint8Array(
    values,
  );
}

describe(
  "attachment validation",
  () => {
    it("elfogad egy PDF szignatúrát", () => {
      expect(
        validateAttachment({
          name:
            "specifikacio.pdf",
          type:
            "application/pdf",
          bytes: bytes([
            0x25,
            0x50,
            0x44,
            0x46,
            0x2d,
            0x31,
          ]),
        }).extension,
      ).toBe(".pdf");
    });

    it("elutasítja a spoofolt PDF-et", () => {
      expect(() =>
        validateAttachment({
          name:
            "fake.pdf",
          type:
            "application/pdf",
          bytes:
            new TextEncoder().encode(
              "<script>alert(1)</script>",
            ),
        }),
      ).toThrow(
        AttachmentValidationError,
      );
    });

    it("elutasítja a nem engedélyezett kiterjesztést", () => {
      expect(() =>
        validateAttachment({
          name:
            "payload.html",
          type:
            "text/html",
          bytes:
            new TextEncoder().encode(
              "<html></html>",
            ),
        }),
      ).toThrow(
        /PDF, PNG/,
      );
    });

    it("elutasítja a tiltott fájlnév karaktert", () => {
      expect(() =>
        validateAttachment({
          name:
            "../secret.txt",
          type:
            "text/plain",
          bytes:
            new TextEncoder().encode(
              "hello",
            ),
        }),
      ).toThrow(
        /tiltott karakter/,
      );
    });

    it("elfogad UTF-8 txt fájlt", () => {
      expect(
        validateAttachment({
          name:
            "megjegyzes.txt",
          type:
            "text/plain",
          bytes:
            new TextEncoder().encode(
              "árvíztűrő tükörfúrógép",
            ),
        }).mimeType,
      ).toBe("text/plain");
    });

    it("elutasítja a NUL byte-ot tartalmazó txt fájlt", () => {
      expect(() =>
        validateAttachment({
          name:
            "binary.txt",
          type:
            "text/plain",
          bytes:
            bytes([
              65,
              0,
              66,
            ]),
        }),
      ).toThrow(
        /tartalma nem egyezik/,
      );
    });
  },
);
