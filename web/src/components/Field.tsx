import { useId, type ComponentProps } from 'react'

/** A labelled text input. The label stays visible; placeholders are never the label. */
export function Field({ label, className = '', ...props }: ComponentProps<'input'> & { label: string }) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        className="min-h-12 rounded-xl border border-ink/20 bg-white px-4 text-base outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/25"
        {...props}
      />
    </div>
  )
}
