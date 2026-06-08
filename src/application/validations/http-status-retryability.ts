/**
 * HTTP Status Retryability
 * @description Decides whether a given HTTP status code should be retried.
 *
 * Retryable:
 * - 429 Too Many Requests
 * - 5xx Server errors (transient)
 *
 * Non-retryable:
 * - 4xx Client errors (except 429) — likely permanent
 * - 2xx Success (should not reach this code)
 * - 3xx Redirects (caller should follow)
 * - 1xx Informational
 */
export function isRetryableHttpStatus(statusCode: number): boolean {
  if (!Number.isInteger(statusCode) || statusCode < 100) return false;
  if (statusCode === 429) return true;
  if (statusCode >= 500 && statusCode < 600) return true;
  return false;
}

/**
 * Network-level failures (no status code received) are always retryable
 * since the request didn't even reach a server decision.
 */
export function isNetworkLevelFailure(statusCode: number): boolean {
  return statusCode === 0;
}
