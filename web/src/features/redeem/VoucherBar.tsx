import { ScanLine, Ticket } from 'lucide-react'
import { Button } from '../../components/Button'
import type { Viewer } from '../auth/useViewer'
import { useVoucherStatus } from './useVoucherStatus'
import { VoucherStatePill } from './VoucherTicket'
import { BuyVoucherLink } from './BuyVoucherLink'

/**
 * Always on screen at the bottom of a service page, so staff never look for
 * where to use a voucher. With a QR link it carries the voucher's state.
 */
export function VoucherBar({
  qrToken,
  viewer,
  onOpen,
}: {
  qrToken: string | null
  viewer: Viewer
  onOpen: () => void
}) {
  const status = useVoucherStatus(qrToken)

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-3">
        {qrToken ? (
          <>
            <div className="min-w-0 flex-1">
              {status.data ? (
                <VoucherStatePill voucher={status.data} compact />
              ) : (
                <span className="text-sm text-ink-soft" role="status">
                  {status.isPending ? 'Проверяваме ваучера…' : 'Ваучерът не е намерен'}
                </span>
              )}
            </div>
            <Button variant="primary" onClick={onOpen} className="shrink-0">
              <Ticket aria-hidden className="size-5" />
              Покажи ваучера
            </Button>
          </>
        ) : viewer.status === 'member' ? (
          <Button variant="primary" onClick={onOpen} className="w-full">
            <ScanLine aria-hidden className="size-5" />
            Използване на ваучер
          </Button>
        ) : (
          <>
            <BuyVoucherLink className="flex-1 !px-3 text-[0.9375rem] whitespace-nowrap" />
            <Button variant="outline" onClick={onOpen} className="flex-1 !px-3 text-[0.9375rem] whitespace-nowrap">
              Използване на ваучер
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
