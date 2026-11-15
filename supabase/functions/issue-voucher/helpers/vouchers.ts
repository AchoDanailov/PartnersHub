import { MAX_CODE_ATTEMPTS } from "../constants/code.ts";
import { IDEMPOTENCY_COLUMN, VOUCHER_COLUMNS } from "../constants/vouchers.ts";
import type { AdminClient } from "../types/context.ts";
import type { VoucherRequest } from "../types/request.ts";
import type { SaveVoucherResult, ServiceLookup } from "../types/vouchers.ts";
import { generateRedemptionCode } from "./code.ts";

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
 * Creates the voucher, or returns the one already created with the same
 * idempotency key. The database decides which, through the unique key, so two
 * calls at the same moment still produce one voucher.
 */
export async function saveVoucher(
  admin: AdminClient,
  request: VoucherRequest,
): Promise<SaveVoucherResult> {
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
    // Inserts nothing and returns no row when the idempotency key exists.
    const { data: created, error } = await admin
      .from("vouchers")
      .upsert(
        {
          redemption_code: generateRedemptionCode(),
          service_id: request.serviceId,
          expires_on: request.expiresOn,
          idempotency_key: request.idempotencyKey,
        },
        { onConflict: IDEMPOTENCY_COLUMN, ignoreDuplicates: true },
      )
      .select(VOUCHER_COLUMNS);

    if (error) {
      // 23505 can only be the redemption code here: a repeated idempotency
      // key is skipped above instead of raising. Try another code.
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
    .eq(IDEMPOTENCY_COLUMN, request.idempotencyKey)
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
