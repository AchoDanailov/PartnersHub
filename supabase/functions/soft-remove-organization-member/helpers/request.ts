import { z } from "zod";
import { readJsonBody, RequestValidationError } from "../../_shared/http.ts";
import { MAX_BODY_BYTES } from "../constants/request.ts";

const INVALID_USER_ID = "userId must be a valid UUID.";

const RemovalRequestSchema = z.object({
  userId: z.guid({ error: INVALID_USER_ID }).transform((id) =>
    id.toLowerCase()
  ),
}, { error: INVALID_USER_ID });

/** Throws `RequestValidationError` when the body has no valid `userId`. */
export async function readUserId(request: Request): Promise<string> {
  const result = RemovalRequestSchema.safeParse(
    await readJsonBody(request, MAX_BODY_BYTES),
  );
  if (!result.success) {
    throw new RequestValidationError(result.error.issues[0].message);
  }

  return result.data.userId;
}
