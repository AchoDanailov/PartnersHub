import { FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'

const VoucherSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  expiresOn: z.string(),
  state: z.enum(['valid', 'used', 'expired', 'cancelled']),
  redeemedAt: z.string().nullable(),
})
const VoucherResponseSchema = z.object({ voucher: VoucherSchema })
const ErrorBodySchema = z.object({ code: z.string(), message: z.string() })

export type Voucher = z.infer<typeof VoucherSchema>
export type VoucherState = Voucher['state']

/** How a voucher was found: from its QR link, or by the code staff typed. */
export type VoucherReference = { qrToken: string } | { code: string }

/** A failed call. `code` is the function's error code, or `NETWORK` when no answer came. */
export class VoucherApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'VoucherApiError'
    this.code = code
    this.status = status
  }
}

async function invoke(name: 'voucher-status' | 'redeem-voucher', body: object): Promise<Voucher> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response
      const parsed = ErrorBodySchema.safeParse(await response.json().catch(() => null))
      throw new VoucherApiError(
        parsed.success ? parsed.data.code : 'UNKNOWN',
        response.status,
        parsed.success ? parsed.data.message : error.message,
      )
    }
    throw new VoucherApiError('NETWORK', 0, error.message)
  }
  return VoucherResponseSchema.parse(data).voucher
}

/** Anyone: the state of the voucher behind a QR link. */
export function fetchVoucherStatus(qrToken: string): Promise<Voucher> {
  return invoke('voucher-status', { qrToken })
}

/** Signed-in members: the voucher with this code, in their organization. */
export function checkVoucherCode(code: string): Promise<Voucher> {
  return invoke('redeem-voucher', { action: 'check', code })
}

/** Signed-in members: marks the voucher as used. */
export function redeemVoucher(voucherId: string, reference: VoucherReference): Promise<Voucher> {
  return invoke('redeem-voucher', { action: 'redeem', voucherId, ...reference })
}

const ERROR_MESSAGES: Record<string, string> = {
  VOUCHER_NOT_FOUND: 'Няма ваучер с този код във вашата организация.',
  VOUCHER_EXPIRED: 'Ваучерът е с изтекъл срок.',
  VOUCHER_CANCELLED: 'Ваучерът е анулиран.',
  VOUCHER_ALREADY_REDEEMED: 'Ваучерът вече е използван.',
  TOO_MANY_ATTEMPTS: 'Твърде много грешни кодове. Опитайте отново след няколко минути.',
  FORBIDDEN: 'Профилът ви няма достъп до ваучерите на тази организация.',
  NETWORK: 'Няма връзка със сървъра. Проверете интернет връзката и опитайте отново.',
}

/** A Bulgarian message for a failed call, for the person in front of the screen. */
export function errorMessage(error: unknown): string {
  if (error instanceof VoucherApiError && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code]
  }
  return 'Нещо се обърка. Опитайте отново.'
}
