export const ISSUER_SECRET_ENV = "VOUCHER_ISSUER_SECRET";
export const ISSUER_SECRET_HEADER = "X-Voucher-Issuer-Secret";
/** A shorter configured secret is treated as missing, so every call is refused. */
export const MIN_ISSUER_SECRET_LENGTH = 32;
