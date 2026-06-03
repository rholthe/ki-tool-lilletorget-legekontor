# legeassist

Nettbasert KI-assistent for fastleger. Tar opp konsultasjoner mellom lege og pasient, transkriberer tale i sanntid og genererer journalnotater og andre kliniske dokumenter ved hjelp av Claude AI.

## Prosjektstatus

Under planlegging / tidlig utvikling.

## Arkitektur

### Overordnet prinsipp: Privacy-by-design

Pasientdata (lydopptak, transkripsjon, notater) berører **aldri** applikasjonsserveren. All behandling av pasientrelatert innhold skjer direkte mellom nettleseren og tredjeparts-API-er (AssemblyAI, Claude). Serveren håndterer kun brukerkontoer og innholdsmaler.

### Dataflyt

```
VPS (legeassist-server)
  │
  ├── Autentisering (login/session)
  ├── Promptmaler og notatmaler
  ├── Brukerpreferanser
  └── Genererer kortlivede temp-tokens for AssemblyAI (ingen pasientinnhold)

Nettleser (klinikkens datamaskin)
  │
  ├──→ AssemblyAI EU-endpoint (direkte, med temp-token)
  │       Lydstream → sanntidstranskript → tilbake til browser
  │
  └──→ Claude API (direkte fra browser)
          Transkript + prompt + kontekst → generert notat → tilbake til browser
```

### Stack

| Lag | Teknologi | Begrunnelse |
|---|---|---|
| Frontend | Next.js (React) | Fullstack i ett prosjekt, god DX |
| UI-komponenter | shadcn/ui + Tailwind CSS | Moderne, tilgjengelig, tilpassbart |
| Backend/API | Next.js API Routes | Integrert med frontend, enkelt å deploye |
| Database | PostgreSQL (selvhosted på VPS) | Full kontroll, ingen tredjepart |
| ORM | Prisma | Typesikker DB-tilgang |
| Autentisering | NextAuth.js | Fleksibel, støtter credentials + 2FA |
| Transkripsjon | AssemblyAI (EU-endpoint) | Sanntid, norsk språkstøtte, GDPR-compliant |
| AI-tekstgenerering | Anthropic Claude API | Direkte fra browser med brukerens nøkkel |
| Hosting | Selvhosted VPS (EU) | Full kontroll, ingen tredjepart for pasientdata |

### Nøkkelhåndtering

- AssemblyAI API-nøkkel lagres på serveren; brukes kun til å generere kortlivede temp-tokens
- Temp-tokens er gyldige i ~60 sekunder og er sesjonsspesifikke
- Claude API-nøkkel: Klinikkens nøkkel lagres kryptert i brukerens konto (kryptert med brukerens passord/PIN, serveren kan ikke lese klartekst)
- Dekryptert kun i nettleseren ved behov

## Funksjonalitet (planlagt)

### Kjerneflyt
- Mikrofonfangst i nettleser (Web Audio API)
- Sanntidstranskribering med AssemblyAI (speaker diarization: lege vs. pasient)
- Live transkripsjon synlig under opptak
- Pause/fortsett opptak
- Generering av journalnotat (eller annen dokumenttype) via Claude etter opptak

### Dokumenttyper
- SOAP-notat
- Epikriserespons / kontekstuell journalnotis
- Sykemelding
- Henvisning
- Fritekst KI-chat med kontekst

### Biblioteker og maler
- Notatmaler (systemprompter) – lagret i DB, synkronisert på tvers av enheter
- Diktatprompts
- Frasebibliotek
- Mulighet for deling mellom brukere på samme klinikk

### Administrasjon
- Brukerhåndtering (enkeltbruker og klinikk-team)
- Innstillinger for språk (norsk bokmål, nynorsk, andre)
- Tilkoblingstest for API-er

## GDPR og personvern

- Pasientdata behandles utelukkende i nettleseren og hos AssemblyAI/Anthropic
- VPS er ikke databehandler for pasientopplysninger
- AssemblyAI: EU-databehandling, DPA tilgjengelig — bruk `eu.assemblyai.com`
- Anthropic: DPA tilgjengelig; vurder Claude via AWS Bedrock (eu-central-1) for EU-dataresidens
- Ingen lydopptak lagres — streames direkte og kastes
- Transkript og notater beholdes kun i nettlesersesjon (ikke sendt til server)
- Logging på serveren skal ikke inneholde pasientrelatert innhold
- 2FA anbefalt for alle brukere

## Mappestruktur (planlagt)

```
legeassist/
├── CLAUDE.md
├── package.json
├── next.config.ts
├── prisma/
│   └── schema.prisma          # Brukere, maler, tokens
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Login, registrering
│   │   ├── (app)/             # Hovedapp (beskyttet)
│   │   │   └── konsultasjon/
│   │   └── api/
│   │       ├── auth/          # NextAuth
│   │       ├── assemblyai-token/  # Genererer temp-tokens
│   │       └── maler/         # CRUD for promptmaler
│   ├── components/
│   │   ├── ui/                # shadcn/ui-komponenter
│   │   ├── opptak/            # Opptaks- og transkripsjonskontroller
│   │   └── notat/             # Notatvisning og -redigering
│   ├── lib/
│   │   ├── assemblyai.ts      # Temp-token-generering
│   │   ├── claude.ts          # Claude API-wrapper (browser-side)
│   │   └── db.ts              # Prisma-klient
│   └── hooks/
│       ├── useRecording.ts    # Web Audio API + AssemblyAI WebSocket
│       └── useTranscript.ts   # Sanntidstranskript-state
└── public/
```

## Miljøvariabler (server)

```env
# Database
DATABASE_URL=postgresql://...

# AssemblyAI (kun server-side, kun for token-generering)
ASSEMBLYAI_API_KEY=...

# NextAuth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://...

# Valgfritt: Anthropic (hvis server-side proxy ønskes)
# ANTHROPIC_API_KEY=...
```

## Konvensjoner

- Norsk brukergrensesnitt
- TypeScript overalt
- Server Components der mulig, Client Components kun ved behov (opptak, real-time)
- Ingen pasientdata i serverlogs — bruk strukturert logging med allowlist for felter
