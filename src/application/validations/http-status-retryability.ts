export function isRetryableHttpStatus(statusCode: number): boolean {
  if (!Number.isInteger(statusCode) || statusCode < 100) return false;
  if (statusCode === 429) return true;
  if (statusCode >= 500 && statusCode < 600) return true;
  return false;
}

export function isNetworkLevelFailure(statusCode: number): boolean {
  return statusCode === 0;
}
