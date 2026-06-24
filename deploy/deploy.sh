#!/usr/bin/env bash
# Oppdater og restart legeassist PÅ SERVEREN.
# Kjøres på serveren (som bruker ragnar):
#   bash /var/www/legeassist/deploy/deploy.sh
#
# Forutsetter at /var/www/legeassist/.env allerede er fylt ut.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/legeassist}"
PM2_NAME="${PM2_NAME:-legeassist}"
PORT="${PORT:-3001}"

cd "$APP_DIR"

echo "==> git pull"
git pull --ff-only

echo "==> npm ci"
npm ci

echo "==> prisma generate"
npx prisma generate

# DB deles med dev og har vanligvis skjemaet fra før. Kjør db push kun ved behov:
#   PRISMA_DB_PUSH=1 bash deploy/deploy.sh
if [ "${PRISMA_DB_PUSH:-0}" = "1" ]; then
  echo "==> prisma db push"
  npx prisma db push
fi

echo "==> next build"
npm run build

echo "==> pm2"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  PORT="$PORT" pm2 start npm --name "$PM2_NAME" -- start
fi
pm2 save

echo "==> ferdig. Sjekker port $PORT:"
curl -sS -o /dev/null -w "  HTTP %{http_code} på /login\n" "http://127.0.0.1:${PORT}/login" || true
