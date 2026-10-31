# Partners Hub

Partners Hub is a local-first React and Supabase platform where our business partners and their staff members can validate and consume voucher redemption codes. Clients arrive at service-specific pages through QR codes; these pages will later include tailored marketing images and scripts alongside the voucher interactions.

## Project layout

- `web/`: self-contained Vite frontend with its own dependencies and lockfile; it can be used as the hosting project root. Generated database types live in `web/src/types/database.ts`.
- `supabase/`: local Supabase configuration, database migrations, pgTAP tests, and Edge Functions. Edge Functions and their Deno tests live under `supabase/functions/`.
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
npx supabase functions serve generate-qrcode

cd supabase/functions/generate-qrcode
deno task check
deno task test
```

Local Studio is available at `http://127.0.0.1:54323` while the Supabase stack is running.

## Edge Functions

`generate-qrcode` is an internal PNG QR-code generator protected by the named Supabase secret key `qr-generator`. See `supabase/functions/generate-qrcode/README.md` for its request contract, local secret setup, and invocation example. Deno 2 is required to run its tests; Docker is required to serve it through the local Edge Runtime. Use ignored local `.env` files for function secrets and never commit real secret keys.

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

- Run `npx supabase test db` and `npx supabase db advisors --local` for database changes; regenerate `web/src/types/database.ts` after schema changes.
- Run `npm run lint` and `npm run build` for relevant frontend changes; add targeted tests when a test runner is introduced.
- Keep changes minimal and update this file when project structure or commands change.
- Do not perform Git mutations unless explicitly requested.
