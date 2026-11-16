import {
  ATTEMPT_WINDOW_MINUTES,
  MAX_FAILED_CODE_ATTEMPTS,
} from "../constants/attempts.ts";
import type { AdminClient } from "../types/context.ts";

/** Whether the member made too many failed typed-code lookups recently. `null` when the count failed. */
export async function isCodeLookupLimited(
  admin: AdminClient,
  userId: string,
  now = new Date(),
): Promise<boolean | null> {
  const since = new Date(now.getTime() - ATTEMPT_WINDOW_MINUTES * 60_000);
  const { count, error } = await admin
    .from("voucher_code_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("attempted_at", since.toISOString());
  if (error) {
    console.error("Attempt count failed:", error.code);
    return null;
  }
  return (count ?? 0) >= MAX_FAILED_CODE_ATTEMPTS;
}

/** Records a failed typed-code lookup. A failure to record is logged, not returned. */
export async function recordFailedCodeLookup(
  admin: AdminClient,
  userId: string,
): Promise<void> {
  const { error } = await admin
    .from("voucher_code_attempts")
    .insert({ user_id: userId });
  if (error) console.error("Attempt record failed:", error.code);
}
