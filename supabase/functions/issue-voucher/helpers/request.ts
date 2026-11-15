import { z } from "zod";
import { readJsonBody, RequestValidationError } from "../../_shared/http.ts";
import { MAX_BODY_BYTES } from "../constants/request.ts";
import type { VoucherRequest } from "../types/request.ts";

export const VoucherRequestSchema = z.object({
  organizationId: uuid("organizationId"),
  serviceId: uuid("serviceId"),
  /** A real calendar date, today (UTC) or later, as `YYYY-MM-DD`. */
  expiresOn: z.iso
    .date({ error: "expiresOn must be a real YYYY-MM-DD date." })
    .refine((date) => date >= new Date().toISOString().slice(0, 10), {
      error: "expiresOn must not be in the past.",
    }),
  /** Chosen by the caller and reused on a retry of the same request. */
  idempotencyKey: uuid("idempotencyKey"),
}, { error: "The request body must be a valid JSON object." });

/**
 * Throws `RequestValidationError` when the body is not a valid voucher request.
 * Its message lists every invalid field.
 */
export async function readVoucherRequest(
  request: Request,
): Promise<VoucherRequest> {
  const result = VoucherRequestSchema.safeParse(
    await readJsonBody(request, MAX_BODY_BYTES),
  );
  if (!result.success) {
    throw new RequestValidationError(
      result.error.issues.map((issue) => issue.message).join(" "),
    );
  }
  return result.data;
}

function uuid(name: string) {
  return z.guid({ error: `${name} must be a valid UUID.` }).transform((id) =>
    id.toLowerCase()
  );
}
