import { readJsonBody, RequestValidationError } from "../../_shared/http.ts";
import { MAX_BODY_BYTES, UUID_PATTERN } from "../constants.ts";

/** Throws `RequestValidationError` when the body has no valid `userId`. */
export async function readUserId(request: Request): Promise<string> {
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  const userId = typeof body === "object" && body !== null
    ? (body as { userId?: unknown }).userId
    : undefined;
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) {
    throw new RequestValidationError("userId must be a valid UUID.");
  }

  return userId.toLowerCase();
}
