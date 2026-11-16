import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Keyboard, QrCode } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { SignInForm } from '../auth/SignInForm'
import { useViewer } from '../auth/useViewer'
import {
  checkVoucherCode,
  errorMessage,
  redeemVoucher,
  VoucherApiError,
  type Voucher,
  type VoucherReference,
} from './api'
import { CodeForm } from './CodeForm'
import { useVoucherStatus } from './useVoucherStatus'
import { VoucherTicket } from './VoucherTicket'

const CLIENT_NOTES: Record<Voucher['state'], string> = {
  valid: 'Покажете този екран на служител, за да използвате ваучера.',
  used: 'Този ваучер вече е използван.',
  expired: 'Срокът на този ваучер е изтекъл.',
  cancelled: 'Този ваучер е анулиран и не може да се използва.',
}

const STAFF_NOTES: Record<Exclude<Voucher['state'], 'valid'>, string> = {
  used: 'Ваучерът вече е използван и не може да се използва отново.',
  expired: 'Срокът на ваучера е изтекъл.',
  cancelled: 'Ваучерът е анулиран.',
}

/**
 * The whole voucher flow, in the sheet on a service page and inline on the
 * home page. Anyone sees the voucher behind a QR link; signing in, typing a
 * code and using the voucher are for members of its organization.
 */
export function RedeemPanel({ qrToken }: { qrToken: string | null }) {
  const viewer = useViewer()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'qr' | 'code'>(qrToken ? 'qr' : 'code')
  const [code, setCode] = useState<string | null>(null)
  const [codeVoucher, setCodeVoucher] = useState<Voucher | null>(null)
  const [used, setUsed] = useState<Voucher | null>(null)
  const [staffSignIn, setStaffSignIn] = useState(false)

  const status = useVoucherStatus(mode === 'qr' ? qrToken : null)
  const check = useMutation({
    mutationFn: checkVoucherCode,
    onSuccess: (voucher, typed) => {
      setCode(typed)
      setCodeVoucher(voucher)
    },
    onError: () => setCodeVoucher(null),
  })
  const redeem = useMutation({
    mutationFn: ({ voucher, reference }: { voucher: Voucher; reference: VoucherReference }) =>
      redeemVoucher(voucher.id, reference),
    onSuccess: (voucher) => {
      setUsed(voucher)
      if (qrToken) queryClient.setQueryData(['voucher', qrToken], voucher)
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const isMember = viewer.status === 'member'
  const voucher = mode === 'qr' ? status.data : codeVoucher
  const reference: VoucherReference | null =
    mode === 'qr' && qrToken ? { qrToken } : code ? { code } : null

  function enterCode() {
    setMode('code')
    setCode(null)
    setCodeVoucher(null)
    setUsed(null)
    check.reset()
    redeem.reset()
  }

  if (used) {
    return (
      <div className="flex flex-col gap-6 pt-2">
        <VoucherTicket voucher={used} stamped />
        <p role="status" className="text-center text-lg font-bold text-valid">
          Ваучерът е използван
        </p>
        <div className="rounded-2xl bg-white p-5">
          <p className="font-bold">Имате още ваучери?</p>
          <Button variant="outline" className="mt-3 w-full" onClick={enterCode}>
            <Keyboard aria-hidden className="size-5" />
            Въведи код
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 pt-2">
      {mode === 'qr' && (
        <VoucherTicket voucher={status.data} loading={status.isPending}>
          {status.isError && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {status.error instanceof VoucherApiError && status.error.code === 'VOUCHER_NOT_FOUND'
                ? 'Не намираме този ваучер. Проверете дали сте сканирали QR кода от ваучера.'
                : errorMessage(status.error)}
            </p>
          )}
          {voucher && !isMember && <p className="text-base">{CLIENT_NOTES[voucher.state]}</p>}
        </VoucherTicket>
      )}

      {mode === 'code' && isMember && (
        <>
          <CodeForm pending={check.isPending} onSubmit={(typed) => check.mutate(typed)} />
          {check.isError && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {errorMessage(check.error)}
            </p>
          )}
          {codeVoucher && <VoucherTicket voucher={codeVoucher} />}
        </>
      )}

      {isMember && voucher && reference && (
        <div className="flex flex-col gap-3">
          {voucher.state === 'valid' ? (
            <Button
              variant="primary"
              size="lg"
              disabled={redeem.isPending}
              onClick={() => redeem.mutate({ voucher, reference })}
            >
              {redeem.isPending ? 'Използване…' : 'Използвай ваучера'}
            </Button>
          ) : (
            <p className="font-semibold">{STAFF_NOTES[voucher.state]}</p>
          )}
          {redeem.isError && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {errorMessage(redeem.error)}
            </p>
          )}
        </div>
      )}

      {isMember && qrToken && (
        <Button variant="quiet" className="self-center" onClick={() => (mode === 'qr' ? enterCode() : setMode('qr'))}>
          {mode === 'qr' ? (
            <>
              <Keyboard aria-hidden className="size-4" />
              Въведи код ръчно
            </>
          ) : (
            <>
              <QrCode aria-hidden className="size-4" />
              Обратно към ваучера от QR кода
            </>
          )}
        </Button>
      )}

      {viewer.status === 'anonymous' &&
        (qrToken && !staffSignIn ? (
          <div className="flex flex-col items-center gap-1 border-t border-line pt-4 text-center">
            <p className="text-sm text-ink-soft">Служител ли сте?</p>
            <Button variant="quiet" onClick={() => setStaffSignIn(true)}>
              Влезте, за да използвате ваучера
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-5">
            <div>
              <p className="font-bold">{qrToken ? 'Вход за служители' : 'Вход за партньори'}</p>
              <p className="text-sm text-ink-soft">
                {qrToken
                  ? 'Влезте, за да използвате ваучера.'
                  : 'Влезте, за да проверите и използвате ваучер по неговия код.'}
              </p>
            </div>
            <SignInForm />
          </div>
        ))}

      {viewer.status === 'outsider' && (
        <p className="rounded-2xl bg-white p-5 text-base">
          Профилът ви не е свързан с организация, затова не може да използва ваучери.
        </p>
      )}
    </div>
  )
}
