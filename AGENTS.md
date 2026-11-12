# Partners Hub

Partners Hub is a local-first React and Supabase platform where our business partners and their staff members can validate and consume voucher redemption codes. Clients arrive at service-specific pages through QR codes; these pages will later include tailored marketing images and scripts alongside the voucher interactions.

## Project layout

- `web/`: self-contained Vite frontend with its own dependencies and lockfile; it can be used as the hosting project root. Generated database types live in `web/src/types/database.ts`.
- `supabase/`: local Supabase configuration, database migrations, pgTAP tests, and Edge Functions. Follow the `edge-functions` skill when writing or changing Edge Functions.
- `supabase/seed.sql`: local and CI seed data, loaded after migrations by `npx supabase start` and `npx supabase db reset`. It holds three organizations with fixed IDs (`a1000000-...` organizations, `a2000000-...` users, `a4000000-...` services, `a5000000-...` vouchers). Every seeded user signs in with the local-only password `password123`. pgTAP tests must not assume the database is empty.
- `docs/`: project documentation
- `.github/`: GitHub Actions workflows and CI helper scripts (`.github/scripts/`). The Database and Edge Functions workflows run on every push to every branch; the Edge Functions workflow boots the local stack and runs the integration tests (`docs/adr/0002-integration-tests-on-ci-against-a-local-stack.md`).
- Root `package.json`: pinned Supabase CLI and shared development commands.

## Commands

Run commands from the repository root:

```sh
npm install
npm install --prefix web
npm run dev
npm run build
npm run lint

npx supabase start
npx supabase status
npx supabase stop
npx supabase migration up
npx supabase test db
npx supabase db advisors --local
npx supabase gen types typescript --local --schema public > web/src/types/database.ts
npx supabase gen types typescript --local --schema public > supabase/functions/_shared/database.types.ts
npx supabase functions serve soft-remove-organization-member
.github/scripts/serve-functions.sh   # serve all functions and wait until they boot

# from supabase/functions/ (all functions) or a function's directory (that function only)
deno task check
deno task test
deno task test:integration   # needs the stack running, functions served and SUPABASE_* env exported (see the edge-functions skill)
deno fmt --check
deno lint
```

Local Studio is available at `http://127.0.0.1:54323` while the Supabase stack is running.

## Frontend environment setup

1. Start Supabase and run `npx supabase status` to obtain the local API URL and publishable key.
2. Copy `web/.env.example` to `web/.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using those local values.

## Security baseline

- Enable RLS and business-scoped authorization on exposed application tables.
- Never use `user_metadata` for authorization decisions.
- Never expose service-role or secret keys in `web/` or `VITE_*` variables.
- Perform explicit authentication and authorization checks in Edge Functions.
- Work locally by default. Do not link, push, deploy, or otherwise mutate a hosted Supabase project without an explicit user request.

## Verification and changes

- Run `npx supabase test db` and `npx supabase db advisors --local` for database changes; regenerate `web/src/types/database.ts` and `supabase/functions/_shared/database.types.ts` after schema changes.
- Run `npm run lint` and `npm run build` for relevant frontend changes; add targeted tests when a test runner is introduced.
- Keep changes minimal and update this file when project structure or commands change.
- Do not perform Git mutations unless explicitly requested.
