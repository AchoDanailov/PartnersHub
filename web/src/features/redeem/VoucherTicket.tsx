import { Ban, CircleCheck, Clock, LoaderCircle, TicketCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDate, formatDateTime } from '../../lib/format'
import type { Voucher, VoucherState } from './api'

const STATES: Record<
  VoucherState,
  { label: string; tone: string; icon: typeof CircleCheck; detail: (voucher: Voucher) => string }
> = {
  valid: {
    label: 'Валиден',
    tone: 'bg-valid-soft text-valid',
    icon: CircleCheck,
    detail: (voucher) => `до ${formatDate(voucher.expiresOn)}`,
  },
  used: {
    label: 'Използван',
    tone: 'bg-ink/8 text-ink',
    icon: TicketCheck,
    detail: (voucher) => (voucher.redeemedAt ? `на ${formatDateTime(voucher.redeemedAt)}` : ''),
  },
  expired: {
    label: 'Изтекъл',
    tone: 'bg-warn-soft text-warn',
    icon: Clock,
    detail: (voucher) => `на ${formatDate(voucher.expiresOn)}`,
  },
  cancelled: {
    label: 'Анулиран',
    tone: 'bg-danger-soft text-danger',
    icon: Ban,
    detail: () => '',
  },
}

/** The voucher's state as a small pill with its date, for the ticket and the sticky bar. */
export function VoucherStatePill({ voucher, compact = false }: { voucher: Voucher; compact?: boolean }) {
  const state = STATES[voucher.state]
  const Icon = state.icon
  // In the sticky bar a used voucher shows only the day, so the line fits a phone.
  const detail =
    compact && voucher.state === 'used' && voucher.redeemedAt
      ? `на ${formatDate(voucher.redeemedAt)}`
      : state.detail(voucher)
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold ${state.tone}`}>
        <Icon aria-hidden className="size-4" />
        {state.label}
      </span>
      <span className="text-sm text-ink-soft">{detail}</span>
    </span>
  )
}

/**
 * A voucher drawn as a paper ticket: the service on the stub, the state below
 * the perforation. `stamped` presses the "Използван" stamp onto it.
 */
export function VoucherTicket({
  voucher,
  loading = false,
  stamped = false,
  children,
}: {
  voucher?: Voucher | null
  loading?: boolean
  stamped?: boolean
  children?: ReactNode
}) {
  return (
    <div className="relative drop-shadow-[0_10px_24px_rgba(20,26,51,0.12)]">
      <div className="notch-bottom rounded-t-2xl bg-white px-5 pt-5 pb-6">
        <p className="text-sm font-semibold text-ink-soft">Ваучер</p>
        {loading ? (
          <p className="mt-1 flex items-center gap-2 font-display text-3xl font-bold" role="status">
            <LoaderCircle aria-hidden className="size-6 animate-spin text-indigo" />
            Проверяваме ваучера…
          </p>
        ) : (
          <p className="mt-1 font-display text-4xl leading-none font-bold">{voucher?.serviceName ?? '—'}</p>
        )}
      </div>
      <div className="notch-top rounded-b-2xl border-t-2 border-dashed border-line bg-white px-5 pt-5 pb-5">
        {voucher && !loading ? <VoucherStatePill voucher={voucher} /> : <span className="text-sm text-ink-soft">&nbsp;</span>}
        {children && <div className="mt-4">{children}</div>}
      </div>
      {stamped && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-4 right-4 animate-stamp rounded-lg border-4 border-valid px-3 py-1 font-display text-3xl font-extrabold tracking-wider text-valid uppercase mix-blend-multiply"
        >
          Използван
        </span>
      )}
    </div>
  )
}
