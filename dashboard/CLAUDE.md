# SVA Dashboard

AM/IC web dashboard for TC Store Visit App.

## Stack
- Next.js 16 + Tailwind 4 + TypeScript
- Same Supabase project as bot/miniapp (`sva` schema, service role)
- Auth: Telegram Login Widget → signed session cookie

## Setup
1. Copy `.env.example` → `.env.local`, fill in vars
2. In BotFather: `/setdomain` → set to your Railway domain (required for Telegram Login Widget)
3. `npm install && npm run dev`

## Env vars
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — same as bot/miniapp
- `TELEGRAM_BOT_TOKEN` — same as bot
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` — bot username without @
- `SESSION_SECRET` — random 32+ char string (`openssl rand -hex 32`)

## Deploy (Railway)
- Root Directory: `/dashboard`
- Watch paths: `dashboard/**`
- Build: `npm run build`, Start: `npm start`
- Add all env vars to the Railway service

## Routes
- `/` — Home: KPI cards + store status grid + **weekly payroll grid** (range chips + custom from/to, AM-grouped CM rows)
- `/visits` — Store Updates: 2-up card grid; section chips are **single-section focus** (tap Good News → only Good News visits + only that section card per visit), not multi-select "has" filters; sections inside cards stack 1-column
- `/staff` — Staff & Allies: store-grouped, ally toggle, training pills (count + last-trained + products) from `visit_staff` (mig 005); market chips + search + filter chips
- `/login` — Telegram login widget
- `/api/auth/telegram` — OAuth callback (public)
- `/api/auth/me` — current session user
- `/api/auth/logout` — POST to clear cookie
- `/api/stats` — team stats
- `/api/overview` — stats + store status (payroll moved out)
- `/api/payroll?from=&to=` — weekly payroll grid (added 2026-05-17). Default range: last 4 weeks. Co-CM credit via `sva.visit_cms` when available; falls back to lead CM only.
- `/api/visits` — visit feed (GET, paginated, filterable)
- `/api/staff` — staff list with training aggregates (GET) + ally toggle (PATCH)
- `/api/filters` — CM + store options for filter dropdowns
