# Redeem Voucher Edge Function

Lets a signed-in staff member or admin check a voucher by its typed code, and
use a voucher of their organization. Anyone can check a voucher by its QR token
through `voucher-status`.

## Endpoint

```http
POST /functions/v1/redeem-voucher
Authorization: Bearer <member user JWT>
apikey: <publishable key>
Content-Type: application/json

{ "action": "check", "code": "BLV-7K2QX9" }
{ "action": "redeem", "voucherId": "<uuid>", "qrToken": "<uuid>" }
{ "action": "redeem", "voucherId": "<uuid>", "code": "BLV-7K2QX9" }
```

- Send exactly one of `qrToken` and `code`. A code is trimmed and uppercased.
- `redeem` needs the `voucherId` that `voucher-status` or `check` returned, and
  the token or code it was found by.

## Responses

- `200`: `{ "voucher": { ... } }`, the same shape as `voucher-status`. After
  `redeem`, `state` is `used`.
- `400` `INVALID_REQUEST`: a `Content-Type` other than `application/json`, a
  body over 1 KB, malformed JSON, or an invalid field.
- `401`: missing or invalid user JWT, from `@supabase/server`.
- `403` `FORBIDDEN`: the caller is not a current member of an organization.
- `404` `VOUCHER_NOT_FOUND`: no such voucher in the caller's organization, or
  the `voucherId` does not match the token or code.
- `405` `METHOD_NOT_ALLOWED`: a method other than `POST`.
- `409` `VOUCHER_EXPIRED`, `VOUCHER_CANCELLED`, `VOUCHER_ALREADY_REDEEMED`.
- `429` `TOO_MANY_ATTEMPTS`: 5 wrong codes within 15 minutes.
- `500` `REDEMPTION_FAILED`: a query failed.

Retrying is safe: a voucher this member already used returns `200` again.

## Authorization

- The member comes from the verified JWT. Their membership is read with their
  own JWT, under RLS.
- The voucher is read and updated with the secret key, because members cannot
  read `qr_token` or `redemption_code`. A voucher of another organization
  answers `404`, like a missing one.
- The update only changes an active, unexpired voucher, so two people cannot
  use the same voucher. The database trigger checks again that the redeemer is
  a current member of the service's organization.
- Every typed code that finds nothing, or a voucher of another organization,
  adds a row to `voucher_code_attempts`. QR tokens are not limited.

## Verification

```sh
npx supabase functions serve redeem-voucher

cd supabase/functions
deno task check
deno task test
```
