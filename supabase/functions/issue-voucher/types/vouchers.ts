import type { Tables } from "../../_shared/database.types.ts";

export type IssuedVoucher = Pick<
  Tables<"vouchers">,
  "id" | "service_id" | "expires_on" | "qr_token"
>;

export type ServiceLookup =
  | { status: "found" }
  | { status: "not_found" }
  | { status: "organization_deactivated" }
  | { status: "failed" };

export type SaveVoucherResult =
  | { status: "created" | "existing"; voucher: IssuedVoucher }
  | { status: "organization_deactivated" }
  | { status: "conflict" }
  | { status: "failed" };
