import { errorResponse } from "../../_shared/http.ts";
import {
  toVoucherView,
  type VoucherRow,
  voucherState,
} from "../../_shared/vouchers.ts";

export function forbiddenResponse(): Response {
  return errorResponse(
    403,
    "FORBIDDEN",
    "Only current members of an organization can use its vouchers.",
  );
}

export function notFoundResponse(): Response {
  return errorResponse(404, "VOUCHER_NOT_FOUND", "No such voucher.");
}

export function failedResponse(): Response {
  return errorResponse(
    500,
    "REDEMPTION_FAILED",
    "The voucher could not be checked or used. Try again.",
  );
}

/**
 * The answer for a voucher that could not be marked as used. A voucher this
 * member already used answers like the first success, so a retry is safe.
 */
export function unusableResponse(
  voucher: VoucherRow,
  userId: string,
): Response {
  switch (voucherState(voucher)) {
    case "used":
      return voucher.redeemed_by === userId
        ? Response.json({ voucher: toVoucherView(voucher) })
        : errorResponse(
          409,
          "VOUCHER_ALREADY_REDEEMED",
          "The voucher has already been used.",
        );
    case "cancelled":
      return errorResponse(
        409,
        "VOUCHER_CANCELLED",
        "The voucher is cancelled.",
      );
    case "expired":
      return errorResponse(409, "VOUCHER_EXPIRED", "The voucher has expired.");
    case "valid":
      return failedResponse();
  }
}
