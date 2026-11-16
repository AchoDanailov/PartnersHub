import { errorResponse } from "../../_shared/http.ts";

export function issueFailedResponse(): Response {
  return errorResponse(
    500,
    "VOUCHER_ISSUE_FAILED",
    "The voucher could not be issued.",
  );
}

export function organizationDeactivatedResponse(): Response {
  return errorResponse(
    409,
    "ORGANIZATION_DEACTIVATED",
    "The organization is deactivated.",
  );
}
