# CoSpace MVP

Next.js + Supabase + Stripe workspace booking platform.

## Deploy in 4 steps

### Step 1 — Supabase (5 min)
1. Go to supabase.com → New project
2. Go to SQL Editor → paste contents of `supabase-schema.sql` → Run
3. Go to Settings → API → copy `Project URL` and `anon public` key
4. Go to Authentication → Providers → enable Email and Google

### Step 2 — Vercel (2 min)
1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → import your repo
3. Add environment variables (from .env.example):
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` → your Supabase service role key
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → from Stripe dashboard
   - `STRIPE_SECRET_KEY` → from Stripe dashboard
   - `NEXT_PUBLIC_APP_URL` → your Vercel URL (after first deploy)
4. Deploy

### Step 3 — Supabase auth redirect (1 min)
1. In Supabase → Authentication → URL Configuration
2. Set Site URL to your Vercel URL
3. Add `https://your-app.vercel.app/auth/callback` to Redirect URLs

### Step 4 — Done
Visit your Vercel URL. Sign up, create a listing, book a space.

## Local development
```bash
cp .env.example .env.local
# fill in your Supabase and Stripe keys
npm install
npm run dev
```

## Pages
- `/` — Browse all listings
- `/rooms?id=XXX` — Listing detail + booking
- `/bookings` — Guest's booking history
- `/host` — Host dashboard (bookings, calendar, earnings)
- `/profile/place` — Create/edit listing (9-step wizard)
- `/auth/login` — Sign in
- `/auth/signup` — Create account
