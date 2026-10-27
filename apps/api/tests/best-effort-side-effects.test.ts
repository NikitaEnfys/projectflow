import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  runBestEffortSideEffects,
} from "@/lib/side-effects/best-effort";

describe(
  "runBestEffortSideEffects",
  () => {
    it("minden side effectet lefuttat", async () => {
      const first =
        vi.fn().mockResolvedValue(
          "ok",
        );
      const second =
        vi.fn().mockResolvedValue(
          "ok",
        );

      const result =
        await runBestEffortSideEffects(
          "test",
          [
            {
              name: "first",
              run: first,
            },
            {
              name: "second",
              run: second,
            },
          ],
        );

      expect(first).toHaveBeenCalledOnce();
      expect(second).toHaveBeenCalledOnce();
      expect(result.ok).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it("egy side effect hibája nem dobja tovább a hibát", async () => {
      const consoleError =
        vi.spyOn(
          console,
          "error",
        ).mockImplementation(
          () => {},
        );

      const result =
        await runBestEffortSideEffects(
          "test",
          [
            {
              name: "broken",
              run: async () => {
                throw new Error(
                  "secondary failure",
                );
              },
            },
            {
              name: "working",
              run: async () =>
                "ok",
            },
          ],
        );

      expect(result.ok).toBe(false);
      expect(result.failures).toHaveLength(1);
      expect(
        result.failures[0]?.name,
      ).toBe("broken");

      consoleError.mockRestore();
    });
  },
);
