import type { SupabaseContext } from "@supabase/server";
import type { Database } from "../../_shared/database.types.ts";

export type IssueVoucherContext = Pick<
  SupabaseContext<Database>,
  "supabaseAdmin"
>;

export type AdminClient = IssueVoucherContext["supabaseAdmin"];
