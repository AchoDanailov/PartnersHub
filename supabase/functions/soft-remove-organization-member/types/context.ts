import type { SupabaseContext } from "@supabase/server";
import type { Database } from "../../_shared/database.types.ts";

export type RemovalContext = Pick<
  SupabaseContext<Database>,
  "userClaims" | "supabase" | "supabaseAdmin"
>;
