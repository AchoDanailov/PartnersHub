import {
  VOUCHER_VIEW_COLUMNS,
  type VoucherRow,
} from "../../_shared/vouchers.ts";
import type { AdminClient } from "../types/context.ts";
import type { VoucherReference } from "../types/request.ts";

export type VoucherLookup =
  | { status: "found"; voucher: VoucherRow }
  | { status: "not_found" }
  | { status: "failed" };

/**
 * Finds a voucher by QR token or code, and by id when one is given. The admin
 * client is needed because members cannot read `qr_token` or `redemption_code`.
 */
export async function findVoucher(
  admin: AdminClient,
  reference: VoucherReference,
  voucherId?: string,
): Promise<VoucherLookup> {
  let query = admin.from("vouchers").select(VOUCHER_VIEW_COLUMNS);
  query = reference.kind === "qr"
    ? query.eq("qr_token", reference.qrToken)
    : query.eq("redemption_code", reference.code);
  if (voucherId) query = query.eq("id", voucherId);

  const { data, error } = await query.maybeSingle<VoucherRow>();
  if (error) {
    console.error("Voucher lookup failed:", error.code);
    return { status: "failed" };
  }
  return data ? { status: "found", voucher: data } : { status: "not_found" };
}

export type MarkRedeemedResult =
  | { status: "redeemed"; voucher: VoucherRow }
  | { status: "unchanged" }
  | { status: "not_member" }
  | { status: "failed" };

/**
 * Marks an active, unexpired voucher as used by the member. One conditional
 * update, so when two people use the same voucher at once only one succeeds;
 * the other gets `unchanged`.
 */
export async function markRedeemed(
  admin: AdminClient,
  voucherId: string,
  userId: string,
  today: string,
): Promise<MarkRedeemedResult> {
  const { data, error } = await admin
    .from("vouchers")
    .update({
      status: "redeemed",
      redeemed_by: userId,
      redeemed_at: new Date().toISOString(),
    })
    .eq("id", voucherId)
    .eq("status", "active")
    .gte("expires_on", today)
    .select(VOUCHER_VIEW_COLUMNS)
    .maybeSingle<VoucherRow>();
  if (error) {
    // P0001 is raised by the trigger that requires a current member of the
    // service's organization, for example when the member just left.
    if (error.code === "P0001") return { status: "not_member" };
    console.error("Voucher update failed:", error.code);
    return { status: "failed" };
  }
  return data ? { status: "redeemed", voucher: data } : { status: "unchanged" };
}
