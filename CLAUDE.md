# legeassist

Nettbasert KI-assistent for fastleger. Tar opp konsultasjoner mellom lege og pasient, transkriberer tale i sanntid ved hjelp av Soniox og genererer journalnotater og andre kliniske dokumenter ved hjelp av Claude AI.

## Prosjektstatus

Under aktiv utvikling. Kjerneflyt (opptak → transkript → notat) er implementert og fungerer.

## Arkitektur

### Overordnet prinsipp: Privacy-by-design

Pasientdata (lydopptak, transkripsjon, notater) berører **aldri** applikasjonsserveren. All behandling av pasientrelatert innhold skjer direkte mellom nettleseren og tredjeparts-API-er (Soniox, Claude). Serveren håndterer kun brukerkontoer og innholdsmaler.

### Dataflyt

```
VPS (legeassist-server)
  │
  ├── Autentisering (login/session)
  ├── Promptmaler og notatmaler
  ├── Brukerpreferanser
  ├── Genererer kortlivede temp-tokens for Soniox (ingen pasientinnhold)
  │
  └──→ AWS Bedrock (eu-central-1)
          Claude API-forespørsler med transkript + prompt
          Returnerer SSE-stream av generert notat

Nettleser (klinikkens datamaskin)
  │
  ├──→ Soniox EU-endpoint (direkte, med temp-token)
  │       Lydstream → sanntidstranskript → tilbake til browser
  │
  └──→ VPS /api/claude (SSE)
          Browser sender transkript + kontekst
          Server streamer notatgenerering i sanntid (text deltas)
```

### Stack

| Lag | Teknologi | Begrunnelse |
|---|---|---|
| Frontend | Next.js (React) | Fullstack i ett prosjekt, god DX |
| UI-komponenter | shadcn/ui + Tailwind CSS | Moderne, tilgjengelig, tilpassbart |
| Backend/API | Next.js API Routes | Integrert med frontend, enkelt å deploye |
| Database | MariaDB (selvhosted på VPS) | Full kontroll, ingen tredjepart |
| ORM | Prisma | Typesikker DB-tilgang |
| Autentisering | NextAuth v5 | Fleksibel, støtter credentials + 2FA |
| Transkripsjon | Soniox (EU-endpoint) | Sanntid, norsk språkstøtte, GDPR-compliant |
| AI-tekstgenerering | Anthropic Claude via AWS Bedrock | Server-side SSE streaming (eu-west-1), EU-databehandling |
| Hosting | Selvhosted VPS (EU) | Full kontroll, ingen tredjepart for pasientdata |

### Nøkkelhåndtering

- Soniox API-nøkkel lagres på serveren; brukes kun til å generere kortlivede temp-tokens
- Temp-tokens er gyldige i ~60 sekunder og er sesjonsspesifikke
- Claude via AWS Bedrock: IAM-nøkler (ikke root) lagres på serveren i `.env`
  - `BEDROCK_API_KEY` = AWS Access Key ID (starter typisk med `AKIA...`)
  - `BEDROCK_SECRET_KEY` = AWS Secret Access Key
  - Region: eu-central-1 (Frankfurt) er anbefalt for EU-dataresidens med `eu.`-prefiks modeller
  - Autentisering: `AnthropicBedrock` klient fra `@anthropic-ai/bedrock-sdk`

## Funksjonalitet

### Implementert
- Mikrofonfangst i nettleser (Web Audio API) + skjermdeling for videomøter (NAV)
- Sanntidstranskribering med Soniox, pause/fortsett opptak
- Autolagring av transkript hvert 10 sek under opptak + lagring ved pause
- Alle "fortsett"-knapper pre-laster eksisterende transkript (ingen appendModus)
- SOAP-notatgenerering via Claude (SSE-streaming), auto-start etter stopp
- Chat / AI-hjelp: multi-turn chat med konsultasjonskontekst, lagret i IndexedDB
  - Historikk bevares ved lukking/gjenåpning (24t TTL)
  - Endringsmarkører når transkript/kontekst/tilleggsinfo/vedlegg endres
  - Vedlegg-toggles per chat-økt (velg hvilke filer AI ser)
  - Tilgjengelig under aktivt opptak (bruker lagret transkript)
- Vedlegg (bilder/PDF): opplasting, drag-and-drop, kamerabilde, kollapsert kortvisning
  - Oppgaver: EKG, Spirometri (3 typer), Les tekst, Egendefinert, Kun kontekst
  - AI-tolkede vedlegg merkes `[**AI-tolket**]` i notatet
- 2FA (TOTP), admin-side for Bedrock-konfigurasjon (modell/region/tilkoblingstest)
- Promptbibliotek under Innstillinger: CRUD for maler per kategori (Konsultasjon, Møte, Chat)
  - Maler kan merkes som delte; andre brukere kan importere delte maler
  - Konsultasjon/Møte-maler: velges i «Velg notatmal»-dropdown i konsultasjonsvisningen
  - Chat-maler: vises som snarveisknapper i Chat / AI-hjelp
  - Valgt mal sendes til Claude etter systemprompt (kan overstyre)
- AI-genererte stikkord: tre korte nøkkelord per konsultasjon/møte
  - Instruksjon i systemprompt; Claude legger til `STIKKORD: ord1, ord2, ord3` sist i svaret
  - Strippes fra notat og lagres separat som `stikkord: string[]` i `Konsultasjon`
  - Vises i sidebar-kortene etter typenavnet (f.eks. «Konsultasjon · feber · hoste · tretthet»)

### Planlagt
- Frasebibliotek og diktatprompts
- Klinikk-teamfunksjonalitet

## GDPR og personvern

- Pasientdata behandles i nettleseren og hos Soniox/AWS Bedrock
- VPS håndterer autentisering og proxier notatgenerering (ikke databehandler av pasientinnhold selv)
- Soniox: EU-databehandling, DPA tilgjengelig
- AWS Bedrock (eu-west-1 Irland): EU-databehandling for Claude-modeller
  - Bedrock API key (langtidstoken) lagres på server som miljøvariabel
  - Pasienttranskript sendes fra browser → server → Bedrock
  - Generert notat returneres som SSE-stream tilbake til browser
- Ingen lydopptak lagres — streames direkte gjennom Soniox
- Transkript og notater beholdes kun i nettlesersesjon (eller IndexedDB med TTL)
- Logging på serveren skal ikke inneholde pasientrelatert innhold
- 2FA anbefalt for alle brukere

## Mappestruktur

```
legeassist/
├── CLAUDE.md
├── package.json
├── next.config.ts
├── tsconfig.json
├── .env                           # Miljøvariabler (server-side)
├── .env.local                     # Lokal override
├── prisma/
│   └── schema.prisma              # Brukere, maler, sesjon
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # Login, registrering
│   │   ├── (app)/                 # Hovedapp (beskyttet)
│   │   │   ├── konsultasjon/      # Konsultasjonsvisning + notatgenerering
│   │   │   ├── innstillinger/     # Brukerinnstillinger (2FA, Bedrock-info)
│   │   │   └── admin/
│   │   │       └── innstillinger/ # Adminside: modell/region/nøkler (kun admin)
│   │   ├── api/
│   │   │   ├── auth/              # NextAuth
│   │   │   ├── soniox-token/      # Genererer temp-tokens for Soniox
│   │   │   ├── claude/            # SSE-endpoint for notatgenerering via Bedrock
│   │   │   ├── chat/              # SSE-endpoint for multi-turn chat via Bedrock
│   │   │   ├── maler/             # CRUD for Mal (GET/POST, PUT/DELETE per ID, delte maler, importer)
│   │   │   └── admin/
│   │   │       ├── settings/      # GET/POST for SystemSetting (modell, region)
│   │   │       └── test-bedrock/  # Tilkoblingstest mot Bedrock
│   │   ├── global-error.tsx       # Global error boundary
│   │   └── (app)/error.tsx        # App-level error boundary
│   ├── components/
│   │   ├── ui/                    # shadcn/ui-komponenter
│   │   ├── app/
│   │   │   ├── konsultasjon-view.tsx  # KonsultasjonsUI med Claude-integrasjon
│   │   │   ├── chat-modal.tsx         # Chat / AI-hjelp modal
│   │   │   ├── vedlegg-panel.tsx      # Vedlegg: opplasting, kamera, oppgavevalg
│   │   │   └── app-sidebar.tsx        # Sidebar med konsultasjonsliste (stikkord)
│   │   ├── settings/
│   │   │   ├── innstillinger-klient.tsx   # Tabulert innstillingsside (Konto / Promptbibliotek)
│   │   │   └── promptbibliotek-klient.tsx # CRUD-UI for maler (Konsultasjon, Møte, Chat)
│   │   └── admin/
│   │       └── bedrock-innstillinger.tsx  # Client-komponent for admin-konfig
│   ├── lib/
│   │   ├── auth.ts                # NextAuth konfigurasjon
│   │   ├── db.ts                  # Prisma-klient
│   │   ├── admin.ts               # isAdmin(), hentSystemSetting(), tilgjengeligeModeller/Regioner()
│   │   ├── idb.ts                 # IndexedDB-operasjoner (konsultasjoner, 24t TTL)
│   │   ├── staging.ts             # TYPE_STAGING + KONSULTASJON_FORM_STAGING + CHAT_STAGING + STIKKORD_SEKSJON
│   │   └── vedlegg.ts             # VEDLEGG_OPPGAVE_INFO, lagVedleggInstruksjon()
│   ├── types/
│   │   └── konsultasjon.ts        # Konsultasjon (inkl. stikkord, malId), ChatMelding, Vedlegg, typer
│   └── hooks/
│       ├── use-claude.ts          # SSE-hook for notatgenerering
│       ├── use-chat.ts            # SSE-hook for multi-turn chat + IndexedDB-persistering
│       ├── use-konsultasjon.tsx   # KonsultasjonContext + oppdater()
│       ├── use-transkribering.ts  # Soniox WebSocket-klient
│       └── use-mikrofon.ts        # Mikrofontillatelse og enhetsliste
└── public/
```

## Miljøvariabler (server)

```env
# Database (MariaDB)
DATABASE_URL="mysql://bruker:passord@host:3306/databasenavn"

# NextAuth v5
AUTH_SECRET=...                    # 32 bytes, hex-encodet

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

# Administrasjon
ADMIN_EMAILS=admin@klinikk.no     # Kommaseparert liste over admin-e-poster
```

## Claude-integrasjon

### Arkitektur

Notatgenerering bruker **server-side SSE-streaming** for å strømme Claude-utdata i sanntid til nettleseren.

```
1. Browser (konsultasjon-view.tsx)
   ├─ Bruker har opptak og transkript
   ├─ Klikker "Regenerer" → useClaude.genererNotat()
   │
   ↓
2. Server (/api/claude/route.ts)
   ├─ Mottaker: {transkript, kontekst, tilleggsinfo, malInnhold, type}
   ├─ Bygger system prompt fra TYPE_STAGING + template
   ├─ Instansier AnthropicBedrock klient
   ├─ Caller client.messages.stream()
   │
   ↓
3. AWS Bedrock (eu-west-1)
   ├─ Behandler med Claude-modell (opus-4-8)
   ├─ Returnerer streaming response
   │
   ↓
4. Server (SSE-formatering)
   ├─ Konverterer text deltas til "data: {text: ...}\n"
   ├─ Streamer [DONE] til slutt
   │
   ↓
5. Browser (useClaude hook)
   ├─ Lytter på SSE event stream
   ├─ Parser "data: " linjer, JSON.parse() payload
   ├─ Akkumulerer tekst + kaller onDelta() per chunk
   ├─ Kaller onFerdig() når ferdig
   │
   ↓
6. Browser UI (konsultasjon-view.tsx)
   ├─ onDelta() oppdaterer textarea i sanntid
   ├─ onFerdig() lagrer notat i konsultasjon + IndexedDB
   └─ Bruker kan avbryte med abortRef.current?.abort()
```

### Bedrock-autentisering

**Nøkkelformat:** To separate nøkler — `BEDROCK_API_KEY` (Access Key ID) og `BEDROCK_SECRET_KEY` (Secret Access Key).

```typescript
// src/app/api/claude/route.ts
async function lagBedrockKlient() {
  const region = await hentSystemSetting("bedrock_region", standardRegion())
  return new AnthropicBedrock({
    awsAccessKey: process.env.BEDROCK_API_KEY ?? "",
    awsSecretKey: process.env.BEDROCK_SECRET_KEY ?? "",
    awsRegion: region,
  })
}
```

Region og modell leses fra `SystemSetting` i databasen (satt av admin), med fallback til `ANTHROPIC_MODEL`/`AWS_REGION` i `.env`.

**Generering av nøkler:**
1. AWS Console → IAM → Users → (din IAM bruker, IKKE root)
2. Security Credentials → Create access key
3. Velg "Application running outside AWS"
4. Kopier begge nøklene (vises kun én gang)
5. Legg inn i `.env` som `BEDROCK_API_KEY=AKIA...` og `BEDROCK_SECRET_KEY=...`

### useClaude hook

Client-side hook i `src/hooks/use-claude.ts` håndterer SSE-parsing og streaming state:

```typescript
const { genererNotat, isGenerating, feil, avbryt } = useClaude()

await genererNotat(
  konsultasjon,
  (tekst) => { /* per-chunk callback */ },
  async (fullTekst) => { /* når ferdig, lagre */ }
)
```

**Streaming lifecycle:**
- `isGenerating=true` mens streaming pågår
- `onDelta` kalles for hvert tekstfragment fra server
- `onFerdig` kalles med akkumulert tekst når `[DONE]` mottas
- `avbryt()` sender AbortController.abort()

### Notatmaler og stikkord

Notatgenerering bruker type-spesifikke **system prompts** definert i `src/lib/staging.ts`:

- `TYPE_STAGING[konsultasjon.type]` — standard SOAP-prompt per notattype (inkl. STIKKORD_SEKSJON)
- `KONSULTASJON_FORM_STAGING[form]` — form-spesifikk variant (fysisk/telefon/video) for KONSULTASJON-typen
- `malInnhold` — brukerens mal-instruksjon fra promptbiblioteket (legges til etter TYPE_STAGING)
- `CHAT_STAGING` — system prompt for chat, med `{KONTEKST}`-plassholder; ingen stikkord-instruksjon
- `STIKKORD_SEKSJON` — instruksjon om å avslutte notatet med `STIKKORD: ord1, ord2, ord3`

**Stikkord-flyt:**
1. Claude avslutter notatet med linjen `STIKKORD: ord1, ord2, ord3`
2. `konsultasjon-view.tsx` skjuler linjen fra streaming-visningen (`indexOf('\nSTIKKORD:')`)
3. `parseStikkord()` i samme fil ekstraherer ordene og renser notatteksten
4. Lagres separat som `stikkord: string[]` på `Konsultasjon`-objektet i IndexedDB
5. `app-sidebar.tsx` viser stikkordene etter typenavnet i kortlisten

### Chat / AI-hjelp

Multi-turn chat tilgjengelig fra konsultasjonsvisningen via `ChatModal`.

```
Browser (chat-modal.tsx)
  ├─ Bruker skriver melding
  ├─ useChat.sendMelding() → POST /api/chat
  │
  ↓
Server (/api/chat/route.ts)
  ├─ Bygger system prompt: CHAT_STAGING + kontekstfelt
  ├─ Vedlegg inkluderes kun i første melding (uten oppgave-instruksjon)
  ├─ Sender historikk (maks 20 meldinger, system-meldinger filtrert)
  │
  ↓
AWS Bedrock → SSE-stream tilbake til browser
```

**Historikk:** Lagres i `konsultasjon.chatHistorikk` (IndexedDB, 24t TTL). Overlever lukking av modal og sideoppdatering. `chatKontekstSnapshot` brukes til å detektere endringer og vise markørlinjer i chatvinduet.

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
- Bedrock API-nøkkel og Soniox API-nøkkel behandles som hemmelighet (aldri logg, aldri git)
- SSE-streaming for optimale ytelse og brukeropplevelse (real-time notatgenerering)
