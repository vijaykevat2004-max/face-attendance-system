# Face Attendance System — Setup Guide

## Current setup
This app runs on **Vercel** (app hosting) + **Neon Postgres** (database) —
live at the production URL, using `DATABASE_URL` / `DATABASE_URL_UNPOOLED`
env vars (no local SQLite file — that was the original scaffold, since
replaced). Secrets (`SESSION_PASSWORD`, `BANK_ENCRYPTION_KEY`, `CRON_SECRET`)
live in Vercel's encrypted environment variables, not in code.

Want to move off Vercel later (e.g. to a cheaper VPS)? See **`VPS-DEPLOY.md`**
— no code changes needed, just a different host.

## First-time local setup
```bash
# 1. Install dependencies
npm install

# 2. Create .env with the same DATABASE_URL / DATABASE_URL_UNPOOLED /
#    SESSION_PASSWORD / BANK_ENCRYPTION_KEY / CRON_SECRET used in production
#    (copy from Vercel dashboard → Settings → Environment Variables)

# 3. Generate Prisma client
npx prisma generate

# 4. Make sure the schema matches the DB (safe no-op if already in sync)
npx prisma db push

# 5. Build for production
npm run build

# 6. Start the server
bash start.sh
```

Server runs at: **http://localhost:3000**
Login: **admin / admin123** (change this in production — see Employee/Admin management)

## If you just want to develop (no build)
```bash
npm install
npx prisma generate
npm run dev
```
This runs on http://localhost:3000 with hot reload.

## Notes
- Face recognition models are already in `public/models/` — no extra download
  needed. Face matching happens in the browser via face-api.js.
- If face scan doesn't work: check the browser console for camera permission
  errors first — most face-scan issues are camera/HTTPS permission issues,
  not app bugs (browsers block camera access on non-localhost HTTP origins).
- Production (Vercel) already serves over HTTPS, so this only matters for
  local/VPS setups without a domain + TLS cert.
