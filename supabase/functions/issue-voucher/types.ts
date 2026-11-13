import type { SupabaseContext } from "@supabase/server";
import type { Database, Tables } from "../_shared/database.types.ts";

export type IssueVoucherContext = Pick<
  SupabaseContext<Database>,
  "supabaseAdmin"
>;

export type AdminClient = IssueVoucherContext["supabaseAdmin"];

/** The validated request body. `unit` is the 1-based unit of the line item. */
export interface VoucherRequest {
  organizationId: string;
  serviceId: string;
  expiresOn: string;
  shopifyOrderId: string;
  shopifyLineItemId: string;
  unit: number;
}

export type IssuedVoucher = Pick<
  Tables<"vouchers">,
  "id" | "redemption_code" | "service_id" | "expires_on"
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
