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

echo "==> Venter på at appen svarer på port $PORT..."
for i in $(seq 1 15); do
  code="$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/login" 2>/dev/null || echo 000)"
  if [ "$code" = "200" ]; then
    echo "==> OK: HTTP 200 på /login"
    break
  fi
  if [ "$i" = "15" ]; then
    echo "==> ADVARSEL: appen svarte ikke 200 innen tidsfristen (siste: $code)"
  fi
  sleep 2
done
