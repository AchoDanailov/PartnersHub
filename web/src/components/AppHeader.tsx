import { LayoutDashboard, LogOut } from 'lucide-react'
import { Link } from 'react-router'
import { useViewer } from '../features/auth/useViewer'
import { supabase } from '../lib/supabase'
import { BrandMark } from './BrandMark'

/**
 * The top bar. Over a photo (`overlay`) it is transparent with light text.
 * Signed-in members get the dashboard link (admins only) and sign-out.
 */
export function AppHeader({ overlay = false }: { overlay?: boolean }) {
  const viewer = useViewer()
  const signedIn = viewer.status === 'member' || viewer.status === 'outsider'
  const tone = overlay ? 'text-white hover:bg-white/15' : 'text-ink-soft hover:bg-ink/5'

  return (
    <header
      className={
        overlay
          ? 'absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-ink/60 to-transparent pt-[env(safe-area-inset-top)]'
          : 'border-b border-line bg-white pt-[env(safe-area-inset-top)]'
      }
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandMark light={overlay} />
        {signedIn && (
          <nav className="flex items-center gap-1">
            {viewer.status === 'member' && viewer.member.role === 'admin' && (
              <Link
                to="/dashboard"
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold ${tone}`}
              >
                <LayoutDashboard aria-hidden className="size-4" />
                Табло
              </Link>
            )}
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-semibold ${tone}`}
            >
              <LogOut aria-hidden className="size-4" />
              Изход
            </button>
          </nav>
        )}
      </div>
    </header>
  )
}
