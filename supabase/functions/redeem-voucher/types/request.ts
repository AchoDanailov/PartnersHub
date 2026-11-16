/** How the caller identifies the voucher: the QR token from its link, or the typed code. */
export type VoucherReference =
  | { kind: "qr"; qrToken: string }
  | { kind: "code"; code: string };

export type RedeemRequest =
  | { action: "check"; reference: VoucherReference }
  | { action: "redeem"; voucherId: string; reference: VoucherReference };
