import { useQuery } from '@tanstack/react-query'
import { fetchVoucherStatus, VoucherApiError } from './api'

/** The voucher behind a QR link. Shared by the sticky bar and the sheet through its key. */
export function useVoucherStatus(qrToken: string | null) {
  return useQuery({
    queryKey: ['voucher', qrToken],
    enabled: qrToken !== null,
    queryFn: () => fetchVoucherStatus(qrToken!),
    retry: (count, error) =>
      count < 1 && !(error instanceof VoucherApiError && error.status < 500 && error.status > 0),
  })
}
