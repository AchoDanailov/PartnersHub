import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface Redemption {
  id: string
  serviceId: string
  code: string
  redeemedBy: string
  redeemedAt: string
}

export interface ClientQuestion {
  id: string
  serviceId: string
  question: string
}

export interface DashboardData {
  vouchers: { id: string; serviceId: string; status: string; expiresOn: string }[]
  redemptions: Redemption[]
  usernames: Map<string, string>
  questions: ClientQuestion[]
}

/**
 * Everything the admin dashboard shows, for the admin's organization. RLS and
 * the functions behind it scope every read; codes come only for used vouchers.
 */
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<DashboardData> => {
      const [vouchers, redemptions, profiles, questions] = await Promise.all([
        supabase.from('organization_vouchers').select('id, service_id, status, expires_on'),
        supabase.rpc('get_voucher_redemptions'),
        supabase.from('profiles').select('id, username'),
        supabase.from('service_faqs').select('id, service_id, question, sort_order').order('sort_order'),
      ])
      for (const result of [vouchers, redemptions, profiles, questions]) {
        if (result.error) throw result.error
      }
      return {
        vouchers: (vouchers.data ?? []).flatMap((row) =>
          row.id && row.service_id && row.status && row.expires_on
            ? [{ id: row.id, serviceId: row.service_id, status: row.status, expiresOn: row.expires_on }]
            : [],
        ),
        redemptions: (redemptions.data ?? [])
          .map((row) => ({
            id: row.id,
            serviceId: row.service_id,
            code: row.redemption_code,
            redeemedBy: row.redeemed_by,
            redeemedAt: row.redeemed_at,
          }))
          .sort((a, b) => b.redeemedAt.localeCompare(a.redeemedAt)),
        usernames: new Map((profiles.data ?? []).map((row) => [row.id, row.username])),
        questions: (questions.data ?? []).map((row) => ({
          id: row.id,
          serviceId: row.service_id,
          question: row.question,
        })),
      }
    },
  })
}
