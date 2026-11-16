import { z } from "zod";
import { readJsonBody, RequestValidationError } from "../../_shared/http.ts";
import { MAX_BODY_BYTES } from "../constants/request.ts";

const INVALID_QR_TOKEN = "qrToken must be a valid UUID.";

const StatusRequestSchema = z.object({
  qrToken: z.guid({ error: INVALID_QR_TOKEN }).transform((token) =>
    token.toLowerCase()
  ),
}, { error: INVALID_QR_TOKEN });

/** Throws `RequestValidationError` when the body has no valid `qrToken`. */
export async function readQrToken(request: Request): Promise<string> {
  const result = StatusRequestSchema.safeParse(
    await readJsonBody(request, MAX_BODY_BYTES),
  );
  if (!result.success) {
    throw new RequestValidationError(result.error.issues[0].message);
  }
  return result.data.qrToken;
}
