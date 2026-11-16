import { z } from "zod";
import { readJsonBody, RequestValidationError } from "../../_shared/http.ts";
import { CODE_PATTERN, MAX_BODY_BYTES } from "../constants/request.ts";
import type { RedeemRequest } from "../types/request.ts";

const guid = (name: string) =>
  z.guid({ error: `${name} must be a valid UUID.` }).transform((id) =>
    id.toLowerCase()
  );

export const RedeemRequestSchema = z.object({
  action: z.enum(["check", "redeem"], {
    error: 'action must be "check" or "redeem".',
  }),
  voucherId: guid("voucherId").optional(),
  qrToken: guid("qrToken").optional(),
  code: z.string({ error: "code must be a string." })
    .transform((code) => code.trim().toUpperCase())
    .refine((code) => CODE_PATTERN.test(code), {
      error: "code must look like BLV-7K2QX9.",
    })
    .optional(),
}, { error: "The request body must be a valid JSON object." })
  .refine(
    (body) => (body.qrToken === undefined) !== (body.code === undefined),
    {
      error: "Send either qrToken or code.",
    },
  )
  .refine((body) => body.action === "check" || body.voucherId !== undefined, {
    error: "voucherId is required to redeem a voucher.",
  })
  .transform((body): RedeemRequest => {
    const reference = body.qrToken !== undefined
      ? { kind: "qr" as const, qrToken: body.qrToken }
      : { kind: "code" as const, code: body.code! };
    return body.action === "check"
      ? { action: "check", reference }
      : { action: "redeem", voucherId: body.voucherId!, reference };
  });

/**
 * Throws `RequestValidationError` when the body is not a valid request.
 * Its message lists every invalid field.
 */
export async function readRedeemRequest(
  request: Request,
): Promise<RedeemRequest> {
  const result = RedeemRequestSchema.safeParse(
    await readJsonBody(request, MAX_BODY_BYTES),
  );
  if (!result.success) {
    throw new RequestValidationError(
      result.error.issues.map((issue) => issue.message).join(" "),
    );
  }
  return result.data;
}
