# 2. Run Edge Function integration tests on CI against a local Supabase stack

## Context

Humans and agents both work on this repo. Agents running in the cloud have no
Docker, so they can run the static checks and unit tests in
`supabase/functions/` but cannot boot the local stack.

Unit tests call each function's exported handler with a fake context. That
covers every branch, but none of the real pieces the function is wired to:

- the gateway's `verify_jwt` check and `withSupabase` auth with a real JWT
- RLS through the caller's client
- the Postgres RPCs and triggers that run under the secret key
- the Supabase Auth admin API, and later other third-party providers

## Decision

GitHub Actions validates every push to every branch, so feedback arrives before
a PR exists. Same-repository PRs reuse the push run's checks; fork PRs run their
own.

`.github/workflows/edge-functions.yml` runs two jobs:

1. **Check and unit tests**: `deno install --frozen`, `deno task check` and
   `deno task test` from the `supabase/functions/` workspace root.
2. **Integration tests (local stack)**:
   1. installs the Supabase CLI pinned in `package.json`
   2. runs `npx supabase start`, which applies the migrations and
      `supabase/seeding/seed.sql`
   3. exports the stack's URL and keys, and copies the committed
      `supabase/functions/.env.example` to `.env`, so the served functions and
      the tests use it and get the same local-only secrets
   4. serves every function in the workspace and fails if one does not boot
      (`.github/scripts/serve-functions.sh`)
   5. runs every `supabase/functions/tests/**/*.integration-tests.ts` file
      through the root `test:integration` task

`.github/workflows/database.yml` (migrations, pgTAP, advisors) uses the same
triggers.

### What an integration test covers

These are pseudo-integration tests: they run against a disposable local stack,
not production, and they are deliberately few. Unit tests stay the place for
edge cases and input validation. Write an integration test for:

- **each distinct integration** a function adds: a new provider, a new Supabase
  service, or a new path through the gateway. Don't write a test for each read.
- **at least one operation of each CRUD type** the function performs (create,
  read, update, delete), in the simplest form that proves it works end to end.
- **the authorization boundary**: one allowed caller and one caller who is
  rejected.

Callers come from `supabase/seeding/seed.sql`. Rows a test changes or deletes are
created by the test itself, so tests don't consume seed data and can be
re-run without a reset.

## Alternatives rejected

- **Unit tests with fakes only.** They can't catch wiring mistakes, which is
  what an agent without Docker most needs checked.
- **Docker inside the agent's container.** It isn't reliably available.
- **CI on pull requests only.**: Cloud running Agents would get no runtime
feedback until a PR was opened.
- **One CI job per function.** The functions share one Deno workspace and lock
  file, so one stack and one test run cover them all.

## Consequences

- Every push that touches functions, migrations, the seed, `config.toml` or the
  CI files spends a few runner minutes booting the stack.
- The local stack can drift from hosted Supabase. These tests prove our wiring,
  not hosted behaviour.
- A function is only served and tested if it follows the edge-functions skill's
  layout: a `config.toml` entry, membership in the root `"workspace"`, and tests
  in `tests/<fn>/`.
- A future third-party provider (payments, email) needs a local emulator, such
  as Mailpit for email, or sandbox credentials stored as GitHub secrets before
  its integration test can run on CI.

## Future plans

1. At some point we will add a hosted staging Supabase project to run these tests
against.

2. Each function will get a health check route, replacing the empty-POST boot probe
in `.github/scripts/serve-functions.sh`.