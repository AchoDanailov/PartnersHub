import { withSupabase } from "@supabase/server";
import type { Database } from "../_shared/database.types.ts";
import {
  errorResponse,
  methodNotAllowed,
  RequestValidationError,
} from "../_shared/http.ts";
import { canRemove } from "./helpers/authorization.ts";
import { readUserId } from "./helpers/request.ts";
import {
  forbiddenResponse,
  removalFailedResponse,
} from "./helpers/responses.ts";
import type { RemovalContext } from "./types.ts";

/**
 * Removes a staff member and releases their email so it can be used for a new
 * account. Safe to retry: a repeated removal keeps the original `left_at`, and
 * soft-deleting an already soft-deleted user succeeds.
 *
 * The actor comes from the verified JWT, never from the request body. The
 * caller's RLS-scoped client reads the memberships used to authorize them. The
 * admin client then runs the service_role-only removal, which checks the actor
 * again, and soft-deletes the account.
 */
export async function handleRemoveOrganizationMember(
  request: Request,
  ctx: RemovalContext,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  const actorId = ctx.userClaims?.id?.toLowerCase();
  if (!actorId) {
    return errorResponse(401, "UNAUTHORIZED", "Sign in to remove a member.");
  }

  let userId: string;
  try {
    userId = await readUserId(request);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return errorResponse(400, "INVALID_REQUEST", error.message);
    }
    throw error;
  }
  if (userId === actorId) {
    return errorResponse(400, "INVALID_REQUEST", "You cannot remove yourself.");
  }

  const { data: members, error: lookupError } = await ctx.supabase
    .from("organization_members")
    .select("user_id, organization_id, role, left_at")
    .in("user_id", [actorId, userId]);
  if (lookupError) {
    console.error("Membership lookup failed:", lookupError.code);
    return removalFailedResponse();
  }
  if (!canRemove(members ?? [], actorId, userId)) {
    return forbiddenResponse();
  }

  const { data: leftAt, error: removalError } = await ctx.supabaseAdmin.rpc(
    "remove_organization_member",
    { p_actor_id: actorId, p_user_id: userId },
  );
  if (removalError) {
    // P0001 is the exception raised by the removal function, for example when
    // the actor's role changed after the check above.
    if (removalError.code === "P0001") {
      return forbiddenResponse();
    }
    console.error("Member removal failed:", removalError.code);
    return removalFailedResponse();
  }

  const shouldSoftDelete = true;
  const { error: releaseError } = await ctx.supabaseAdmin.auth.admin.deleteUser(
    userId,
    shouldSoftDelete,
  );
  if (releaseError) {
    console.error("Account soft delete failed:", releaseError.code);
    return errorResponse(
      502,
      "EMAIL_NOT_RELEASED",
      "The member was removed, but their email was not released. Try again.",
    );
  }

  return Response.json({ userId, leftAt });
}

export default {
  fetch: withSupabase<Database>(
    { auth: "user", errors: { detailed: false } },
    handleRemoveOrganizationMember,
  ),
};
