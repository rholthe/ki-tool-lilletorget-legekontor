#!/usr/bin/env bash
# SSH-tunnel til prod-databasen (shared-mariadb) for lokal utvikling.
# Kjør fra prosjektroten (Git Bash på Windows):
#   bash db-tunnel.sh
#
# MariaDB-containerens port 3306 er ikke publisert til host på VPS-en, så vi
# tunneler mot containerens interne IP på Docker-nettverket «app-backend».
# IP-en slås opp automatisk ved hver kjøring (den kan endre seg hvis
# containeren fjernes og opprettes på nytt).
#
# Tunnelen blokkerer terminalen så lenge den lever — avslutt med Ctrl+C.
# Lokal DATABASE_URL skal peke på localhost:<LOCAL_PORT>.
#
# Overstyrbare variabler: REMOTE, KEY, CONTAINER, NETWORK, LOCAL_PORT
set -euo pipefail

REMOTE="${REMOTE:-ragnar@159.195.146.240}"
KEY="${KEY:-$HOME/.ssh/legeassist_vps_new}"
CONTAINER="${CONTAINER:-shared-mariadb}"
NETWORK="${NETWORK:-app-backend}"
LOCAL_PORT="${LOCAL_PORT:-3306}"

if netstat -an 2>/dev/null | grep -qE "[:.]${LOCAL_PORT}[[:space:]]+.*LISTEN"; then
  echo "==> Port $LOCAL_PORT er allerede i bruk lokalt."
  echo "    Tunnelen kjører sannsynligvis fra før — avslutt den først, eller"
  echo "    velg en annen port: LOCAL_PORT=3307 bash db-tunnel.sh"
  exit 1
fi

echo "==> Slår opp IP for '$CONTAINER' på nettverket '$NETWORK'..."
CONTAINER_IP="$(ssh -i "$KEY" -o BatchMode=yes "$REMOTE" \
  "docker inspect '$CONTAINER' --format '{{ (index .NetworkSettings.Networks \"$NETWORK\").IPAddress }}'" \
  | tr -d '\r')"

if [ -z "$CONTAINER_IP" ] || [ "$CONTAINER_IP" = "<no value>" ]; then
  echo "==> FEIL: fant ingen IP for '$CONTAINER' på '$NETWORK'."
  echo "    Sjekk at containeren kjører: ssh -i \"$KEY\" $REMOTE 'docker ps'"
  exit 1
fi

echo "==> Fant $CONTAINER på $CONTAINER_IP"
echo "==> Åpner tunnel: localhost:$LOCAL_PORT -> $CONTAINER_IP:3306"
echo "    (Ctrl+C for å avslutte)"
exec ssh -i "$KEY" -N -L "$LOCAL_PORT:$CONTAINER_IP:3306" "$REMOTE"
