import type { Session } from '@supabase/supabase-js'
import { createContext } from 'react'

export interface AuthState {
  /** `undefined` while the stored session is being read. */
  session: Session | null | undefined
}

export const AuthContext = createContext<AuthState>({ session: undefined })
