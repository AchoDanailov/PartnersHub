import { MAX_CODE_ATTEMPTS } from "../constants/code.ts";
import type {
  AdminClient,
  SaveVoucherResult,
  ServiceLookup,
  VoucherRequest,
} from "../types.ts";
import { generateRedemptionCode } from "./code.ts";

const VOUCHER_COLUMNS = "id, redemption_code, service_id, expires_on";
const SHOPIFY_REFERENCE_COLUMNS =
  "shopify_order_id,shopify_line_item_id,shopify_line_item_unit";

/** Checks that the service exists in the organization and that the organization is active. */
export async function findService(
  admin: AdminClient,
  organizationId: string,
  serviceId: string,
): Promise<ServiceLookup> {
  const { data: service, error } = await admin
    .from("services")
    .select("id, organizations!inner(deactivated_at)")
    .eq("id", serviceId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) {
    console.error("Service lookup failed:", error.code);
    return { status: "failed" };
  }
  if (!service) return { status: "not_found" };
  if (service.organizations.deactivated_at) {
    return { status: "organization_deactivated" };
  }
  return { status: "found" };
}

/**
 * Creates the voucher, or returns the one already created for the same
 * Shopify order, line item and unit. The database decides which, through the
 * unique Shopify reference, so two calls at the same moment still produce one
 * voucher.
 */
export async function saveVoucher(
  admin: AdminClient,
  request: VoucherRequest,
): Promise<SaveVoucherResult> {
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
    // Inserts nothing and returns no row when the Shopify reference exists.
    const { data: created, error } = await admin
      .from("vouchers")
      .upsert(
        {
          redemption_code: generateRedemptionCode(),
          service_id: request.serviceId,
          expires_on: request.expiresOn,
          shopify_order_id: request.shopifyOrderId,
          shopify_line_item_id: request.shopifyLineItemId,
          shopify_line_item_unit: request.unit,
        },
        { onConflict: SHOPIFY_REFERENCE_COLUMNS, ignoreDuplicates: true },
      )
      .select(VOUCHER_COLUMNS);

    if (error) {
      // 23505 can only be the redemption code here: a repeated Shopify
      // reference is skipped above instead of raising. Try another code.
      if (error.code === "23505") continue;
      // P0001 is raised by the trigger that blocks deactivated organizations.
      if (error.code === "P0001") return { status: "organization_deactivated" };
      console.error("Voucher insert failed:", error.code);
      return { status: "failed" };
    }
    if (created.length > 0) return { status: "created", voucher: created[0] };

    return await findExistingVoucher(admin, request);
  }

  console.error("Voucher insert failed: no free redemption code found.");
  return { status: "failed" };
}

async function findExistingVoucher(
  admin: AdminClient,
  request: VoucherRequest,
): Promise<SaveVoucherResult> {
  const { data: existing, error } = await admin
    .from("vouchers")
    .select(VOUCHER_COLUMNS)
    .eq("shopify_order_id", request.shopifyOrderId)
    .eq("shopify_line_item_id", request.shopifyLineItemId)
    .eq("shopify_line_item_unit", request.unit)
    .maybeSingle();
  if (error || !existing) {
    console.error("Existing voucher lookup failed:", error?.code ?? "no row");
    return { status: "failed" };
  }
  if (
    existing.service_id !== request.serviceId ||
    existing.expires_on !== request.expiresOn
  ) {
    return { status: "conflict" };
  }
  return { status: "existing", voucher: existing };
}
