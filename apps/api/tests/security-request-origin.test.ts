import {
  describe,
  expect,
  it,
} from "vitest";
import {
  isTrustedMutationSource,
} from "@/lib/security/request-origin";

const allowedOrigin =
  "http://localhost:3000";

function source(
  overrides: Partial<
    Parameters<
      typeof isTrustedMutationSource
    >[0]
  > = {},
) {
  return {
    method: "POST",
    allowedOrigin,
    origin:
      "http://localhost:3000",
    referer: null,
    secFetchSite: "same-site",
    authorization: null,
    ...overrides,
  };
}

describe(
  "isTrustedMutationSource",
  () => {
    it.each([
      "GET",
      "HEAD",
      "OPTIONS",
    ])(
      "%s safe metódust forrásellenőrzés nélkül enged",
      (method) => {
        expect(
          isTrustedMutationSource(
            source({
              method,
              origin:
                "https://attacker.example",
              secFetchSite:
                "cross-site",
            }),
          ),
        ).toBe(true);
      },
    );

    it("engedélyezi a konfigurált WEB_ORIGIN forrásból érkező POST kérést", () => {
      expect(
        isTrustedMutationSource(
          source(),
        ),
      ).toBe(true);
    });

    it("blokkolja az idegen Origin fejlécet", () => {
      expect(
        isTrustedMutationSource(
          source({
            origin:
              "https://attacker.example",
          }),
        ),
      ).toBe(false);
    });

    it("blokkolja az explicit cross-site Fetch Metadata kérést", () => {
      expect(
        isTrustedMutationSource(
          source({
            secFetchSite:
              "cross-site",
          }),
        ),
      ).toBe(false);
    });

    it("blokkolja az Origin: null unsafe kérést", () => {
      expect(
        isTrustedMutationSource(
          source({
            origin: "null",
          }),
        ),
      ).toBe(false);
    });

    it("Origin hiányában elfogadja a megbízható Referer origint", () => {
      expect(
        isTrustedMutationSource(
          source({
            origin: null,
            referer:
              "http://localhost:3000/projects/demo",
          }),
        ),
      ).toBe(true);
    });

    it("Origin hiányában blokkolja az idegen Referer origint", () => {
      expect(
        isTrustedMutationSource(
          source({
            origin: null,
            referer:
              "https://attacker.example/form",
          }),
        ),
      ).toBe(false);
    });

    it("engedélyezi az Origin nélküli Bearer API klienst", () => {
      expect(
        isTrustedMutationSource(
          source({
            origin: null,
            referer: null,
            secFetchSite: null,
            authorization:
              "Bearer test-token",
          }),
        ),
      ).toBe(true);
    });

    it("blokkolja az unsafe cookie-jellegű kérést, ha sem Origin, sem Referer, sem Bearer nincs", () => {
      expect(
        isTrustedMutationSource(
          source({
            origin: null,
            referer: null,
            secFetchSite: null,
          }),
        ),
      ).toBe(false);
    });

    it("nem fogad el prefix alapú hamis origint", () => {
      expect(
        isTrustedMutationSource(
          source({
            origin:
              "http://localhost:3000.attacker.example",
          }),
        ),
      ).toBe(false);
    });
  },
);
