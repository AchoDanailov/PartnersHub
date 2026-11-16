import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export function PageLoading() {
  return (
    <div className="grid min-h-svh place-items-center" role="status">
      <LoaderCircle aria-hidden className="size-8 animate-spin text-indigo" />
      <span className="sr-only">Зареждане…</span>
    </div>
  )
}

export function PageMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[60svh] max-w-md flex-col justify-center gap-4 px-4 py-16">
      <h1 className="font-display text-4xl font-bold">{title}</h1>
      {children}
    </div>
  )
}
