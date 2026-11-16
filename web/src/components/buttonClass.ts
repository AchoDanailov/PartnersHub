export type Variant = 'primary' | 'ticket' | 'ink' | 'outline' | 'quiet'
export type Size = 'md' | 'lg'

const base =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'

const variants: Record<Variant, string> = {
  primary: 'bg-indigo text-white hover:bg-indigo-deep',
  ticket: 'bg-ticket text-ink hover:bg-ticket-deep',
  ink: 'bg-ink text-white hover:bg-ink/85',
  outline: 'border border-ink/20 bg-white text-ink hover:border-ink/40',
  quiet: 'text-indigo underline-offset-4 hover:underline',
}

const sizes: Record<Size, string> = {
  md: 'min-h-12 px-5 text-base',
  lg: 'min-h-14 px-6 text-lg',
}

/**
 * Classes for a button-shaped element. `extra` is for layout (width, margin,
 * flex); colors and sizes come from `variant` and `size`.
 */
export function buttonClass(variant: Variant = 'primary', extra = '', size: Size = 'md'): string {
  const sizing = variant === 'quiet' ? 'min-h-11 px-3 text-base' : sizes[size]
  return `${base} ${variants[variant]} ${sizing} ${extra}`
}
