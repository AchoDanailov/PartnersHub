import { readJsonBody, RequestValidationError } from "../../_shared/http.ts";
import {
  DATE_PATTERN,
  MAX_BODY_BYTES,
  MAX_UNIT,
  SHOPIFY_ID_PATTERN,
  UUID_PATTERN,
} from "../constants/request.ts";
import type { VoucherRequest } from "../types.ts";

/** Throws `RequestValidationError` when the body is not a valid voucher request. */
export async function readVoucherRequest(
  request: Request,
): Promise<VoucherRequest> {
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new RequestValidationError("The request body must be a JSON object.");
  }
  const fields = body as Record<string, unknown>;

  return {
    organizationId: readUuid(fields, "organizationId"),
    serviceId: readUuid(fields, "serviceId"),
    expiresOn: readExpiresOn(fields.expiresOn),
    shopifyOrderId: readShopifyId(fields, "shopifyOrderId"),
    shopifyLineItemId: readShopifyId(fields, "shopifyLineItemId"),
    unit: readUnit(fields.unit),
  };
}

function readUuid(fields: Record<string, unknown>, name: string): string {
  const value = fields[name];
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new RequestValidationError(`${name} must be a valid UUID.`);
  }
  return value.toLowerCase();
}

/** A real calendar date, today (UTC) or later, as `YYYY-MM-DD`. */
function readExpiresOn(value: unknown): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new RequestValidationError("expiresOn must be a YYYY-MM-DD date.");
  }
  // Date rolls an impossible day over (2027-02-30 becomes March 2), so a
  // round trip that changes the text means the date does not exist.
  const date = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
  ) {
    throw new RequestValidationError("expiresOn must be a real date.");
  }
  if (value < new Date().toISOString().slice(0, 10)) {
    throw new RequestValidationError("expiresOn must not be in the past.");
  }
  return value;
}

/** Shopify IDs arrive as digit strings or as JSON numbers; both become digit strings. */
function readShopifyId(fields: Record<string, unknown>, name: string): string {
  const value = fields[name];
  const id = typeof value === "number" && Number.isSafeInteger(value)
    ? String(value)
    : value;
  if (typeof id !== "string" || !SHOPIFY_ID_PATTERN.test(id)) {
    throw new RequestValidationError(
      `${name} must be a numeric Shopify ID.`,
    );
  }
  return id;
}

function readUnit(value: unknown): number {
  if (value === undefined) return 1;
  if (
    typeof value !== "number" || !Number.isInteger(value) || value < 1 ||
    value > MAX_UNIT
  ) {
    throw new RequestValidationError(
      `unit must be a whole number from 1 to ${MAX_UNIT}.`,
    );
  }
  return value;
}
