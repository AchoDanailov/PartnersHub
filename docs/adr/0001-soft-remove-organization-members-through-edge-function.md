# 1. Soft-remove organization members through an Edge Function

- Status: Accepted
- Date: 2026-11-08

## Context

Removing a staff member is a soft removal. Nothing is hard-deleted: the profile,
membership and redemptions are kept. It takes two writes:

1. Set `organization_members.left_at`, which ends the membership but keeps the
   row.
2. Soft-delete the member's Auth account, which keeps the `auth.users` row and
   frees their email for a new account.

The second write goes through `auth.admin.deleteUser`, which needs the secret
key. That key must never reach `web/`, so this step has to run on the server.

## Decision

An admin calls the `soft-remove-organization-member` Edge Function. The function:

1. Takes the actor from the verified JWT and checks, under RLS, that they are a
   current admin of the member's organization.
2. Calls `public.remove_organization_member(p_actor_id, p_user_id)` as
   `service_role` to set `left_at`.
3. Calls `auth.admin.deleteUser(userId, shouldSoftDelete)` as `service_role` to
   soft-delete the Auth account.

The RPC can only be executed by `service_role`, and `authenticated` keeps
`SELECT` only on `organization_members`. `service_role` bypasses RLS, so the RPC
checks the actor itself, in the same `UPDATE` that sets `left_at`. This also
catches an actor whose role changed after the first check.

The server sets `left_at` with `now()`, so the caller can't choose it.

## Alternatives rejected

- **Grant `UPDATE (left_at)` to `authenticated` with an admin-only RLS policy.**
  This works for `left_at` alone, but the Auth step still needs the server. The
  client would make two calls and could leave a member marked as left with
  their email still taken.  
- **Trigger on `auth.users.deleted_at`.** This makes both writes atomic, but ties
  our logic to a column Supabase manages and may change.

## Consequences

- There is one entry point for soft removal, and the secret key stays in the
  Edge Function.
- The two writes are not atomic. If the Auth step fails, the member is already
  soft-removed and the function returns `502`. Retrying is safe: `left_at` keeps its
  original value and soft-deleting again succeeds.
- We depend on the public `deleteUser` API, not on the `auth` schema, and on soft
  delete continuing to free the email.
