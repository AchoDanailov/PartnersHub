# 4. Issue vouchers through a webhook protected by its own secret

- Status: Accepted
- Date: 2026-11-13

## Context

Vouchers are sold in a Shopify shop. When one is sold, a shop automation
(Mechanic today, possibly Shopify Flow later) must create the voucher in
Partners Hub. The caller is a machine outside Supabase:

- It is not a signed-in user, so there is no JWT.
- Its HTTP action lets us choose the headers and the body, but does not sign
  the request. Only native Shopify webhooks carry an HMAC signature.
- It may send the same sale twice, after a timeout or a manual re-run.

An internal dashboard will later issue vouchers too, as a signed-in user.

## Decision

The `issue-voucher` Edge Function creates the voucher and its QR code.

### The caller proves itself with a secret only this function accepts

- The caller sends `X-Voucher-Issuer-Secret`. The function compares it in
  constant time with `VOUCHER_ISSUER_SECRET` from its environment, before it
  reads the body.
- `withSupabase` runs with `auth: "none"` and `verify_jwt` is off, because the
  library only knows users and Supabase API keys. The function is not open:
  without the secret the answer is `401`.
- If the secret is not configured, or is shorter than 32 characters, every
  call is refused.

### Codes are clear text

- A code is `BLV-` plus 6 characters from `A-Z0-9`, drawn from the runtime's
  secure random generator.
- It is stored as is in `vouchers.redemption_code`, which is unique. A taken
  code is replaced by a new one, up to 3 times.
- The response does not contain the code, because the caller keeps logs.

### A sale is issued once

- `vouchers` stores the Shopify order ID, line item ID and unit (1 to the line
  item's quantity). The three are unique together.
- The insert skips a row whose reference already exists. The function then
  returns the first voucher with `200` instead of `201`.
- A repeated call with a different service or expiry gets `409`.

### QR codes go to a private bucket

- The QR code encodes `<WEB_APP_URL>/services/<service_id>?code=<code>` and is
  stored at `<voucher_id>.png` in the private bucket `generated-qrs`.
- `WEB_APP_URL` is configuration, so the domain can change without a code
  change.
- An Edge Function cannot write to the repository or any lasting disk, only to
  an ephemeral `/tmp`.

## Alternatives rejected

- **A named Supabase secret key (`auth: "secret:<name>"`).** Every Supabase
  secret key acts as `service_role`. Stored in the shop automation, a leak
  would expose the whole database, not only voucher issuing.
- **Shopify HMAC verification.** Right for native Shopify webhooks, but the
  automation's HTTP action does not sign requests, and the payload would be
  Shopify's order object instead of ours.
- **A database role for the automation.** A role limits what a database
  connection may do. The automation never connects to the database, so a role
  cannot identify it.
- **Encrypting the code at rest.** The QR code and the row would hold the same
  value, so a leaked row would still be usable. Column grants already hide
  the code from `anon` and `authenticated`.

## Consequences

- Whoever holds the issuer secret can create vouchers for any service, and
  nothing else. Rotating it means changing the function secret and the
  automation together.
- The redemption code travels in the QR code's URL, so it can end up in
  browser history and logs. Redemption must require a signed-in staff member
  of the service's organization and limit wrong attempts; 6 characters are too
  few for an open endpoint.
- Saving the voucher and storing its QR code are two writes. If the second
  fails, the function returns `502`; calling again stores the QR code.
- Deleting a voucher leaves its QR code in the bucket.
- When the dashboard arrives, the function accepts a second kind of caller: a
  signed-in user with the right role. The secret uses its own header so the
  two do not collide.
