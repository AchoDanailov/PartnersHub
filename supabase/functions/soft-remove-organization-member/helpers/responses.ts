import { errorResponse } from "../../_shared/http.ts";

export function forbiddenResponse(): Response {
  return errorResponse(403, "FORBIDDEN", "You cannot remove this member.");
}

export function removalFailedResponse(): Response {
  return errorResponse(
    500,
    "REMOVAL_FAILED",
    "The member could not be removed.",
  );
}
