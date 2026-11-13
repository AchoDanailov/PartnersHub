import { withSupabase } from "@supabase/server";
import type { Database } from "../_shared/database.types.ts";
import {
  errorResponse,
  methodNotAllowed,
  RequestValidationError,
} from "../_shared/http.ts";
import { QR_BUCKET } from "./constants/qr-code.ts";
import { isTrustedCaller } from "./helpers/caller.ts";
import { generateQrCode } from "./helpers/qr-code.ts";
import { readVoucherRequest } from "./helpers/request.ts";
import {
  issueFailedResponse,
  organizationDeactivatedResponse,
} from "./helpers/responses.ts";
import { buildRedemptionUrl, readWebAppUrl } from "./helpers/url.ts";
import { findService, saveVoucher } from "./helpers/vouchers.ts";
import type {
  IssueVoucherContext,
  SaveVoucherResult,
  VoucherRequest,
} from "./types.ts";

/**
 * Issues a voucher for a sale: generates its redemption code, saves it, and
 * stores a QR code that opens the service page with that code.
 *
 * `withSupabase` runs with `auth: "none"`, so this handler authenticates the
 * caller itself, through the issuer secret header, before anything else.
 *
 * Safe to retry: a repeated call for the same Shopify order, line item and
 * unit returns the first voucher and stores its QR code again, which also
 * repairs a QR upload that failed the first time.
 */
export async function handleIssueVoucher(
  request: Request,
  ctx: IssueVoucherContext,
): Promise<Response> {
  if (!(await isTrustedCaller(request))) {
    return errorResponse(
      401,
      "UNAUTHORIZED",
      "A valid issuer secret is required.",
    );
  }
  if (request.method !== "POST") return methodNotAllowed("POST");

  let voucherRequest: VoucherRequest;
  try {
    voucherRequest = await readVoucherRequest(request);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return errorResponse(400, "INVALID_REQUEST", error.message);
    }
    throw error;
  }

  // Read before writing anything, so a voucher is never saved without a QR code.
  let webAppUrl: URL;
  try {
    webAppUrl = readWebAppUrl();
  } catch {
    console.error("The web app URL is missing or invalid.");
    return issueFailedResponse();
  }

  const service = await findService(
    ctx.supabaseAdmin,
    voucherRequest.organizationId,
    voucherRequest.serviceId,
  );
  if (service.status === "failed") return issueFailedResponse();
  if (service.status === "not_found") {
    return errorResponse(
      404,
      "SERVICE_NOT_FOUND",
      "The service does not exist in that organization.",
    );
  }
  if (service.status === "organization_deactivated") {
    return organizationDeactivatedResponse();
  }

  const saved: SaveVoucherResult = await saveVoucher(
    ctx.supabaseAdmin,
    voucherRequest,
  );
  if (saved.status === "failed") return issueFailedResponse();
  if (saved.status === "organization_deactivated") {
    return organizationDeactivatedResponse();
  }
  if (saved.status === "conflict") {
    return errorResponse(
      409,
      "IDEMPOTENCY_CONFLICT",
      "A voucher with a different service or expiry already exists for this order, line item and unit.",
    );
  }
  const { voucher } = saved;

  let png: Uint8Array;
  try {
    png = await generateQrCode(
      buildRedemptionUrl(
        webAppUrl,
        voucher.service_id,
        voucher.redemption_code,
      ),
    );
  } catch (error) {
    console.error(
      "QR code generation failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return errorResponse(
      500,
      "QR_GENERATION_FAILED",
      "The voucher was saved, but its QR code could not be generated. Try again.",
    );
  }

  const qrPath = `${voucher.id}.png`;
  const { error: uploadError } = await ctx.supabaseAdmin.storage
    .from(QR_BUCKET)
    .upload(qrPath, png, { contentType: "image/png", upsert: true });
  if (uploadError) {
    console.error("QR code upload failed:", uploadError.name);
    return errorResponse(
      502,
      "QR_UPLOAD_FAILED",
      "The voucher was saved, but its QR code was not stored. Try again.",
    );
  }

  return Response.json(
    {
      voucherId: voucher.id,
      serviceId: voucher.service_id,
      expiresOn: voucher.expires_on,
      qrPath,
    },
    { status: saved.status === "created" ? 201 : 200 },
  );
}

export default {
  fetch: withSupabase<Database>(
    { auth: "none", errors: { detailed: false } },
    handleIssueVoucher,
  ),
};
