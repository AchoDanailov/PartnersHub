import { withSupabase } from "@supabase/server";
import type { Database } from "../_shared/database.types.ts";
import {
  errorResponse,
  methodNotAllowed,
  RequestValidationError,
} from "../_shared/http.ts";
import {
  toVoucherView,
  VOUCHER_VIEW_COLUMNS,
  type VoucherRow,
} from "../_shared/vouchers.ts";
import { readQrToken } from "./helpers/request.ts";
import type { VoucherStatusContext } from "./types/context.ts";

/**
 * Tells anyone holding a voucher's QR link whether the voucher is valid, used,
 * expired or cancelled. A QR token is a random UUID, too long to guess, so the
 * endpoint is public and not rate limited. The redemption code is never returned.
 */
export async function handleVoucherStatus(
  request: Request,
  ctx: VoucherStatusContext,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  let qrToken: string;
  try {
    qrToken = await readQrToken(request);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return errorResponse(400, "INVALID_REQUEST", error.message);
    }
    throw error;
  }

  // anon and authenticated cannot read qr_token, so the lookup needs the admin client.
  const { data: voucher, error } = await ctx.supabaseAdmin
    .from("vouchers")
    .select(VOUCHER_VIEW_COLUMNS)
    .eq("qr_token", qrToken)
    .maybeSingle<VoucherRow>();
  if (error) {
    console.error("Voucher lookup failed:", error.code);
    return errorResponse(
      500,
      "VOUCHER_LOOKUP_FAILED",
      "The voucher could not be checked.",
    );
  }
  if (!voucher) {
    return errorResponse(404, "VOUCHER_NOT_FOUND", "No such voucher.");
  }

  return Response.json({ voucher: toVoucherView(voucher) });
}

export default {
  fetch: withSupabase<Database>(
    { auth: "publishable", errors: { detailed: false } },
    handleVoucherStatus,
  ),
};
