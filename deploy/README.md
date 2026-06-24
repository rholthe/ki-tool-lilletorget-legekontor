# Deploy – legeassist på server.lilletorget.org

App: Next.js på **pm2** (port **3001**), bak **Apache + certbot**, domene **ki.lilletorget.org**.
Database: samme **MariaDB** som i dev (lokal `localhost:3306` på serveren; i dev nås den via SSH-tunnel).

## 0. Logg inn på SSH (ny terminal)

```bash
ssh -i ~/.ssh/legeassist_vps ragnar@lilletorget.org
```

På Windows (PowerShell/cmd) bruk full sti:

```powershell
ssh -i C:\Users\ragna\.ssh\legeassist_vps ragnar@lilletorget.org
```

Valgfritt – legg til i `~/.ssh/config` så det holder med `ssh ki`:

```
Host ki
    HostName lilletorget.org
    User ragnar
    IdentityFile ~/.ssh/legeassist_vps
```

## 1. Hent koden (som bruker `ragnar`)

```bash
cd /var/www/legeassist
git clone git@github.com:rholthe/ki-tool-lilletorget-legekontor.git .
```

## 2. Miljøvariabler

```bash
cp .env.example .env
nano .env        # fyll inn hemmeligheter (DATABASE_URL-passord, AUTH_SECRET,
                 # TOTP_ENCRYPTION_KEY, SONIOX_API_KEY, BEDROCK-nøkler, SMTP_PASSWORD)
```

`APP_URL=https://ki.lilletorget.org` og `PORT=3001` er allerede satt i malen.

## 3. Bygg (Prisma-klient er gitignored → må genereres)

```bash
npm ci
npx prisma generate
# DB har allerede skjemaet (delt med dev). Kjør db push KUN ved nye endringer:
# npx prisma db push
npm run build
```

> ⚠️ Lite minne (≈840 MB ledig). Hvis `next build` blir drept (OOM), se «Swap» nederst.

## 4. Start med pm2

```bash
pm2 start npm --name legeassist -- start
pm2 save
# (pm2 startup er allerede satt opp for ragnar siden pokergutta kjører)
curl -I http://127.0.0.1:3001     # skal svare 200/3xx
```

## 5. Apache vhost + HTTPS (kjør med sudo i egen terminal)

```bash
sudo cp /var/www/legeassist/deploy/ki.lilletorget.org.conf /etc/apache2/sites-available/
sudo a2enmod proxy proxy_http headers rewrite ssl
sudo a2ensite ki.lilletorget.org.conf
sudo apache2ctl configtest
sudo systemctl reload apache2

# Utsteder SSL-sertifikat og lager ki.lilletorget.org-le-ssl.conf automatisk.
# Velg «Redirect» (tving HTTPS) når certbot spør.
sudo certbot --apache -d ki.lilletorget.org
```

Test: https://ki.lilletorget.org

## Oppdatering ved senere deploy

```bash
cd /var/www/legeassist
git pull
npm ci
npx prisma generate
npm run build
pm2 restart legeassist
```

## Swap (hvis build ryker pga. minne)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
# permanent: legg til i /etc/fstab:  /swapfile none swap sw 0 0
```
