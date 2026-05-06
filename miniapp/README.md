# TC SVA Mini App

Telegram Mini App for CMs — richer mobile views over the same `sva` Supabase schema the bot uses.

## Phase 1 (read-only)

- `/m` — Portfolio: assigned stores with last-visit-ago + 30d count
- `/m/store/[id]` — Per-store visit timeline
- `/m/visit/[id]` — Full visit details + photo gallery (signed URLs)

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind 4
- Supabase (`sva` schema, service role)
- Telegram Mini App `initData` HMAC auth

## Local dev

```bash
cp .env.example .env.local
npm install
npm run dev
```

Then expose via ngrok / localtunnel and set the Mini App URL on the bot via `/setmenubutton` in BotFather.

## Architecture

- Auth: client posts `Authorization: tma <initData>`. Server verifies HMAC against `BOT_TOKEN`, then looks up `sva.cms` by `telegram_id`. CM identity drives all subsequent reads.
- All API routes live under `/api/m/*`. They are the only caller of Supabase service-role — no direct client access.
- Photos: short-lived signed URLs (5 min) via `sva-photos` bucket.
