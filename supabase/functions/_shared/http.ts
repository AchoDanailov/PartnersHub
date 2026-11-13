export type ErrorCode =
  | "INVALID_REQUEST"
  | "METHOD_NOT_ALLOWED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SERVICE_NOT_FOUND"
  | "ORGANIZATION_DEACTIVATED"
  | "IDEMPOTENCY_CONFLICT"
  | "VOUCHER_ISSUE_FAILED"
  | "QR_GENERATION_FAILED"
  | "QR_UPLOAD_FAILED"
  | "REMOVAL_FAILED"
  | "EMAIL_NOT_RELEASED";

/** Same flat shape as the auth errors returned by `@supabase/server`. */
export interface ErrorBody {
  code: ErrorCode;
  message: string;
}

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

const encoder = new TextEncoder();

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  headers?: HeadersInit,
): Response {
  const body: ErrorBody = { code, message };
  return Response.json(body, { status, headers });
}

export function methodNotAllowed(allowed: string): Response {
  return errorResponse(405, "METHOD_NOT_ALLOWED", `Use ${allowed}.`, {
    Allow: allowed,
  });
}

/**
 * Reads an `application/json` body of at most `maxBytes` UTF-8 bytes.
 * Throws `RequestValidationError` for a wrong content type, an oversized body,
 * or invalid JSON.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const contentType = request.headers.get("Content-Type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new RequestValidationError(
      "Content-Type must be application/json.",
    );
  }

  const contentLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new RequestValidationError("The JSON body is too large.");
  }

  const body = await request.text();
  if (encoder.encode(body).length > maxBytes) {
    throw new RequestValidationError("The JSON body is too large.");
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new RequestValidationError("The request body must be valid JSON.");
  }
}
