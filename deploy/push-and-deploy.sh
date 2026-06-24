#!/usr/bin/env bash
# Deploy fra UTVIKLINGSMASKINEN: pusher gjeldende branch og bygger + restarter
# på serveren i én operasjon. Kjør fra prosjektroten (Git Bash på Windows):
#   bash deploy/push-and-deploy.sh
#
# Overstyrbare variabler: REMOTE, KEY, APP_DIR, PM2_NAME, PORT
set -euo pipefail

REMOTE="${REMOTE:-ragnar@lilletorget.org}"
KEY="${KEY:-$HOME/.ssh/legeassist_vps}"
APP_DIR="${APP_DIR:-/var/www/legeassist}"
PM2_NAME="${PM2_NAME:-legeassist}"
PORT="${PORT:-3001}"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "==> Pusher '$BRANCH' til origin"
git push origin "$BRANCH"

echo "==> Deployer på $REMOTE:$APP_DIR"
ssh -i "$KEY" -o BatchMode=yes "$REMOTE" \
  "APP_DIR='$APP_DIR' PM2_NAME='$PM2_NAME' PORT='$PORT' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail
cd "$APP_DIR"
echo "==> git pull";        git pull --ff-only
echo "==> npm ci";          npm ci
echo "==> prisma generate"; npx prisma generate
echo "==> next build";      npm run build
echo "==> pm2"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  PORT="$PORT" pm2 start npm --name "$PM2_NAME" -- start
fi
pm2 save
curl -sS -o /dev/null -w "==> HTTP %{http_code} på /login\n" "http://127.0.0.1:${PORT}/login" || true
REMOTE_SCRIPT

echo "==> Ferdig. https://ki.lilletorget.org"
