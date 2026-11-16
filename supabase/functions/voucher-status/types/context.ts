import type { SupabaseContext } from "@supabase/server";
import type { Database } from "../../_shared/database.types.ts";

export type VoucherStatusContext = Pick<
  SupabaseContext<Database>,
  "supabaseAdmin"
>;
