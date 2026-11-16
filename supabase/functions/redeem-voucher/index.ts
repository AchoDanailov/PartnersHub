import { withSupabase } from "@supabase/server";
import type { Database } from "../_shared/database.types.ts";
import {
  errorResponse,
  methodNotAllowed,
  RequestValidationError,
} from "../_shared/http.ts";
import { todayUtc, toVoucherView } from "../_shared/vouchers.ts";
import {
  isCodeLookupLimited,
  recordFailedCodeLookup,
} from "./helpers/attempts.ts";
import { readRedeemRequest } from "./helpers/request.ts";
import {
  failedResponse,
  forbiddenResponse,
  notFoundResponse,
  unusableResponse,
} from "./helpers/responses.ts";
import { findVoucher, markRedeemed } from "./helpers/vouchers.ts";
import type { RedeemContext } from "./types/context.ts";
import type { RedeemRequest } from "./types/request.ts";

/**
 * Checks a voucher by its typed code, or uses a voucher, for a signed-in
 * current member of the voucher's organization.
 *
 * The member comes from the verified JWT and their membership is read through
 * their own RLS-scoped client. The admin client then finds the voucher, because
 * members cannot read QR tokens or codes. A voucher of another organization
 * answers 404, like a missing one. Failed typed-code lookups are limited per
 * member, so codes cannot be guessed at scale.
 *
 * Safe to retry: using a voucher the same member already used returns it again.
 */
export async function handleRedeemVoucher(
  request: Request,
  ctx: RedeemContext,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const userId = ctx.userClaims?.id?.toLowerCase();
  if (!userId) {
    return errorResponse(401, "UNAUTHORIZED", "Sign in to use a voucher.");
  }

  let body: RedeemRequest;
  try {
    body = await readRedeemRequest(request);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return errorResponse(400, "INVALID_REQUEST", error.message);
    }
    throw error;
  }

  const { data: membership, error: membershipError } = await ctx.supabase
    .from("organization_members")
    .select("organization_id, left_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipError) {
    console.error("Membership lookup failed:", membershipError.code);
    return failedResponse();
  }
  if (!membership || membership.left_at !== null) return forbiddenResponse();

  const byCode = body.reference.kind === "code";
  if (byCode) {
    const limited = await isCodeLookupLimited(ctx.supabaseAdmin, userId);
    if (limited === null) return failedResponse();
    if (limited) {
      return errorResponse(
        429,
        "TOO_MANY_ATTEMPTS",
        "Too many wrong codes. Try again in a few minutes.",
      );
    }
  }

  const lookup = await findVoucher(
    ctx.supabaseAdmin,
    body.reference,
    body.action === "redeem" ? body.voucherId : undefined,
  );
  if (lookup.status === "failed") return failedResponse();
  if (
    lookup.status === "not_found" ||
    lookup.voucher.services.organization_id !== membership.organization_id
  ) {
    if (byCode) await recordFailedCodeLookup(ctx.supabaseAdmin, userId);
    return notFoundResponse();
  }
  const { voucher } = lookup;

  if (body.action === "check") {
    return Response.json({ voucher: toVoucherView(voucher) });
  }

  const today = todayUtc();
  const result = await markRedeemed(
    ctx.supabaseAdmin,
    voucher.id,
    userId,
    today,
  );
  switch (result.status) {
    case "redeemed":
      return Response.json({ voucher: toVoucherView(result.voucher, today) });
    case "not_member":
      return forbiddenResponse();
    case "failed":
      return failedResponse();
    case "unchanged": {
      // Not active or expired: read it again, because another request may have
      // used it between the lookup and the update.
      const current = await findVoucher(
        ctx.supabaseAdmin,
        body.reference,
        voucher.id,
      );
      if (current.status !== "found") return failedResponse();
      return unusableResponse(current.voucher, userId);
    }
  }
}

export default {
  fetch: withSupabase<Database>(
    { auth: "user", errors: { detailed: false } },
    handleRedeemVoucher,
  ),
};
