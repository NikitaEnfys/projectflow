export function isRetryableTransactionError(
  error: unknown,
): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }

  const candidate =
    error as {
      code?: unknown;
      originalCode?: unknown;
      kind?: unknown;
      cause?: unknown;
    };

  if (
    candidate.code ===
    "P2034"
  ) {
    return true;
  }

  if (
    candidate.originalCode ===
      "40001" ||
    candidate.kind ===
      "TransactionWriteConflict"
  ) {
    return true;
  }

  return candidate.cause
    ? isRetryableTransactionError(
        candidate.cause,
      )
    : false;
}
