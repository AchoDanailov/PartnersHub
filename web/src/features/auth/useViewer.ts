import { useQuery } from '@tanstack/react-query'
import { useContext } from 'react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { AuthContext } from './auth-context'

export interface Member {
  userId: string
  username: string
  role: Database['public']['Enums']['organization_role']
  organizationId: string
  organizationName: string
}

/**
 * Who is looking at the page:
 * - `anonymous`: not signed in, the usual client;
 * - `member`: a current staff member or admin of an organization;
 * - `outsider`: signed in, but not a current member of any organization.
 */
export type Viewer =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'member'; member: Member }
  | { status: 'outsider' }

export function useViewer(): Viewer {
  const { session } = useContext(AuthContext)
  const userId = session?.user.id

  const membership = useQuery({
    queryKey: ['membership', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Member | null> => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('role, organization_id, left_at, organizations(name), profiles(username)')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      if (!data || data.left_at !== null || !data.organizations) return null
      return {
        userId: userId!,
        username: data.profiles?.username ?? '',
        role: data.role,
        organizationId: data.organization_id,
        organizationName: data.organizations.name,
      }
    },
  })

  if (session === undefined) return { status: 'loading' }
  if (session === null) return { status: 'anonymous' }
  if (membership.isPending) return { status: 'loading' }
  if (membership.data) return { status: 'member', member: membership.data }
  return { status: 'outsider' }
}
