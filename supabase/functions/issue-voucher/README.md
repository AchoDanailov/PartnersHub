# Issue Voucher Edge Function

Creates a voucher for a service: generates its redemption code, saves it, and
stores a QR code that opens the service page with the voucher's QR token:

```text
<WEB_APP_URL>/services/<service_id>?t=<qr_token>
```

- A redemption code is `BLV-` followed by 6 uppercase letters or digits, stored
  as clear text in `vouchers.redemption_code`.
- A QR token is a random UUID that the database generates in
  `vouchers.qr_token`. The QR code carries the token.

## Endpoint

```http
POST /functions/v1/issue-voucher
Content-Type: application/json
X-Voucher-Issuer-Secret: <issuer secret>

{
  "organizationId": "<uuid>",
  "serviceId": "<uuid>",
  "expiresOn": "2027-06-30",
  "idempotencyKey": "<uuid>"
}
```

- `organizationId`, `serviceId`: the service must belong to that organization.
- `expiresOn`: a `YYYY-MM-DD` date, today (UTC) or later.
- `idempotencyKey`: a new UUID per voucher. Send the same one again to retry.

## Responses

- `201`: a new voucher was created.
- `200`: a voucher with this `idempotencyKey` already existed and is returned.

Both carry `{ "voucherId", "serviceId", "expiresOn", "qrPath" }`. The
redemption code and the QR token are not in the response, only in the database
row.

- `400` `INVALID_REQUEST`: a `Content-Type` other than `application/json`, a
  body over 1 KB, malformed JSON, or an invalid field.
- `401` `UNAUTHORIZED`: the issuer secret is missing or wrong.
- `404` `SERVICE_NOT_FOUND`: no such service in that organization.
- `405` `METHOD_NOT_ALLOWED`: a method other than `POST`.
- `409` `ORGANIZATION_DEACTIVATED`: the organization is deactivated.
- `409` `IDEMPOTENCY_CONFLICT`: the key already has a voucher with a different
  service or expiry.
- `500` `VOUCHER_ISSUE_FAILED`: the voucher could not be saved, or
  `WEB_APP_URL` is missing or invalid.
- `500` `QR_GENERATION_FAILED`: the voucher was saved, but its QR code could
  not be generated.
- `502` `QR_UPLOAD_FAILED`: the voucher was saved, but its QR code was not
  stored.

Every error body is `{ "code": "...", "message": "..." }`. Retrying with the
same key never creates a second voucher, and it stores the QR code again.

## Authentication

- The caller sends the issuer secret in `X-Voucher-Issuer-Secret`. The function
  compares it in constant time with `VOUCHER_ISSUER_SECRET`, before reading the
  body. If that variable is missing or shorter than 32 characters, every call
  gets `401`.
- `withSupabase` runs with `auth: "none"` and `verify_jwt = false`, so the
  request reaches that check. See
  `docs/adr/0004-issue-vouchers-with-a-function-specific-secret.md`.

## QR codes

A PNG of about 512 px at `<voucher_id>.png` in the private bucket `generated-qrs`. Only
`service_role` can read or write it. It contains the voucher's QR token.

## Configuration

| Variable | Purpose |
| --- | --- |
| `VOUCHER_ISSUER_SECRET` | The secret callers must send. At least 32 characters. |
| `WEB_APP_URL` | Base URL of the web app. HTTP or HTTPS, without credentials, query or fragment. |

Locally both come from `supabase/functions/.env`, copied from `.env.example`.
A hosted project gets its own values through `supabase secrets set`.

## Local request

```sh
npx supabase functions serve --env-file supabase/functions/.env

curl --fail-with-body --silent --show-error \
  --request POST 'http://127.0.0.1:54321/functions/v1/issue-voucher' \
  --header 'X-Voucher-Issuer-Secret: local-only-voucher-issuer-secret-do-not-deploy' \
  --header 'Content-Type: application/json' \
  --data '{"organizationId":"a1000000-0000-0000-0000-000000000001","serviceId":"a4000000-0000-0000-0000-000000000001","expiresOn":"2099-12-31","idempotencyKey":"b6000000-0000-4000-8000-000000000001"}'
```

Use a new `idempotencyKey` for each new voucher.

The QR code then appears in Studio (`http://127.0.0.1:54323`) under Storage,
bucket `generated-qrs`.

## Verification

Deno 2 is required for the tests. Docker is required to serve the function.

```sh
cd supabase/functions
deno task check
deno task test
```

The column and bucket rules are covered by
`supabase/tests/voucher_issuance_test.sql`.
