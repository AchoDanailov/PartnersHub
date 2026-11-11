# 2. Run Edge Function integration tests on CI against a local Supabase stack

- Status: Accepted
- Date: 2026-11-12

## Context

Humans and agents both work on this repo. Agents usually run in cloud
containers where Docker is not available, so they can run the static checks
and unit tests in `supabase/functions/` but cannot boot the local stack.

Unit tests call each function's exported handler with a fake context. That
covers every branch, but none of the real pieces the function is wired to:

- the gateway's `verify_jwt` check and `withSupabase` auth with a real JWT
- RLS through the caller's client
- the Postgres RPCs and triggers that run under the secret key
- the Supabase Auth admin API, and later other third-party providers

A mistake in that wiring (a wrong grant, a renamed column, a missing
`config.toml` entry, a function that fails to boot) passes every unit test.

## Decision

GitHub Actions validates every push to every branch, from humans and agents
alike, so feedback arrives before a PR exists. Same-repository PRs reuse the
push run's checks; fork PRs run their own.

`.github/workflows/edge-functions.yml` runs two jobs:

1. **Check and unit tests**: `deno install --frozen`, `deno task check` and
   `deno task test` from the `supabase/functions/` workspace root.
2. **Integration tests (local stack)**, which runs on a GitHub-hosted runner:
   1. installs the Supabase CLI pinned in `package.json`
   2. runs `npx supabase start`, which applies the migrations and
      `supabase/seed.sql`
   3. serves every function in the workspace and fails if one does not boot
      (`.github/scripts/serve-functions.sh`)
   4. runs every `supabase/functions/tests/**/*.integration-tests.ts` file
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

Callers come from `supabase/seed.sql`. Rows a test changes or deletes are
created by the test itself, so tests don't consume seed data and can be
re-run without a reset.

## Alternatives rejected

- **A hosted staging project.** It needs real secrets in CI and a hosted project
  that tests mutate. AGENTS.md keeps hosted projects out of routine work.
- **Unit tests with fakes only.** They can't catch wiring mistakes, which is
  what an agent without Docker most needs checked.
- **Docker inside the agent's container.** It isn't reliably available, and
  where it is, outbound TLS from the Edge Runtime container can fail behind the
  container's proxy.
- **CI on pull requests only.** Agents would get no runtime feedback until a PR
  was opened.
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
