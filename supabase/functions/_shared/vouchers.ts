import type { Tables } from "./database.types.ts";

/** What a voucher means to the client and to staff, derived from its row. */
export type VoucherState = "valid" | "expired" | "used" | "cancelled";

/** The voucher as both functions return it. Never carries the code or the QR token. */
export interface VoucherView {
  id: string;
  serviceId: string;
  serviceName: string;
  expiresOn: string;
  state: VoucherState;
  redeemedAt: string | null;
}

/** Columns for `VoucherRow`, with the service joined for its name and organization. */
export const VOUCHER_VIEW_COLUMNS =
  "id, service_id, status, expires_on, redeemed_at, redeemed_by, services!inner(name, organization_id)";

export type VoucherRow =
  & Pick<
    Tables<"vouchers">,
    | "id"
    | "service_id"
    | "status"
    | "expires_on"
    | "redeemed_at"
    | "redeemed_by"
  >
  & { services: Pick<Tables<"services">, "name" | "organization_id"> };

/** Today's date in UTC as `YYYY-MM-DD`, the day `expires_on` is compared with. */
export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** A voucher stays valid through its `expires_on` day (UTC). */
export function voucherState(
  voucher: Pick<VoucherRow, "status" | "expires_on">,
  today = todayUtc(),
): VoucherState {
  if (voucher.status === "redeemed") return "used";
  if (voucher.status === "cancelled") return "cancelled";
  return voucher.expires_on < today ? "expired" : "valid";
}

export function toVoucherView(
  row: VoucherRow,
  today = todayUtc(),
): VoucherView {
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceName: row.services.name,
    expiresOn: row.expires_on,
    state: voucherState(row, today),
    redeemedAt: row.redeemed_at,
  };
}
