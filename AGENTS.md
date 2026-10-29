# Partners Hub

Partners Hub is a local-first React and Supabase platform where our business partners and their staff members can validate and consume voucher PIN codes. Clients arrive at service-specific pages through QR codes; these pages will later include tailored marketing images and scripts alongside the voucher interactions.

## Project layout

- `web/`: self-contained Vite frontend with its own dependencies and lockfile; it can be used as the hosting project root.
- `supabase/`: local Supabase configuration; database migrations and Edge Functions will live here when added.
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
npx supabase functions serve
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

- Run `npm run lint` and `npm run build` for relevant frontend changes; add targeted tests when a test runner is introduced.
- Keep changes minimal and update this file when project structure or commands change.
- Do not perform Git mutations unless explicitly requested.
