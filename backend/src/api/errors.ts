/**
 * API error envelope — API_SPEC §3: { error: { code, message, request_id } }.
 * Messages are generic; detailed reasons go to the audit/operational log only,
 * never into the response (API_SPEC §3, SECURITY.md §6).
 */
export type ErrorCode =
  | "invalid_request"
  | "unauthenticated"
  | "fresh_auth_required"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "too_large"
  | "unprocessable"
  | "rate_limited"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  invalid_request: 400,
  unauthenticated: 401,
  fresh_auth_required: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  too_large: 413,
  unprocessable: 422,
  rate_limited: 429,
  internal: 500,
};

/** Generic messages only — no internal detail ever reaches the client. */
const MESSAGE: Record<ErrorCode, string> = {
  invalid_request: "Invalid request.",
  unauthenticated: "Sign in to continue.",
  fresh_auth_required: "Confirm with your passkey to continue.",
  forbidden: "You can't do that.",
  not_found: "Not found.",
  conflict: "That conflicts with the current state.",
  too_large: "Request too large.",
  unprocessable: "That request can't be processed.",
  rate_limited: "Too many requests. Try again shortly.",
  internal: "Something went wrong.",
};

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  /** Optional Retry-After seconds for 429. */
  retryAfter?: number;

  constructor(code: ErrorCode, retryAfter?: number) {
    super(MESSAGE[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
    this.retryAfter = retryAfter;
  }
}

export function errorBody(code: ErrorCode, requestId: string): unknown {
  return { error: { code, message: MESSAGE[code], request_id: requestId } };
}
