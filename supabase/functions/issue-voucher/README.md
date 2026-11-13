# Issue Voucher Edge Function

Creates a voucher when one is sold. Called by the shop automation (Mechanic
today) once per sold voucher. It generates the redemption code, saves the
voucher, and stores a QR code that opens the service page with that code:

```text
<WEB_APP_URL>/services/<service_id>?code=BLV-7K2QX9
```

A redemption code is `BLV-` followed by 6 characters, each an uppercase letter
or a digit. It is stored as clear text in `vouchers.redemption_code`.

## Endpoint

```http
POST /functions/v1/issue-voucher
Content-Type: application/json
X-Voucher-Issuer-Secret: <issuer secret>

{
  "organizationId": "<uuid>",
  "serviceId": "<uuid>",
  "expiresOn": "2027-06-30",
  "shopifyOrderId": "5123456789012",
  "shopifyLineItemId": "13123456789012",
  "unit": 1
}
```

- `organizationId`, `serviceId`: the service must belong to that organization.
- `expiresOn`: a `YYYY-MM-DD` date, today (UTC) or later.
- `shopifyOrderId`, `shopifyLineItemId`: Shopify's numeric IDs, as digit
  strings or JSON numbers. GIDs (`gid://shopify/...`) are rejected.
- `unit`: optional, 1 to 100, default 1. A line item with quantity 3 is three
  vouchers, so the automation sends three calls with `unit` 1, 2 and 3.

## Responses

- `201`: a new voucher was created.
- `200`: the same order, line item and unit was issued before; the first
  voucher is returned.

Both carry the same body. The redemption code is not in it, because the caller
keeps response logs; it is in the database row and in the QR code.

```json
{
  "voucherId": "<uuid>",
  "serviceId": "<uuid>",
  "expiresOn": "2027-06-30",
  "qrPath": "<voucherId>.png"
}
```

Errors:

- `400` `INVALID_REQUEST`: a `Content-Type` other than `application/json`, a
  body over 1 KB, malformed JSON, or an invalid field.
- `401` `UNAUTHORIZED`: the issuer secret is missing or wrong.
- `404` `SERVICE_NOT_FOUND`: no such service, or it is not in that organization.
- `405` `METHOD_NOT_ALLOWED`: a method other than `POST`.
- `409` `ORGANIZATION_DEACTIVATED`: the organization is deactivated.
- `409` `IDEMPOTENCY_CONFLICT`: the order, line item and unit already have a
  voucher with a different service or expiry.
- `500` `VOUCHER_ISSUE_FAILED`: the voucher could not be saved, or the function
  is misconfigured (`WEB_APP_URL`).
- `500` `QR_GENERATION_FAILED`: the voucher was saved, but its QR code could
  not be generated.
- `502` `QR_UPLOAD_FAILED`: the voucher was saved, but its QR code was not
  stored.

Every error body is `{ "code": "...", "message": "..." }`.

Retrying is safe. The Shopify order, line item and unit are unique in
`public.vouchers`, so a repeated call never creates a second voucher. It stores
the QR code again, which repairs a `QR_UPLOAD_FAILED` or `QR_GENERATION_FAILED`.

## Authentication

The caller is neither a signed-in user nor a holder of a Supabase API key, so
`withSupabase` runs with `auth: "none"` and the handler authenticates the
caller itself, before anything else:

- The caller sends the issuer secret in `X-Voucher-Issuer-Secret`.
- The function compares it, in constant time, with `VOUCHER_ISSUER_SECRET` from
  its environment. If that variable is missing or shorter than 32 characters,
  every call gets `401`.
- The platform JWT check is off (`verify_jwt = false` in `supabase/config.toml`)
  so the request reaches that check.

The secret only lets a caller issue vouchers. A Supabase secret key is not used
here on purpose: it would give the automation full access to the database. See
`docs/adr/0004-issue-vouchers-through-a-shared-secret-webhook.md`.

## QR codes

- A plain 512×512 PNG, stored in the private bucket `generated-qrs` at
  `<voucher_id>.png`. Only `service_role` can read or write it.
- A QR code contains the redemption code. Treat the file like the code itself.

## Configuration

| Variable | Purpose |
| --- | --- |
| `VOUCHER_ISSUER_SECRET` | The secret callers must send. At least 32 characters. |
| `WEB_APP_URL` | Base URL of the web app, for example `https://app.example.com`. HTTP or HTTPS, without credentials, query or fragment. |

Locally both come from `supabase/functions/.env`:

```sh
cp supabase/functions/.env.example supabase/functions/.env
npx supabase start
npx supabase functions serve --env-file supabase/functions/.env
```

A hosted project gets its own values through `supabase secrets set`. Never
deploy the values from `.env.example`.

## Local request

```sh
curl --fail-with-body --silent --show-error \
  --request POST 'http://127.0.0.1:54321/functions/v1/issue-voucher' \
  --header 'X-Voucher-Issuer-Secret: local-only-voucher-issuer-secret-do-not-deploy' \
  --header 'Content-Type: application/json' \
  --data '{"organizationId":"a1000000-0000-0000-0000-000000000001","serviceId":"a4000000-0000-0000-0000-000000000001","expiresOn":"2099-12-31","shopifyOrderId":"5000000000001","shopifyLineItemId":"13000000000001"}'
```

The QR code then appears in Studio (`http://127.0.0.1:54323`) under Storage,
bucket `generated-qrs`.

## Verification

Deno 2 is required for the tests. Docker is required to serve the function.

```sh
cd supabase/functions
deno task check
deno task test
```

The unit tests cover every response above, the request limits, the code format
and that a rejected caller never reaches the database. The integration tests
run on CI against the local stack: a real voucher and QR code, a repeated call,
and a rejected caller. The column and bucket rules are covered by
`supabase/tests/voucher_issuance_test.sql`.
