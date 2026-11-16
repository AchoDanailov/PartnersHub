# Partners Hub web app

React, TypeScript, Vite and Tailwind. The interface is in Bulgarian. Setup and
commands are in the root `AGENTS.md`.

## Pages

| Route | Who | What |
| --- | --- | --- |
| `/services/:serviceId` | everyone | The service page a voucher's QR code opens (`?t=<qr_token>`): photos, marketing text, the voucher's state, and using it for staff |
| `/services` | signed-out visitors | Every service of every organization |
| `/` | staff and admins | Sign-in, using a voucher by its code, own services |
| `/dashboard` | admins | Voucher counts, used and unused vouchers, client questions |

A signed-in member sees only their own organization's services. Opening any
other service page, or `/services`, sends them to `/`.

## Layout

```
src/
  lib/         Supabase client, env (checked with Zod), formatting
  components/  shared UI: buttons, the bottom sheet, the header
  features/    auth, services, redeem (voucher flow), dashboard
  pages/       one component per route
```

Brand colors and fonts are tokens in `src/index.css` (`@theme`).
