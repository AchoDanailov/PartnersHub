import type { Membership } from "../types.ts";

/**
 * The actor must be a current admin of the target's organization, and the
 * target must be staff. The target's `left_at` is ignored so retries still pass.
 */
export function canRemove(
  members: Membership[],
  actorId: string,
  userId: string,
): boolean {
  const actor = members.find((member) => member.user_id === actorId);
  const target = members.find((member) => member.user_id === userId);

  return actor?.role === "admin" &&
    actor.left_at === null &&
    target?.role === "staff" &&
    target.organization_id === actor.organization_id;
}
