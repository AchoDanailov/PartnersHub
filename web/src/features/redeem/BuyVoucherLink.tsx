import { Gift } from 'lucide-react'
import { buttonClass } from '../../components/buttonClass'
import { env } from '../../lib/env'

/**
 * "Купи ваучер": opens the main site, where clients buy vouchers. The URL
 * comes from VITE_MAIN_SITE_URL and is not known yet, so until then the
 * button stays in place and does nothing.
 */
export function BuyVoucherLink({
  variant = 'ticket',
  className = '',
}: {
  variant?: 'ticket' | 'ink'
  className?: string
}) {
  return (
    <a
      href={env.mainSiteUrl ?? '#'}
      onClick={(event) => {
        if (!env.mainSiteUrl) event.preventDefault()
      }}
      className={buttonClass(variant, className)}
    >
      <Gift aria-hidden className="size-5" />
      Купи ваучер
    </a>
  )
}
