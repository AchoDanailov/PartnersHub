import type { SupabaseContext } from "@supabase/server";
import type { Database, Tables } from "../_shared/database.types.ts";

export type RemovalContext = Pick<
  SupabaseContext<Database>,
  "userClaims" | "supabase" | "supabaseAdmin"
>;

export type Membership = Pick<
  Tables<"organization_members">,
  "user_id" | "organization_id" | "role" | "left_at"
>;
