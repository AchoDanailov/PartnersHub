# Partners Hub

The portal where our business partners redeem and track customer vouchers.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Deno](https://img.shields.io/badge/Deno-000000?logo=deno&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## What is Partners Hub?

We run marketing campaigns and sales on behalf of our partner businesses. Customers buy a partner's services from us as **vouchers**, and each voucher carries a unique **redemption code**. The customer then takes the voucher to the partner, who provides the service.

Partners Hub automates the partner's side of this process. Partners and their staff use it to validate and redeem customer codes, follow how their services are selling, and find service-specific information, all in one simple place.

## Features

- **Redemption code consumption (MVP):** validate a customer's code and redeem it, either by typing the code or by opening the voucher's QR link. Each code can be used only once.
- **Organization and staff access:** organization admins and their staff sign in and see only their own organization's data.
- **Voucher statistics per service:** how many vouchers we have sold for each service and how many have been redeemed.
- **FAQs:** per-service questions customers commonly ask our partners, shown to the organization admin.
- **Service landing pages:** a page for each service with tailored marketing images and text.

## Design principles

- **Simplicity first:** redeeming a code should take seconds, with no training required.
- **Ease of use:** clear flows for busy partner staff on any device.
- **Polished UI:** a modern, good-looking interface, with landing-page-style service pages.
- **Secure by default:** Row Level Security and business-scoped authorization on all application data.

## Tech stack

- **Backend:** [Supabase](https://supabase.com) for the Postgres database, Auth, Edge Functions (Deno), and Row Level Security
- **Frontend:** React + TypeScript, built with Vite and styled with Tailwind CSS

## Repository layout

```text
.
├── web/                 # Vite + React frontend (own package.json and lockfile)
│   └── src/
│       ├── pages/       # One component per route
│       ├── features/    # Auth, services, voucher redemption, dashboard
│       ├── components/  # Shared UI
│       ├── lib/         # Supabase client, env, formatting
│       └── types/       # Generated database types
├── supabase/
│   ├── config.toml      # Local Supabase configuration
│   ├── migrations/      # Database schema migrations
│   ├── tests/           # pgTAP database tests
│   ├── functions/       # Edge Functions and their Deno tests
│   └── seeding/         # Local seed data and service images
├── docs/                # Architecture decisions and database docs
├── .github/             # CI workflows and helper scripts
└── package.json         # Pinned Supabase CLI and shared dev scripts
```

## Getting started

### Prerequisites

- Node.js and npm
- Docker (required by the local Supabase stack)
- Deno 2 (optional, only needed to run Edge Function tests)

### Quickstart

Run from the repository root:

```sh
# 1. Install dependencies
npm install
npm install --prefix web

# 2. Start the local Supabase stack (applies migrations and seed data)
npx supabase start

# 3. First time only, local only: create the env files
#    web/.env.local gets the local API URL and publishable key (overwrites an existing file)
(eval "$(npx supabase status -o env)" && printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_PUBLISHABLE_KEY=%s\nVITE_MAIN_SITE_URL=\n' "$API_URL" "$PUBLISHABLE_KEY" > web/.env.local)
#    Or by hand: copy web/.env.example to web/.env.local and paste in the
#    API_URL and PUBLISHABLE_KEY values from `npx supabase status -o env`.

#    supabase/functions/.env gets the local-only Edge Function secrets
cp supabase/functions/.env.example supabase/functions/.env

# 4. In a second terminal: serve the Edge Functions with those local-only secrets
npx supabase functions serve --env-file supabase/functions/.env

# 5. In a third terminal: start the web app
npm run dev
```

Open <http://localhost:5173>.

### Sign in and redeem a voucher

The local stack is seeded with three partner organizations, their services and vouchers, and admin and staff accounts. Every seeded account signs in with the local-only password `password123`. For example, for Пирин СПА:

- Admin: `admin@alpine.example.com`
- Staff: `staff-1@alpine.example.com`, `staff-2@alpine.example.com`

Sign in as staff and redeem one of these active vouchers. Each can be redeemed once; `npx supabase db reset` restores them.

- By code: enter `BLV-M4S7A1` on the home page.
- By QR link: open <http://localhost:5173/services/a4000000-0000-0000-0000-000000000002?t=a7000000-0000-4000-8000-000000000004> (voucher `BLV-S4UN41`).

All seeded accounts are listed at the top of [`supabase/seeding/seed.sql`](supabase/seeding/seed.sql).

### Issue a new voucher

Vouchers are issued by the `issue-voucher` Edge Function. The caller sends a shared secret in the `X-Voucher-Issuer-Secret` header, which must match the `VOUCHER_ISSUER_SECRET` variable in `supabase/functions/.env`. With the functions served as in the Quickstart, issue a voucher for the same organization and service as the QR example above: Пирин СПА (`admin@alpine.example.com`) and its Сауна service. The request fields, responses and errors are described in [`supabase/functions/issue-voucher/README.md`](supabase/functions/issue-voucher/README.md).

```sh
# Issue a Сауна voucher for Пирин СПА, valid until 2099-12-31. The local-only issuer
# secret authorizes the call; a fresh idempotencyKey makes it a new voucher each time.
curl --request POST 'http://127.0.0.1:54321/functions/v1/issue-voucher' \
  --header 'X-Voucher-Issuer-Secret: local-only-voucher-issuer-secret-do-not-deploy' \
  --header 'Content-Type: application/json' \
  --data "{\"organizationId\":\"a1000000-0000-0000-0000-000000000001\",\"serviceId\":\"a4000000-0000-0000-0000-000000000002\",\"expiresOn\":\"2099-12-31\",\"idempotencyKey\":\"$(node -p 'crypto.randomUUID()')\"}"
```

The response holds the new `voucherId`. In Studio (<http://127.0.0.1:54323>):

- Table Editor → `vouchers`: the row with that id has the `redemption_code` and the `qr_token`.
- Storage → `generated-qrs` (a private bucket): `<voucherId>.png` is the voucher's QR code, which opens its service page. You can also, open the same page with the `qr_token` from the row: `http://localhost:5173/services/<service_id>?t=<qr_token>`.

Now redeem it, by code or by QR, with the steps from the previous subsection. 

## Contributing

The local Supabase stack, development commands and environment variables are described in [CONTRIBUTING.md](CONTRIBUTING.md).
