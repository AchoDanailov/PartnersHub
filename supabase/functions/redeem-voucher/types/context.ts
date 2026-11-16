import type { SupabaseContext } from "@supabase/server";
import type { Database } from "../../_shared/database.types.ts";

export type RedeemContext = Pick<
  SupabaseContext<Database>,
  "userClaims" | "supabase" | "supabaseAdmin"
>;

export type AdminClient = RedeemContext["supabaseAdmin"];
