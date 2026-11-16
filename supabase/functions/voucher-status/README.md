# Voucher Status Edge Function

Tells anyone who opens a voucher's QR link whether the voucher is valid, used,
expired or cancelled. Using a voucher is `redeem-voucher`.

## Endpoint

```http
POST /functions/v1/voucher-status
apikey: <publishable key>
Content-Type: application/json

{ "qrToken": "<uuid>" }
```

## Responses

- `200`: `{ "voucher": { "id", "serviceId", "serviceName", "expiresOn", "state", "redeemedAt" } }`.
  `state` is `valid`, `used`, `expired` or `cancelled`. A voucher is valid
  through its `expiresOn` day (UTC). The redemption code is never returned.
- `400` `INVALID_REQUEST`: a `Content-Type` other than `application/json`, a
  body over 1 KB, malformed JSON, or an invalid `qrToken`.
- `401`: missing or unknown publishable key, from `@supabase/server`.
- `404` `VOUCHER_NOT_FOUND`: no voucher has this QR token.
- `405` `METHOD_NOT_ALLOWED`: a method other than `POST`.
- `500` `VOUCHER_LOOKUP_FAILED`: the lookup failed.

## Authorization

- `auth: "publishable"` and `verify_jwt = false`: no sign-in, so a client sees
  their own voucher. See `docs/adr/0005-redeem-vouchers-by-qr-token-or-code.md`.
- `anon` and `authenticated` cannot read `qr_token`, so the lookup uses the
  secret key.
- Not rate limited: a QR token is a random UUID, too long to guess.

## Verification

```sh
npx supabase functions serve voucher-status

cd supabase/functions
deno task check
deno task test
```
