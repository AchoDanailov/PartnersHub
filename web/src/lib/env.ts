import { z } from 'zod'

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.url({ error: 'VITE_SUPABASE_URL must be a URL.' }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string({ error: 'VITE_SUPABASE_PUBLISHABLE_KEY is not set.' })
    .min(1, { error: 'VITE_SUPABASE_PUBLISHABLE_KEY is not set.' }),
  // The main site where clients buy vouchers. Empty until it is known.
  VITE_MAIN_SITE_URL: z.union([z.literal(''), z.url()]).optional(),
})

const parsed = EnvSchema.safeParse(import.meta.env)
if (!parsed.success) {
  throw new Error(
    `Invalid web/.env.local: ${parsed.error.issues.map((issue) => issue.message).join(' ')}`,
  )
}

export const env = {
  supabaseUrl: parsed.data.VITE_SUPABASE_URL,
  supabasePublishableKey: parsed.data.VITE_SUPABASE_PUBLISHABLE_KEY,
  mainSiteUrl: parsed.data.VITE_MAIN_SITE_URL || null,
}
