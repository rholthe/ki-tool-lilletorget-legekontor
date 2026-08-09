#!/usr/bin/env bash
# Deploy-script for legeassist / ki.lilletorget.org på ny VPS (Docker-basert).
# Kjøres på serveren: ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "Henter nyeste kode..."
git pull --ff-only

echo "Bygger nytt Docker-image..."
docker compose build

echo "Bytter til ny container..."
docker compose up -d

echo "Venter på at appen er oppe..."
sleep 3

echo "Synkroniserer Prisma-skjema mot databasen..."
docker exec legeassist npx prisma db push

echo "Restarter appen slik at eventuelle skjemaendringer tas i bruk..."
docker compose restart

echo "Ferdig!"
