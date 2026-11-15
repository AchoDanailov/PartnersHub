import type { Tables } from "../../_shared/database.types.ts";

export type Membership = Pick<
  Tables<"organization_members">,
  "user_id" | "organization_id" | "role" | "left_at"
>;
