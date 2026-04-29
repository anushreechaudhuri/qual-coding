/**
 * Shared error response type used by all API route proxies (Gemini, Reducto).
 * Ensures consistent error handling on the client side.
 */

export type ApiErrorCode = "auth" | "rate_limit" | "upstream_error" | "validation";

export interface ApiErrorResponse {
  error: string;
  code: ApiErrorCode;
  retryable: boolean;
}

export function isApiError(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    "code" in value &&
    "retryable" in value
  );
}
