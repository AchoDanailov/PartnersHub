import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { env } from './env'

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey)

export const SERVICE_IMAGES_BUCKET = 'service-images'

/** Public URL of a file in the service-images bucket. */
export function serviceImageUrl(path: string): string {
  return supabase.storage.from(SERVICE_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}
