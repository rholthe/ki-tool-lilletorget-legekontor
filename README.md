# legeassist

Nettbasert KI-assistent for fastleger. Tar opp konsultasjonen, transkriberer tale i sanntid med
[Soniox](https://soniox.com) og lager journalnotat og andre kliniske dokumenter med Claude via
AWS Bedrock i EU. Norsk brukergrensesnitt.

**Pasientinnhold er aldri innom applikasjonsserveren.** Lyd går fra nettleseren direkte til Soniox,
og transkript/kontekst går fra nettleseren direkte til Bedrock i EU. Serveren deler bare ut
kortlivede nøkler, og lagrer brukerkontoer, maler, innstillinger og forbrukstall.

- Arkitektur, regler og konvensjoner: [`CLAUDE.md`](CLAUDE.md)
- Detaljer per område: [`docs/`](docs/) (start med [`docs/mappestruktur.md`](docs/mappestruktur.md))

> `CLAUDE.md` og `docs/` beskriver den opprinnelige installasjonen (ki.lilletorget.org). Server-IP,
> SSH-nøkler, e-postoppsett og AWS-konto der gjelder bare den, ikke din installasjon.

## Stack

Next.js (App Router) · React · Tailwind/shadcn · NextAuth v5 (passord + obligatorisk 2FA/passkeys) ·
Prisma 7 med mariadb-adapter · MariaDB · Docker · Caddy som reverse proxy.

## Installere på egen server

### 1. Kontoer og tjenester du trenger

| Tjeneste | Hva | Miljøvariabler |
|---|---|---|
| Server | Linux-VPS i EU med Docker og Docker Compose, et domene med DNS mot serveren | `APP_URL`, `AUTH_URL` |
| MariaDB | 10.11+ (egen container eller eksisterende). Tom database + egen bruker | `DATABASE_URL` |
| AWS Bedrock | AWS-konto med tilgang til Anthropic-modellene i eu-central-1 (aktiveres under «Model access» i Bedrock-konsollen) | `BEDROCK_*`, `ANTHROPIC_MODEL`, `AWS_REGION` |
| Soniox | Konto og API-nøkkel, helst EU-prosjekt | `SONIOX_*` |
| SMTP | En postboks som kan sende e-post (invitasjoner, glemt passord) | `SMTP_*` |
| Helsedirektoratet (valgfri) | API-nøkkel fra utvikler.helsedirektoratet.no (produksjon, ikke QA) | `HELSEDIR_API_KEY` |

### 2. IAM-bruker for Bedrock

Lag en egen IAM-bruker (ikke root) med tilgangsnøkkel, og gi den denne policyen (bytt `<KONTO-ID>`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": [
        "arn:aws:bedrock:eu-*:*:inference-profile/eu.anthropic.*",
        "arn:aws:bedrock:eu-*::foundation-model/anthropic.*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "sts:GetFederationToken",
      "Resource": "arn:aws:sts::<KONTO-ID>:federated-user/la-*"
    }
  ]
}
```

Serveren bruker nøkkelen bare til å lage 1-times STS-nøkler per innlogget bruker
(`src/app/api/ai/oppsett/route.ts`), og nettleseren kaller Bedrock med dem. Slå av
«Model invocation logging» i Bedrock hvis du ikke vil at AWS skal logge innholdet.

### 3. Hent koden og fyll inn `.env`

```bash
git clone https://github.com/rholthe/ki-tool-lilletorget-legekontor.git legeassist
cd legeassist
cp .env.example .env
# Generer AUTH_SECRET og TOTP_ENCRYPTION_KEY (kjør to ganger):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Fyll inn alle verdiene i `.env`. Kommentarene i [`.env.example`](.env.example) forklarer hver nøkkel.
`TOTP_ENCRYPTION_KEY` må ikke byttes senere: den krypterer 2FA-hemmeligheter og brukernes datanøkler.

### 4. Docker og reverse proxy

`docker-compose.yml` forventer to eksterne Docker-nettverk: `reverse-proxy_default` (der Caddy er)
og `app-backend` (der MariaDB er). Enten lager du dem:

```bash
docker network create reverse-proxy_default
docker network create app-backend
```

og kobler Caddy- og MariaDB-containerne til dem, eller så tilpasser du `docker-compose.yml` til
oppsettet ditt (for eksempel en MariaDB-tjeneste i samme compose-fil). Appen lytter på `PORT`
(3001) inne i containeren. Eksempel på Caddyfile:

```
legeassist.eksempel.no {
    reverse_proxy legeassist:3001
}
```

HTTPS er påkrevd: mikrofon, passkeys og krypteringen i nettleseren virker bare over https
(eller på localhost).

### 5. Bygg, start og lag databasetabellene

```bash
docker compose build
docker compose up -d
docker exec legeassist npx prisma db push     # lager tabellene fra prisma/schema.prisma
docker compose restart
```

`./deploy.sh` gjør det samme pluss `git pull`, og brukes ved senere oppdateringer.

### 6. Første administrator

Selvregistrering er av, og brukere opprettes av en admin. Den første lager du med skriptet
(e-posten må stå i `ADMIN_EMAILS`):

```bash
docker exec -it legeassist node scripts/opprett-admin.mjs admin@eksempel.no "Fornavn Etternavn"
```

Skriptet skriver ut en engangslenke. Åpne den, sett passord og godta databehandleravtalen.
To-faktor (TOTP eller passkey) må settes opp før Claude og transkripsjon kan brukes. Deretter:

- `/admin/innstillinger`: velg modell og region, trykk «Test Bedrock-tilkobling»
- `/admin/brukere`: inviter legene (invitasjonen går på e-post via SMTP)

### 7. Tilpass til din virksomhet

Disse stedene har navn eller domene fra den opprinnelige installasjonen:

| Fil | Hva du endrer |
|---|---|
| `src/lib/dpa.ts` | Grunnversjonen av databehandleravtalen nevner den opprinnelige databehandleren. Skriv om partene, eller publiser din egen versjon på `/admin/databehandleravtale` |
| `src/app/databehandleravtale/page.tsx` | Kontaktadressen nederst på den offentlige personvernsiden |
| `nettleserutvidelse/pridok/` | Utvidelsen «Send til journal» (valgfri) har domenet hardkodet i `manifest.json` og `bakgrunn.js`, og et eget utvidelses-id. Bytt til ditt domene og signer selv, se [`docs/pridok-utvidelse.md`](docs/pridok-utvidelse.md) |
| `push-and-deploy.sh`, `db-tunnel.sh`, `db-tunnel.ps1` | Server-IP, SSH-nøkkel og domene (kan også overstyres med `REMOTE`, `KEY`, `APP_DIR`) |

Skjemaene (oppgavetypen Skjema) ligger i databasen, ikke i koden. Definisjonene under
`scripts/skjema/definisjoner/` kan legges inn med `scripts/skjema/legg-inn.mjs` og PDF-malen fra
utstederen, se [`docs/legge-inn-skjema.md`](docs/legge-inn-skjema.md).

### Personvern og ansvar

Den som drifter en installasjon er databehandler for legene som bruker den, og trenger egne
avtaler med underleverandørene (Soniox DPA, AWS, hostingleverandøren), egen databehandleravtale
med legene og egen risikovurdering. Koden er laget for at pasientinnhold ikke skal innom serveren,
men det fritar ikke for disse vurderingene.

## Lokal utvikling

```bash
npm ci
cp .env.example .env     # pek DATABASE_URL mot en lokal/tunnelert MariaDB, fjern AUTH_URL
npx prisma generate      # db push kjører ikke generate i Prisma 7
npx prisma db push
npm run dev              # http://localhost:3000
```

Det finnes ingen testrunner. Kliniske verktøy kontrolleres med `npm run verktoy:test`.
