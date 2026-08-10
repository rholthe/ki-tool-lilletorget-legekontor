#!/usr/bin/env bash
# Deploy fra UTVIKLINGSMASKINEN: pusher gjeldende branch og bygger + restarter
# Docker-containeren på serveren i én operasjon. Kjør fra prosjektroten
# (Git Bash på Windows):
#   bash push-and-deploy.sh
#
# Overstyrbare variabler: REMOTE, KEY, APP_DIR
set -euo pipefail

REMOTE="${REMOTE:-ragnar@159.195.146.240}"
KEY="${KEY:-$HOME/.ssh/legeassist_vps_new}"
APP_DIR="${APP_DIR:-/home/ragnar/apps/legeassist}"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "==> Pusher '$BRANCH' til origin"
git push origin "$BRANCH"

echo "==> Deployer på $REMOTE:$APP_DIR"
ssh -i "$KEY" -o BatchMode=yes "$REMOTE" \
  "cd '$APP_DIR' && ./deploy.sh"

echo "==> Venter på at appen svarer på https://ki.lilletorget.org/login..."
for i in $(seq 1 15); do
  code="$(curl -sS -o /dev/null -w "%{http_code}" "https://ki.lilletorget.org/login" 2>/dev/null || echo 000)"
  if [ "$code" = "200" ]; then
    echo "==> OK: HTTP 200 på /login"
    break
  fi
  if [ "$i" = "15" ]; then
    echo "==> ADVARSEL: appen svarte ikke 200 innen tidsfristen (siste: $code)"
  fi
  sleep 2
done

echo "==> Ferdig. https://ki.lilletorget.org"
