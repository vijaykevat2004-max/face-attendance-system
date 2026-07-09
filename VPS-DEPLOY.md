# Moving off Vercel to a VPS — Deployment Guide

This app needs no code changes to run on a VPS instead of Vercel — it's a
standard Next.js app that reads all secrets from environment variables. This
guide is the exact copy-paste path for when you decide to move.

**You do NOT need to migrate the database.** You can keep using the existing
Neon Postgres database (same `DATABASE_URL` / `DATABASE_URL_UNPOOLED`) and
just move where the *app* runs — that's the simplest, lowest-risk move and
still ends up far cheaper than Vercel Pro. Self-hosting Postgres on the same
VPS too is an optional further step covered at the bottom.

## What you'll need
- A VPS (DigitalOcean, Hetzner, Linode, etc.) — a $5-6/month box (1 vCPU, 1-2GB RAM) is enough for a small team
- Ubuntu 22.04+ recommended
- A domain name (or subdomain) pointed at the VPS's IP — required for HTTPS, which the camera needs
- SSH access to the VPS

## 1. Server setup (one-time)
```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Caddy (reverse proxy + automatic free HTTPS via Let's Encrypt)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# PM2 (keeps the app running, restarts on crash/reboot)
sudo npm install -g pm2
```

## 2. Get the code onto the VPS
Copy this whole project folder to the VPS (via `git clone` if you push it to a
repo, or `scp -r`/`rsync`). Then:
```bash
cd face-attendance-system
npm install
```

## 3. Environment variables
Create `.env` in the project root with the **same values already used on
Vercel** (check `vercel env ls` locally, or the Vercel dashboard → Settings →
Environment Variables, to copy them):
```
DATABASE_URL=<same Neon pooled URL>
DATABASE_URL_UNPOOLED=<same Neon direct URL>
SESSION_PASSWORD=<same value>
BANK_ENCRYPTION_KEY=<same value — changing this makes existing encrypted bank data unreadable>
CRON_SECRET=<same value>
```

## 4. Build and start
```bash
npx prisma generate
npm run build
pm2 start .next/standalone/server.js --name face-attendance
pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot
```

## 5. HTTPS via Caddy
Edit the `Caddyfile` in the project root — replace the `:81` block's domain
handling (or add your domain) so it looks like:
```
yourdomain.com {
	reverse_proxy localhost:3000
}
```
Then:
```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```
Caddy automatically gets and renews a free HTTPS certificate. Point your
domain's DNS A record at the VPS IP before this step.

## 6. Replace the monthly payroll cron
Vercel Cron (`vercel.json`) doesn't exist off-Vercel — use a system crontab
entry that hits the same endpoint instead:
```bash
crontab -e
# add this line (runs 1st of every month, 8:30 AM IST = 3:00 AM UTC):
0 3 1 * * curl -s -H "Authorization: Bearer <your CRON_SECRET>" https://yourdomain.com/api/cron/generate-payroll >> /var/log/payroll-cron.log 2>&1
```

## 7. Verify
- Visit `https://yourdomain.com` — should show the login page over HTTPS
- Log in, check the kiosk/site-checkin camera works (needs the HTTPS to be live)
- `pm2 logs face-attendance` to watch server output
- `pm2 status` to confirm it's running; it will auto-restart on crash or VPS reboot

## Optional: also self-host Postgres (maximum cost savings)
If you eventually want to drop Neon too and run Postgres on the same VPS:
```bash
sudo apt install -y postgresql
sudo -u postgres createdb faceattendance
sudo -u postgres createuser --pwprompt faceattendance_user
```
Then update `DATABASE_URL` / `DATABASE_URL_UNPOOLED` in `.env` to point at
`localhost` instead of Neon, run `npx prisma db push`, and **migrate existing
data first** (`pg_dump` from Neon, `pg_restore`/`psql` into the local DB) —
don't do this step without a tested backup, since it moves the only copy of
your live data. This step is optional and only worth it once Neon's free tier
is genuinely too small for you (see the earlier size check — that's a long
way off).
