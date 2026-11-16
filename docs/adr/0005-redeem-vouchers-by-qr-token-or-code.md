# 5. Redeem vouchers by QR token or by code

## Context

A printed voucher shows its redemption code and a QR code. A
staff member of the service's organization redeems it, either by scanning the
QR code with their phone or by typing the code. A client who scans their own
voucher wants to see whether it is still valid.

HTTPS encrypts a URL on the wire, but a code in the query string still ends up
in server logs, analytics and browser history.

## Decision

- The QR code opens `<WEB_APP_URL>/services/<service_id>?t=<qr_token>`.
  `vouchers.qr_token` is a random UUID, hidden from `anon` and `authenticated`.
- Anyone with the QR link sees the voucher's state (valid, used, expired or
  cancelled), through the public `voucher-status` Edge Function.
- Only a signed-in current member of the service's organization can look up a
  voucher by its typed code, or redeem it, through `redeem-voucher`.
- Failed attempts with a typed code are limited per member: 5 in 15 minutes. A
  6-character code has about 2.2 billion values, few enough to guess at scale
  without a limit. QR tokens are too long to guess, so they are not limited.

## Alternatives rejected

- **The code in the query string (`?code=`).** It would be stored in clear
  text in logs, analytics and history.
- **An encrypted code in the URL.** The same protection as a random token, but
  rotating or losing the key breaks every printed QR code.
- **The code in a URL fragment (`#code=`).** It stays out of server logs, but
  scripts on the page can still read it.
- **Checking a typed code without signing in.** It could only be limited per IP
  address, which an attacker changes easily, so anyone could hunt for valid
  codes.

## Consequences

- A leaked QR can shows the voucher's state, but it cannot be redeemed without
  a member sign-in from that organization.
- Anyone who sees the printed voucher can read its code. This is accepted.
- Changing a voucher's `qr_token` invalidates its printed QR code.