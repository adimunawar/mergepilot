export type Wait = (milliseconds: number) => Promise<void>;

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set([
  "RESOURCE_EXHAUSTED",
  "INTERNAL",
  "UNAVAILABLE",
  "DEADLINE_EXCEEDED",
]);

function isRetryableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as {
    status?: unknown;
    code?: unknown;
    error?: { status?: unknown; code?: unknown };
  };

  const status = candidate.status ?? candidate.error?.code;
  const code = candidate.code ?? candidate.error?.status;

  return (
    (typeof status === "number" && RETRYABLE_STATUS_CODES.has(status)) ||
    (typeof status === "string" && RETRYABLE_ERROR_CODES.has(status)) ||
    (typeof code === "number" && RETRYABLE_STATUS_CODES.has(code)) ||
    (typeof code === "string" && RETRYABLE_ERROR_CODES.has(code))
  );
}

const sleep: Wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Retries transient provider failures only. Permanent errors (invalid model,
 * authentication, malformed requests) are surfaced immediately.
 */
export async function withTransientRetry<T>(
  operation: () => Promise<T>,
  wait: Wait = sleep,
  maxRetries = 2,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableError(error) || attempt >= maxRetries) {
        throw error;
      }

      const baseDelay = 1_000 * 2 ** attempt;
      const jitter = Math.floor(Math.random() * 250);
      await wait(baseDelay + jitter);
    }
  }
}
