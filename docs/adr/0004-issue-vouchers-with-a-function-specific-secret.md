# 4. Issue vouchers with a function-specific secret

## Context

The `issue-voucher` caller is not a Supabase user, so it has no JWT. Every
Supabase secret key acts as `service_role`.

## Decision

`withSupabase` runs with `auth: "none"` and `verify_jwt = false`. The handler
compares `X-Voucher-Issuer-Secret` in constant time with `VOUCHER_ISSUER_SECRET`
before anything else. A missing secret, or one shorter than 32 characters,
refuses every call.

## Alternatives rejected

- **`auth: "secret"`**, as the supabase-server skill suggests. The caller would
  hold full database access.

## Consequences

- The issuer secret can only issue vouchers.
- Rotating it means changing the function secret and the caller together.
- The endpoint is public and the gateway does not filter requests, because
  `verify_jwt` is off. A request without the secret gets `401` before the body
  or the database is touched, but it still runs the function and counts toward
  usage.

## Future plans

Improvements to consider:

1. Authenticate the caller with a Supabase JWT instead of the issuer secret,
   for example through a dedicated issuer account with a role, as in Supabase's
   RBAC guide.
2. Restrict callers by IP in the handler, once the calling system has fixed
   IPs.
3. Rate-limit requests with a proxy or WAF in front of the function.
