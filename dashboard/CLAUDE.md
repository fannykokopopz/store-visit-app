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
- `/` — team stats overview
- `/visits` — all visits feed, filter by CM/store/date, expandable rows
- `/staff` — staff & allies by store, toggle ally status
- `/login` — Telegram login widget
- `/api/auth/telegram` — OAuth callback (public)
- `/api/auth/me` — current session user
- `/api/auth/logout` — POST to clear cookie
- `/api/stats` — team stats
- `/api/visits` — visit feed (GET, paginated, filterable)
- `/api/staff` — staff list (GET) + ally toggle (PATCH)
- `/api/filters` — CM + store options for filter dropdowns
