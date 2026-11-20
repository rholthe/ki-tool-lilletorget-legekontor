# legeassist

Nettbasert KI-assistent for fastleger. Tar opp konsultasjoner mellom lege og pasient, transkriberer tale i sanntid ved hjelp av Soniox og genererer journalnotater og andre kliniske dokumenter ved hjelp av Claude AI.

## Prosjektstatus

Under aktiv utvikling. Kjerneflyt (opptak → transkript → notat) er implementert og fungerer.

## Arkitektur

### Overordnet prinsipp: Privacy-by-design

Pasientdata (lydopptak, transkripsjon, notater, vedlegg) er **aldri innom** applikasjonsserveren. Lyd går fra nettleseren til Soniox, og transkript, kontekst og vedlegg går fra nettleseren direkte til AWS Bedrock i EU. Serveren deler bare ut kortlivede nøkler (Soniox-token, STS-nøkler for Bedrock), prompt-overrides og modellvalg, og tar imot forbrukstall uten innhold (`/api/bruk`). Den lagrer brukerkontoer, maler, meldinger, bruksstatistikk og hver brukers krypterte datanøkkel.

### Dataflyt

```
VPS (legeassist-server) — aldri pasientinnhold
  ├── Autentisering, maler, meldinger, bruksstatistikk
  ├── /api/soniox-token   → kortlivet Soniox-nøkkel (merket med bruker-id)
  ├── /api/ai/oppsett     → kortlivede AWS-nøkler (STS GetFederationToken, 1 t, kun Claude i EU)
  │                          + modell/region + prompt-overrides (staging)
  └── /api/bruk           ← forbrukstall fra nettleseren (tokens, lydtid, tegn)

Nettleser (klinikkens datamaskin)
  ├──→ Soniox EU-endepunkt (direkte): lyd → sanntidstranskript
  └──→ AWS Bedrock eu-central-1 (direkte, SigV4 med STS-nøkler):
          systemprompt + transkript/kontekst/vedlegg → strømmet svar
```

### Stack

| Lag | Teknologi | Begrunnelse |
|---|---|---|
| Frontend | Next.js (React) | Fullstack i ett prosjekt, god DX |
| UI-komponenter | shadcn/ui + Tailwind CSS | Moderne, tilgjengelig, tilpassbart |
| Backend/API | Next.js API Routes | Integrert med frontend, enkelt å deploye |
| Database | MariaDB (selvhosted på VPS) | Full kontroll, ingen tredjepart |
| ORM | Prisma 7 (Rust-fri, mariadb-driveradapter) | Typesikker DB-tilgang |
| Autentisering | NextAuth v5 | Fleksibel, støtter credentials + 2FA |
| Transkripsjon | Soniox (EU-endpoint) | Sanntid, norsk språkstøtte, GDPR-compliant |
| AI-tekstgenerering | Anthropic Claude via AWS Bedrock | Kalles direkte fra nettleseren (`src/lib/bedrock-nettleser.ts`), eu.-profil, EU-databehandling |
| Hosting | Selvhosted VPS (EU) | Full kontroll, ingen tredjepart for pasientdata |

### Nøkkelhåndtering

- Soniox API-nøkkel lagres på serveren; brukes kun til å generere kortlivede temp-tokens
- Temp-tokens er gyldige i ~60 sekunder og er sesjonsspesifikke
- Sanntidsmodell: `stt-rt-v6`, satt ett sted i `src/lib/soniox-modell.ts` (`SONIOX_MODELL`).
  `stt-rt-v5` og `stt-rt-v4` fjernes 15.12.2026
- **Frist 15.01.2027:** Soniox avviser da tilkoblinger som bare sender nøkkelen som `api_key` i
  startmeldingen. Nøkkelen må sendes med selve tilkoblingen, som subprotokoll (`soniox-api-key`, nøkkel)
  eller `Authorization: Bearer`. `@soniox/speech-to-text-web` 1.4.0 (siste versjon) gjør det ikke.
  Etterfølgeren `@soniox/client` gjør det, men har et annet API. Se «Planlagt»
- Claude via AWS Bedrock: IAM-brukeren **`legeassist`** (egen bruker, ikke personlig) har policyen
  `bedrock-claude-eu` + `sts:GetFederationToken` på `arn:aws:sts::171433610132:federated-user/la-*`.
  Nøklene ligger i `.env` som `BEDROCK_API_KEY`/`BEDROCK_SECRET_KEY` og forlater aldri serveren.
  - `/api/ai/oppsett` lager kortlivede nøkler per bruker (`la-<userId>`, 1 t) med sesjonspolicy som bare
    tillater `InvokeModel(WithResponseStream)` på `eu.anthropic.*`/`anthropic.*` i `eu-*`. CloudTrail viser
    hvem som kalte. Verifisert 2026-10-09: EU virker, us-east-1 avvises
  - Region: eu-central-1 (Frankfurt) med `eu.`-prefiks modeller

## Funksjonalitet

Kjerneflyten er opptak → sanntidstranskript (Soniox) → notat (Claude), med autolagring i kryptert
IndexedDB (24 t). Detaljene per område ligger i `docs/`. **Les den aktuelle filen før du endrer noe
i området** — der står begrunnelsene, fallgruvene og hva som er testet.

| Område | Kort | Les før du endrer |
|---|---|---|
| Konsultasjon, Møte, Diktat, Journalgjennomgang, AI-hjelp | Opptak, notat, chat, vedlegg/OCR, promptbibliotek og staging, stikkord, hurtigtaster (`Alt+1..6`, `Alt+R/S/V`), diktering i tekstfelt, PDF i kontekst som tekst | `docs/oppgaver-og-konsultasjon.md` |
| Send til journal | Nettleserutvidelsen `nettleserutvidelse/pridok/` fyller notatet inn i Pridok. Teksten går bare mellom fanene | `docs/pridok-utvidelse.md` |
| Skjema | Oppgavetypen `SKJEMA`: admin definerer skjema, AI foreslår feltinnhold, sendes til Pridok eller lastes ned som utfylt PDF | `docs/skjema.md` |
| Legge inn et nytt skjema | Når Ragnar gir en PDF og Pridok-HTML og vil ha skjema, mapping og prompt lagt i databasen (`scripts/skjema/`) | `docs/legge-inn-skjema.md` |
| Kliniske verktøy | Skåringsverktøy, kalkulatorer, undersøkelser (`src/lib/verktoy/`) | `docs/kliniske-verktoy.md` |
| Retningslinjer og pakkeforløp | Hentes fra Helsedirektoratets API, vises ordrett (`src/lib/hapi/`) | `docs/retningslinjer-hapi.md` |
| Innlogging og økt | TOTP, gjenopprettingskoder, passkeys, obligatorisk 2FA, 1 t/12 t-regler, kryptering i nettleseren | `docs/sikkerhet-og-okt.md` |
| Admin | Brukere og invitasjoner, glemt passord, databehandleravtale, meldinger, bruksstatistikk | `docs/admin.md` |

Mappeoversikt: `docs/mappestruktur.md`.

### Regler som gjelder på tvers

- **Tall regnes av koden, aldri av Claude.** Poeng, terskler, doser og datoer i kliniske verktøy kommer
  fra `src/lib/verktoy/`. Kjør `npm run verktoy:test` etter hver endring i et verktøy
- **Kliniske tall hentes eller utledes fra kilden**, aldri fra hukommelsen. Retningslinjer vises og settes
  inn ordrett, med Helsedirektoratet som kilde (NLOD)
- **Personalia settes av koden.** I skjema fylles pasient-, lege- og datofelt av `fyllFraKilder`, ikke av
  Claude, og sendes ikke til Bedrock
- **Notat- og chattekst er ren tekst.** Den vises uten markdown-tolkning, så systempromptene i
  `src/lib/staging.ts` forbyr `**fet**`, `#`-overskrifter og stjernelister
- **Systemprompter er synlige for innloggede brukere** (nettleseren kaller Bedrock). Ingen hemmeligheter
  i staging-tekster
- **Prosjektet har ingen testrunner.** Ren logikk testes ved å kompilere med `tsc` og kjøre i Node;
  si alltid fra om hva som ikke er prøvd i nettleser
- **Lint:** kjernevisningene har kjente `set-state-in-effect`-feil som står urørt med vilje. Ikke legg
  til nye, og ikke kjør Prettier (prosjektet har det ikke)

### Status

- Skjema (med PDF-sporet, legeprofil og start fra konsultasjon) ble deployet 12.11.2026, men er **ikke
  prøvd i nettleser eller mot ekte Pridok/NAV-PDF-er**. Utvidelse 1.2.1 er signert for
  Firefox (12.11.2026), men ikke prøvd mot ekte Pridok
- Passkeys er ikke prøvd med ekte Bitwarden/YubiKey eller autoutfylling i e-postfeltet

### Planlagt
- **Før 15.01.2027:** bytte `@soniox/speech-to-text-web` med `@soniox/client` i `use-transkribering.ts`
  og `use-diktering.ts`, slik at nøkkelen sendes som WebSocket-subprotokoll. Møte trenger en egen
  `AudioSource` for den sammensatte `MediaStream`-en. Pause, fortsett og keepalive må prøves i nettleser
- Pakkeforløp: velge kriteriene som er oppfylt (avkrysning av punktene under «Begrunnet mistanke»)
  og få dem i notatet. Osteoporose finnes ikke hos Helsedirektoratet
- Vektbasert barnedosering som egen `kalkulator`
- Kliniske verktøy, gjenstående faser: MMS-NR (krever rettighetsavklaring for itemtekst),
  AI-forhåndsutfylling med bekreftelseskrav, admin-CRUD for egne verktøy
  (`/admin/verktoy` + Prisma-modell)
- Frasebibliotek
- Klinikk-teamfunksjonalitet

## GDPR og personvern

- Pasientdata behandles i nettleseren og hos Soniox/AWS Bedrock
- VPS håndterer autentisering og deler ut kortlivede nøkler; pasientinnhold er aldri innom serveren
- Soniox: EU-databehandling, DPA tilgjengelig
- AWS Bedrock (eu-central-1 Frankfurt, `eu.`-profil som kan rute til andre EU-regioner): EU-databehandling for Claude-modeller; «Model invocation logging» er av (bekreftet 09.10.2026)
  - IAM-nøklene til `legeassist` ligger kun på serveren; nettleseren får 1-times STS-nøkler
  - Pasienttranskript sendes fra nettleseren direkte til Bedrock (STS-nøkler, kun EU)
- Ingen lydopptak lagres — streames direkte gjennom Soniox
- Transkript og notater beholdes kun i nettlesersesjon (eller IndexedDB med TTL)
- Logging på serveren skal ikke inneholde pasientrelatert innhold
- 2FA obligatorisk fra 16.10.2026, med gjenopprettingskoder og admin-nullstilling som reserve; passkeys som alternativ innlogging
- Databehandleravtale versjon 2.0 publisert 09.10.2026 (krev ny signering). Underleverandøravtaler: Soniox DPA 1.3
  (EUs standardkontraktsklausuler) og netcup AVV (art. 28), begge signert 09.10.2026
- Konsultasjoner i nettleseren er kryptert per bruker; nøkkelen finnes bare i minnet mens brukeren er innlogget

## Miljøvariabler (server)

```env
# Database (MariaDB)
DATABASE_URL="mysql://bruker:passord@host:3306/databasenavn"

# NextAuth v5
AUTH_SECRET=...                    # 32 bytes, hex-encodet
AUTH_TRUST_HOST=true              # Påkrevd bak reverse proxy
AUTH_URL=https://ki.lilletorget.org  # Kun prod: kanonisk base-URL, hindrer localhost-redirects (utelates i dev)

# TOTP-kryptering (for 2FA)
TOTP_ENCRYPTION_KEY=...           # 32 bytes, hex-encodet

# Soniox (kun server-side, kun for token-generering)
SONIOX_API_KEY=...
SONIOX_API_HOST=https://api.soniox.com
SONIOX_WS_URL=wss://stt-rt.soniox.com/transcribe-websocket

# AWS Bedrock (Claude via Bedrock)
BEDROCK_API_KEY=AKIA...           # AWS Access Key ID
BEDROCK_SECRET_KEY=...            # AWS Secret Access Key
ANTHROPIC_MODEL=eu.anthropic.claude-sonnet-4-6  # Standard Bedrock-modell-ID
AWS_REGION=eu-central-1           # Frankfurt (EU-databehandling)
BEDROCK_MODELS=eu.anthropic.claude-sonnet-4-6,eu.anthropic.claude-opus-4-8  # Tilgjengelige modeller (kommaseparert)
BEDROCK_REGIONS=eu-central-1,eu-west-1  # Tilgjengelige regioner (kommaseparert)

# Helsedirektoratets API (retningslinjer, NLOD) — produksjonsnøkkel fra utvikler.helsedirektoratet.no
HELSEDIR_API_KEY=...

# Administrasjon
ADMIN_EMAILS=admin@klinikk.no     # Kommaseparert liste over admin-e-poster

# E-post (SMTP) — mailcow på egen server, tjenestepostboks legeassist@lilletorget.org
# (utgående post går via ProISP-relay satt opp per postboks i mailcow, relayhost id 14)
SMTP_HOST=mail.lilletorget.org    # Offentlig navn, ikke containernavn (sertifikatet)
SMTP_PORT=587                     # STARTTLS (465 = implisitt TLS)
SMTP_USER=legeassist@lilletorget.org
SMTP_PASSWORD=...                 # Postboksens passord
SMTP_FROM="LegeAssist <legeassist@lilletorget.org>"  # Valgfri; faller tilbake til SMTP_USER
ACCESS_REQUEST_TO=ragnar@lilletorget.org         # Mottaker for tilgangsforespørsler
APP_URL=https://ki.lilletorget.org  # Basis-URL for absolutte lenker i e-post
PORT=3001                         # Port appen lytter på i prod (3000 er opptatt)
```

Full mal med alle nøkler: se `.env.example` (committet, hemmeligheter tomme).

## Produksjon og deploy

Produksjon kjører **Docker-basert** på en VPS med IP **159.195.146.240**, domene
**https://ki.lilletorget.org**. Flere andre apper (finans, pokergutta, mailcow) kjører side om
side på samme VPS, hver i egne containere.

- **App:** Docker-container `legeassist` (bygget fra rot-`Dockerfile`: multi-stage
  node:20-slim → `prisma generate` + `next build` → `npm run start`). Containeren lytter på port
  **3001** internt, men porten er **ikke publisert til host** — nås kun via Docker-nettverket.
- **Reverse proxy:** **Caddy** (container `reverse-proxy-caddy`, config i `~/reverse-proxy/Caddyfile`
  på serveren, automatisk HTTPS). `legeassist` er koblet til Caddy via det eksterne Docker-nettverket
  `reverse-proxy_default`; Caddy proxer `ki.lilletorget.org` → `http://legeassist:3001`.
- **Database:** delt **MariaDB**-container (`shared-mariadb`, `mariadb:10.11`) på det eksterne
  Docker-nettverket `app-backend` — deles med de andre appene på VPS-en (egen database/bruker
  `legeassist`). Porten er **ikke publisert til host**, kun nåbar fra andre containere på
  `app-backend`.
  - **Prod** `DATABASE_URL` peker på Docker-nettverksnavnet `shared-mariadb:3306`.
  - **Dev** må SSH-tunnles til containerens interne IP (ikke `localhost:3306` *på serveren*, siden
    porten der ikke er publisert): kjør `.\db-tunnel.ps1` (PowerShell) eller `bash db-tunnel.sh`
    (Git Bash) fra prosjektroten — begge slår opp IP-en med `docker inspect` over SSH og åpner
    `localhost:3306 → <container-ip>:3306`. Dev sin `DATABASE_URL` peker på `localhost:3306` som
    før. Tunnelen blokkerer terminalen (Ctrl+C for å avslutte); bruk `-LocalPort 3307` /
    `LOCAL_PORT=3307` hvis 3306 er opptatt lokalt.
  - Samme database i dev og prod — skjemaendringer i dev treffer altså prod-DB; vær bevisst på dette.
- **SSH:** `ssh ragnar@159.195.146.240`. På ragnar-hjem (Ubuntu) er nøkkelen `~/.ssh/id_ed25519`, som
  ssh bruker uten `-i`. `push-and-deploy.sh` og `db-tunnel.sh` bruker den som standard; annen nøkkel
  velges med `KEY=…`. `~/.ssh/legeassist_vps_new` fantes bare på Windows-PC-en ragnar-kontor, og er
  fortsatt standard i `db-tunnel.ps1`
- **Deploy fra utviklingsmaskin:** `bash push-and-deploy.sh` (push til origin + SSH kjører
  `./deploy.sh` på serveren: `git pull --ff-only` → `docker compose build` → `docker compose up -d`
  → `docker exec legeassist npx prisma db push` → `docker compose restart`, deretter
  vent-på-200-retry mot `https://ki.lilletorget.org/login`).
- **Deploy direkte på serveren:** `cd ~/apps/legeassist && ./deploy.sh`
- Rikelig med ressurser på ny VPS (15 GB RAM, 500 GB disk) — ingen swap-forbehold nødvendig.

## Database (Prisma 7)

Prosjektet bruker Prisma 7 med den Rust-frie query-compileren og **mariadb-driveradapteren** (kompatibel med MySQL).

- **Generator:** `prisma-client` (ny) med `output = "../src/generated/prisma"`. Den genererte klienten er gitignored og importeres via `@/generated/prisma/client`.
- **Runtime-tilkobling:** `src/lib/db.ts` parser `DATABASE_URL` og setter opp `PrismaMariaDb`; `new PrismaClient({ adapter })`. Uten adapter kaster v7 («engine type "client" requires adapter»).
- **CLI-tilkobling:** `prisma.config.ts` (rot) leser `DATABASE_URL` via `dotenv` og oppgir `datasource.url` for `prisma db push` / `generate`.
- **Viktig arbeidsflyt-endring:** `db push` kjører **ikke** lenger `generate` automatisk — kjør `npx prisma generate` eksplisitt etter skjemaendringer.
- **Destruktive kommandoer:** v7 blokkerer AI-agenter fra `db push --force-reset` o.l. uten eksplisitt brukersamtykke gitt via `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.

## Claude-integrasjon

### Arkitektur (nettleseren kaller Bedrock direkte)

```
1. Browser: useClaude / useChat / promptbygger
   ├─ hentAiOppsett()  → GET /api/ai/oppsett (bufret til 5 min før nøklene utløper)
   │    { modell, region, overrides (staging), legitimasjon: STS-nøkler 1 t }
   ├─ ai-foresporsler.ts bygger { system, messages, maxTokens } — samme logikk som de gamle API-rutene
   ├─ bedrock-nettleser.ts signerer med SigV4 (@smithy/signature-v4 + @aws-crypto/sha256-js)
   │    POST https://bedrock-runtime.<region>.amazonaws.com/model/<modell>/invoke-with-response-stream
   │    (CORS er åpent hos Bedrock; Host-headeren fjernes etter signering)
   ├─ event-strømmen dekodes med @smithy/eventstream-codec → Anthropic-hendelser
   │    content_block_delta → onDelta(tekst); message_stop → amazon-bedrock-invocationMetrics
   └─ rapporterForbruk() → POST /api/bruk (kun tall)
```

- `@anthropic-ai/bedrock-sdk` brukes ikke i nettleseren: strømdekodingen er Node-spesifikk
  (`eventstream-serde-node`). Den brukes fortsatt på serveren av `/api/admin/test-bedrock`
- `strommFraClaude()` (notat, chat, AI-hjelp, promptbygger) og `sendTilClaude()` (ikke-strømmende, ingen brukere etter at verktøyforslag ble fjernet)
- Konsekvens: systempromptene (staging-overrides) sendes til innloggede brukere og kan ses i
  utviklerverktøy. Ikke legg hemmeligheter i staging-tekster
- `/api/claude`, `/api/chat` og `/api/verktoyforslag` er fjernet (2026-10-09)

### Bedrock-tilgang

Se «Nøkkelhåndtering» over. Modell og region leses fra `SystemSetting` (`bedrock_model`/`bedrock_region`,
satt av admin) med fallback til `ANTHROPIC_MODEL`/`AWS_REGION`. Obligatorisk 2FA håndheves i
`/api/ai/oppsett` (403) og `/api/soniox-token`.

### Modell og innstillinger

**Modell og region** lagres i `SystemSetting`-tabellen i databasen og administreres via admin-siden. Fallback: `ANTHROPIC_MODEL` og `AWS_REGION` i `.env`.

**Tilgjengelige modeller/regioner** defineres i `.env` med `BEDROCK_MODELS` og `BEDROCK_REGIONS` (kommaseparert). Modeller med `eu.`-prefiks bruker Bedrock cross-region inference og holder data innenfor EU.

**Admin-side** (`/admin/innstillinger`, kun for e-poster i `ADMIN_EMAILS`):
- Velg aktiv modell og region fra dropdowns
- Test Bedrock-tilkobling
- Se nøkkelstatus

**Brukerinnstillinger** (`/innstillinger`) viser aktiv modell/region (skrivebeskyttet) og 2FA.

## Konvensjoner

- Norsk brukergrensesnitt
- TypeScript overalt
- Server Components der mulig, Client Components kun ved behov (opptak, real-time, streaming)
- Ingen pasientdata i serverlogs — bruk strukturert logging med allowlist for felter
- **Pasientinnhold skal aldri sendes til vår server.** Nye AI-funksjoner bygges i nettleseren med
  `ai-foresporsler.ts` + `bedrock-nettleser.ts`, ikke som API-ruter
- Bedrock API-nøkkel og Soniox API-nøkkel behandles som hemmelighet (aldri logg, aldri git)
- SSE-streaming for optimale ytelse og brukeropplevelse (real-time notatgenerering)
