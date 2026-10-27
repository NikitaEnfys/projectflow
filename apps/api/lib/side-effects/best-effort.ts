type SideEffect = {
  name: string;
  run: () => Promise<unknown>;
};

export async function runBestEffortSideEffects(
  context: string,
  effects: SideEffect[],
) {
  const results =
    await Promise.allSettled(
      effects.map(
        (effect) =>
          effect.run(),
      ),
    );

  const failures =
    results.flatMap(
      (result, index) =>
        result.status ===
        "rejected"
          ? [
              {
                name:
                  effects[index]
                    ?.name ??
                  "unknown",
                reason:
                  result.reason,
              },
            ]
          : [],
    );

  for (
    const failure of failures
  ) {
    console.error(
      `[SIDE_EFFECT_ERROR] ${context} :: ${failure.name}`,
      failure.reason,
    );
  }

  return {
    ok:
      failures.length === 0,
    failures,
  };
}
