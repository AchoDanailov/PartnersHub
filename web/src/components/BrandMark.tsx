import { Link } from 'react-router'

/** The Partners Hub name with its ticket mark. `light` sits on photos. */
export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <Link
      to="/"
      className={`inline-flex min-h-11 items-center gap-2 font-display text-xl font-bold tracking-wide ${light ? 'text-white' : 'text-ink'}`}
    >
      <svg aria-hidden viewBox="0 0 32 32" className="size-7">
        <path
          fill="#F6C744"
          d="M4 7a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v5a4 4 0 0 0 0 8v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a4 4 0 0 0 0-8z"
        />
        <path stroke="#141A33" strokeWidth="2" strokeDasharray="2 2" d="M20 7v18" />
      </svg>
      Partners Hub
    </Link>
  )
}
