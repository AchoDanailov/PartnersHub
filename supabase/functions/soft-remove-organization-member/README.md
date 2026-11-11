# Soft Remove Organization Member Edge Function

Lets an organization admin remove a staff member. It sets `left_at`, then
soft-deletes the member's Auth account so their email can be used for a new
account. The profile, membership and redemptions are kept.

## Endpoint

```http
POST /functions/v1/soft-remove-organization-member
Authorization: Bearer <admin user JWT>
apikey: <publishable key>
Content-Type: application/json

{ "userId": "<uuid>" }
```

## Responses

- `200`: `{ "userId": "...", "leftAt": "..." }`.
- `400` `INVALID_REQUEST`: a `Content-Type` other than `application/json`, a
  body over 1 KB, malformed JSON, an invalid `userId`, or the caller removing
  themselves.
- `401`: missing or invalid user JWT. The code comes from `@supabase/server`,
  for example `MISSING_CREDENTIALS` or `INVALID_JWT`.
- `403` `FORBIDDEN`: the caller isn't a current admin of the member's
  organization, or the target isn't staff there.
- `405` `METHOD_NOT_ALLOWED`: a method other than `POST`.
- `500` `REMOVAL_FAILED`: the removal failed unexpectedly.
- `502` `EMAIL_NOT_RELEASED`: the member was removed, but their email wasn't
  released. Retry the request.

Every error body is `{ "code": "...", "message": "..." }`.

Retrying is safe: the original `left_at` is kept, and soft-deleting an already
soft-deleted account succeeds.

## Authorization

- The function verifies the JWT and takes the actor from its claims, never from
  the request body.
- It reads the memberships with the caller's JWT, under RLS, and returns `403`
  unless the actor is a current admin of the staff member's organization.
- It then uses the secret key to call
  `public.remove_organization_member(p_actor_id, p_user_id)` and
  `auth.admin.deleteUser`.
- Only `service_role` can execute that RPC, so operators call it directly and
  signed-in users can't. It checks the actor again in the same update, for every
  caller. An operator passes the current admin of the organization as
  `p_actor_id`. These rules are covered by
  `supabase/tests/soft_deletion_test.sql`.

## Verification

Deno 2 is required for the tests. Docker is required to serve the function.

```sh
npx supabase functions serve soft-remove-organization-member

cd supabase/functions
deno task check
deno task test
```
