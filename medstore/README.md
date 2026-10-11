# MedStore — multi-brand pharmacy storefront (v2, PKR)

One codebase, many brands. Each brand (pharmacy / hospital client) gets its own domain, theme, catalogue,
customers, orders and admin login. Prices and payments are in **Pakistani Rupees (PKR)**.

## Logins
| Who | Where | Credentials |
|---|---|---|
| Super admin (you) | `/login` on ANY store site (or `/super` for the platform page) | `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from backend `.env` (default `admin@medstore.local` / `ChangeMe123!`) |
| Store admin (client) | `/login` of their store | created in /super → "Create store", demo: `admin@carewell.test` / `Password123!` |
| Customers | `/register` | self sign-up |

> The old "Invalid credentials" bug: the super admin has no store, and the old `/login` only searched inside a store.
> `/login` now also accepts the super admin. Re-run `npm run db:seed` in `backend` to re-sync the super-admin password from `.env`.

## Run locally (one command)
```
npm start
```
(needs Docker Desktop for the local database, or put your own Postgres/Supabase URL in `backend/.env`)

## Upgrade an EXISTING database (the one you already have on Supabase)
```
cd backend
npm install
npx prisma db push          # adds the new columns (delivery fee, wallet payments, indexes…)
npm run db:pkr              # switches currency to PKR, removes demo picsum pictures
#   add  --convert  ONLY if the prices are still the USD demo prices (multiplies by 280)
npm run db:seed             # re-syncs super admin password; creates demo stores only if missing
```

## Deploy on Vercel (two projects from one GitHub repo)
**1. API** — New Project → import repo → *Root Directory* = `backend`
   - Environment variables: see `backend/.env.example` (`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `SUPER_ADMIN_*`,
     `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`, `INTEGRATION_API_KEY`)
   - `DATABASE_URL` = Supabase **Transaction pooler** string (port 6543).
   - Open `https://<api>.vercel.app/api/health` → must show `{"ok":true}`.
**2. Website** — New Project → same repo → *Root Directory* = `frontend`
   - `NEXT_PUBLIC_API_URL` = `https://<api>.vercel.app/api`
   - `NEXT_PUBLIC_DEFAULT_BRAND` = `carewell`
   - Add the client's domain in Vercel → Domains, and put the same domain in /super (Brand → domain).

**Speed:** the `regions` value in `backend/vercel.json` and `frontend/vercel.json` must be the Vercel region closest to your
Supabase project (Mumbai Supabase → `bom1`, Singapore → `sin1`). API and database in different continents is the #1 cause of slow pages.

## Product pictures
Create a **public** bucket called `product-images` in Supabase → Storage, then set `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` (Project settings → API) in the **API** project. The admin can then upload / replace pictures
(they are resized in the browser first). Without it, admins can still paste an image URL.

## Payments (PKR)
- **Cash on delivery** — works out of the box.
- **JazzCash / Easypaisa / Bank transfer** — turn on in Admin → Settings, write your account details in "payment instructions".
  The customer pays, enters the transaction ID; the admin verifies and presses **Mark paid**.
- **Card** — Stripe is wired in but Stripe does not onboard Pakistani merchants. For automatic card/wallet payments in
  Pakistan use PayFast, SafePay, Easypaisa or JazzCash merchant APIs (needs the client's merchant account — can be added later).

## MediCore connection
MedStore exposes `GET /api/integration/analytics` (header `x-api-key: INTEGRATION_API_KEY`) with revenue, orders,
customers, daily series and top products for every store. Copy the files in `integrations/medicore/` into MediCore:
`app/api/integrations/medstore/route.ts` and `components/MedStoreAnalytics.tsx`, set `MEDSTORE_API_URL` and `MEDSTORE_API_KEY`
in MediCore, and render `<MedStoreAnalytics />` on the super-admin dashboard.
Optional push: set `MEDICORE_WEBHOOK_URL` + `MEDICORE_WEBHOOK_SECRET` and every new order / status change is POSTed
(HMAC-SHA256 in header `x-medstore-signature`).
