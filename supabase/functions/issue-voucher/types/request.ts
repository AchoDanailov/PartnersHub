import type { z } from "zod";
import type { VoucherRequestSchema } from "../helpers/request.ts";

/** The validated request body. */
export type VoucherRequest = z.output<typeof VoucherRequestSchema>;
