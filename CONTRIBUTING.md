# Contributing

Start with the [Quickstart](README.md#quickstart) in the README. This file covers the local development setup in more detail.

Each Edge Function documents its endpoint, authentication, responses and configuration in its own README under [`supabase/functions/`](supabase/functions/), for example [`issue-voucher/README.md`](supabase/functions/issue-voucher/README.md).

## Backend (Supabase)

The backend runs locally through the Supabase CLI, which boots the whole Supabase stack (Postgres, Auth, Storage, Edge Functions runtime, Studio) as Docker containers. The local stack is configured in [`supabase/config.toml`](supabase/config.toml).

```sh
npx supabase start            # start the local stack (applies migrations and seed data)
npx supabase status           # show local URLs and keys
npx supabase migration up     # apply pending migrations
npx supabase test db          # run database tests
npx supabase functions serve --env-file supabase/functions/.env  # serve the Edge Functions with their local secrets
npx supabase stop             # stop the local stack
```

Local Studio is available at <http://127.0.0.1:54323> while the stack is running.

The Edge Functions read their local-only secrets from `supabase/functions/.env`, copied from [`supabase/functions/.env.example`](supabase/functions/.env.example).

The local stack is seeded with three partner organizations, their services and vouchers, and admin and staff accounts. Every seeded account signs in with the local-only password `password123`. For example, for Пирин СПА:

- Admin: `admin@alpine.example.com`
- Staff: `staff-1@alpine.example.com`, `staff-2@alpine.example.com`

To test redemption, sign in as staff and use one of these active vouchers. Each can be redeemed once; `npx supabase db reset` restores them.

- By code: enter `BLV-M4S7A1` on the home page.
- By QR link: open `/services/a4000000-0000-0000-0000-000000000002?t=a7000000-0000-4000-8000-000000000004` (voucher `BLV-S4UN41`).

**All seeded accounts are listed at the top of [`supabase/seeding/seed.sql`](supabase/seeding/seed.sql).**

## Frontend

For local development, `web/.env.local` holds:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`: the local API URL and publishable key.
- `VITE_MAIN_SITE_URL`: the main site where clients buy vouchers.

Create it from [`web/.env.example`](web/.env.example), then run `npx supabase status` and set:

- `VITE_SUPABASE_URL`: **Project URL**
- `VITE_SUPABASE_PUBLISHABLE_KEY`: **Publishable**

Voucher status and redemption go through the Edge Functions, so serve them while using the app.

```sh
npm run dev     # start the dev server
npm run build   # production build
npm run lint    # lint the frontend
```
