import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { AuthContext } from './auth-context'

/**
 * Keeps the Supabase session in React state. Signing in or out clears every
 * cached query, because what a viewer may read depends on who they are.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    let currentUserId: string | null | undefined
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextUserId = next?.user.id ?? null
      if (currentUserId !== undefined && currentUserId !== nextUserId) {
        queryClient.clear()
      }
      currentUserId = nextUserId
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <AuthContext value={{ session }}>{children}</AuthContext>
}
