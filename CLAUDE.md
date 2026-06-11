# CoSpace — Claude Code Instructions

This file tells Claude Code exactly what to do when you open this project.
Just open your terminal in this folder and run `claude`, then paste one of
the prompts below.

---

## First time setup (do this once)

Paste this entire message into Claude Code:

```
Please set up the CoSpace project on my machine. Do all of these steps:

1. Check if Node.js 18+ is installed. If not, tell me to install it from nodejs.org first.
2. Run `npm install` to install all dependencies.
3. Copy `.env.example` to `.env.local` if `.env.local` doesn't already exist.
4. Tell me what values I need to fill in inside `.env.local` and where to get each one.
5. Once I confirm the env file is filled in, run `npm run dev` to start the local server.
6. Open http://localhost:3000 in my browser.
```

---

## Push to GitHub and deploy to Vercel

Paste this entire message into Claude Code:

```
Please deploy the CoSpace project for me. Do all of these steps in order:

1. Check if git is installed and if this folder is already a git repo. If not, run `git init`.
2. Check if the GitHub CLI (`gh`) is installed. If not, install it by running:
   - Mac: `brew install gh`
   - Windows: `winget install GitHub.cli`
   - Linux: follow https://cli.github.com/manual/installation
3. Run `gh auth login` so I can authenticate with GitHub (walk me through it).
4. Create a new private GitHub repository called `cospace` using `gh repo create cospace --private --source=. --push`.
5. Check if the Vercel CLI is installed. If not, run `npm install -g vercel`.
6. Run `vercel` to start the Vercel deployment wizard and walk me through it step by step.
7. When Vercel asks for environment variables, remind me to add these 5 variables in the Vercel dashboard:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
   - STRIPE_SECRET_KEY
8. After deployment, open the live Vercel URL in my browser.
```

---

## Set up Supabase database

Paste this entire message into Claude Code:

```
I need to set up the Supabase database for CoSpace. Please:

1. Check if the Supabase CLI is installed. If not, install it:
   - Mac: `brew install supabase/tap/supabase`
   - Windows/Linux: `npm install -g supabase`
2. Ask me for my Supabase project URL and service role key (from supabase.com → project → Settings → API).
3. Use the Supabase CLI or the REST API to run the SQL file at `supabase-schema.sql` against my project.
4. Confirm each table was created successfully by listing the tables.
5. Tell me to go to Supabase → Authentication → URL Configuration and add my Vercel URL as the redirect URL.
```

---

## Add environment variables to Vercel

Paste this entire message into Claude Code:

```
Please add my environment variables to my Vercel deployment. I have these values ready:

- NEXT_PUBLIC_SUPABASE_URL = [I will tell you]
- NEXT_PUBLIC_SUPABASE_ANON_KEY = [I will tell you]
- SUPABASE_SERVICE_ROLE_KEY = [I will tell you]
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = [I will tell you]
- STRIPE_SECRET_KEY = [I will tell you]
- NEXT_PUBLIC_APP_URL = [my Vercel URL]

Use the Vercel CLI to add each one: `vercel env add VARIABLE_NAME`
Then run `vercel --prod` to redeploy with the new variables.
```

---

## Everyday development commands

Paste any of these into Claude Code when you need them:

**Start the local server:**
```
Run `npm run dev` and open http://localhost:3000
```

**After making code changes, redeploy:**
```
Run `git add . && git commit -m "update" && git push` then `vercel --prod`
```

**Check if the live site is working:**
```
Open my Vercel URL and check that the home page loads and I can sign up.
If anything is broken, check the Vercel logs with `vercel logs`.
```

**Reset the database (careful — deletes all data):**
```
Run the supabase-schema.sql file again against my Supabase project to reset all tables.
Warn me before doing this.
```

---

## If something goes wrong

Paste this into Claude Code:

```
The CoSpace app is broken. Please help me debug it:
1. Run `npm run build` and show me any errors.
2. Check `vercel logs` for any runtime errors on the live site.
3. Check that all environment variables are set with `vercel env ls`.
4. Check the Supabase dashboard for any database errors.
Tell me what you find and fix it.
```

---

## Project structure (for reference)

```
cospace-mvp/
├── app/
│   ├── page.tsx              ← Home / search page
│   ├── rooms/page.tsx        ← Listing detail + booking widget
│   ├── bookings/page.tsx     ← Guest's booking history
│   ├── host/page.tsx         ← Host dashboard
│   ├── profile/place/page.tsx ← Create/edit listing wizard
│   └── auth/
│       ├── login/page.tsx
│       ├── signup/page.tsx
│       └── callback/route.ts ← OAuth redirect handler
├── components/
│   └── layout/Header.tsx
├── lib/
│   ├── supabase.ts           ← Supabase client + TypeScript types
│   ├── supabase-server.ts    ← Server-side Supabase client
│   └── pricing.ts            ← Price calculation logic
├── supabase-schema.sql       ← Paste into Supabase SQL editor
├── .env.example              ← Copy to .env.local and fill in
└── CLAUDE.md                 ← This file
```

---

## What each environment variable is and where to get it

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | supabase.com → your project → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | supabase.com → your project → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | supabase.com → your project → Settings → API → service_role key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | stripe.com → Developers → API Keys → Publishable key |
| `STRIPE_SECRET_KEY` | stripe.com → Developers → API Keys → Secret key |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL after first deploy, e.g. https://cospace.vercel.app |
