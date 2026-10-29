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

- **Redemption code consumption (MVP):** validate a customer's code and redeem it. Each code can be used only once.
- **Partner and staff access:** partner admins and their staff sign in and see only their own partner's data.
- **Voucher statistics per service:** how many vouchers we have sold for each service and how many have been redeemed.
- **FAQs:** per-service answers to questions customers commonly ask our partners.
- **Service landing pages:** a page for each service with tailored marketing images and scripts.

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
├── supabase/
│   ├── config.toml      # Local Supabase configuration
│   ├── migrations/      # Database schema migrations
│   ├── tests/           # pgTAP database tests
│   └── functions/       # Edge Functions and their Deno tests
└── package.json         # Pinned Supabase CLI and shared dev scripts
```

## Getting started

### Prerequisites

- Node.js and npm
- Docker (required by the local Supabase stack)
- Deno 2 (optional, only needed to run Edge Function tests)

### Install

```sh
npm install
npm install --prefix web
```

### Backend (Supabase)

The backend runs locally through the Supabase CLI:

```sh
npx supabase start          # start the local stack
npx supabase status         # show local URLs and keys
npx supabase migration up   # apply pending migrations
npx supabase test db        # run database tests
npx supabase stop           # stop the local stack
```

Local Studio is available at <http://127.0.0.1:54323> while the stack is running.

### Frontend

1. Copy [`web/.env.example`](web/.env.example) to `web/.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the values from `npx supabase status`.
3. Run the app:

```sh
npm run dev     # start the dev server
npm run build   # production build
npm run lint    # lint the frontend
```