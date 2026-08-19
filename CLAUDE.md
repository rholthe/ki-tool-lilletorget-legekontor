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
| ORM | Prisma 7 (Rust-fri, mariadb-driveradapter) | Typesikker DB-tilgang |
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
  - Oppgaver: EKG, Spirometri (3 typer), Egendefinert, Kun kontekst
  - AI-tolkede vedlegg merkes `[**AI-tolket**]` i notatet
- OCR / Les tekst: egen knapp ved siden av «Bilder/PDF», med samme opplastingsfunksjonalitet
  - Filene deles med vedlegg-arrayet men vises kun i sin respektive panel (`modus`-prop)
  - Tre bruksalternativer per OCR-fil: Inkluder i kontekst · Inkluder i tilleggsinfo · Ren innlesing
  - Ekstrahert tekst legges alltid til slutt i notatet under overskriften `--- OCR ---`
- Transkriptviser (enkeltlinje): fortløpende transkripsjon vises som én linje — kun siste segment
  - Container: `overflow-x-hidden` med `scrollLeft = scrollWidth` via ref/useEffect
- 2FA (TOTP), admin-side for Bedrock-konfigurasjon (modell/region/tilkoblingstest)
  - 2FA-påminnelse: diskret kort nederst til høyre for brukere uten 2FA, maks ~1 gang/mnd
    (`to-faktor-paaminnelse.tsx`, husker i localStorage `legeassist:2fa-paaminnelse-sist`)
- Brukeradministrasjon (kun admin): selvregistrering er deaktivert
  - `/admin/brukere`: admin oppretter bruker (navn + e-post, ikke passord). Kontoen er låst
    (`passwordHash = null`) til brukeren selv setter passord via invitasjonslenke
  - Invitasjon sendes på e-post med engangslenke → `/sett-passord?token=...` (gyldig 7 dager)
    - Token i `PasswordSetupToken` (SHA-256-hash lagret, klartekst kun i e-postlenken)
    - Brukerliste viser status «Venter på passord»/«Aktiv» + «Send invitasjon på nytt»
  - Tilgangsforespørsel: offentlig skjema `/tilgang` (navn/e-post/arbeidssted) → e-post til
    `ACCESS_REQUEST_TO`; lenket fra login («Kontakt en administrator»)
  - E-post via SMTP (`src/lib/mail.ts`, nodemailer + Google Workspace app-passord)
  - Offentlige ruter i `proxy.ts`: `/login`, `/tilgang`, `/sett-passord`, `/databehandleravtale`, `/api/auth`
- Databehandleravtale (DPA): ingen appbruk uten gyldig signatur
  - Admin-versjonert i DB (`DpaVersjon`: versjon, innhold/markdown, krevNySignering,
    gjeldende, publisertAt). Publiserte versjoner er uforanderlige (ingen redigering).
  - `src/lib/dpa.ts` (server-only): `hentGjeldendeDpa()` (DB, faller tilbake til
    `BASELINE_DPA_*`), `kravSigneringEtter()`, `harGyldigSignatur()` (tidsbasert:
    signatur gyldig hvis `dpaSignedAt >=` siste «krev ny signering»-publisering)
  - `User.dpaSignedAt` + `dpaVersion`; signeres samtidig med passordvalg (påkrevd
    avkrysning i `/sett-passord`) eller på `/godta-avtale`
  - Innloggede uten gyldig signatur gates av `(app)/layout.tsx` → `/godta-avtale`
    (egen rot-rute, ingen loop); `signerAvtale`-action setter signatur til gjeldende versjon
  - Offentlig side `/databehandleravtale`: gjeldende avtaletekst (markdown via
    `components/dpa/markdown.tsx`) + statisk sikkerhetsinfo, ROS-analyse, GDPR/Norm-samsvar
    og tekniske detaljer i `<details>` (åpnes i ny fane fra passordoppsett/gate/brukermeny)
  - Admin: `/admin/databehandleravtale` (opprett ny versjon, se historikk); `opprettDpaVersjon`
  - Signert-status + lenke vises i Innstillinger; lenker i brukermenyen (bruker + admin)
- Promptbibliotek under Innstillinger: CRUD for maler per kategori (Konsultasjon, Møte, Diktat, Chat, AI-hjelp)
  - Maler kan merkes som delte; andre brukere kan importere delte maler
  - Konsultasjon/Møte-maler: velges i «Velg notatmal»-dropdown i konsultasjonsvisningen
  - Chat-maler: vises som snarveisknapper i Chat / AI-hjelp; AI-hjelp-maler i frittstående AI-hjelp
  - Snarvei til promptbiblioteket i toppheaderen (foran brukernavnet) → `/innstillinger?tab=prompts`
  - Fane «Lag med AI» (alle brukere): chat med Claude (`modus: "promptbygger"`) for å utforme et prompt;
    «Bruk som ny mal» forhåndsutfyller skjemaet i valgt kategori (`promptbygger-klient.tsx`)
  - Fane «Staging (admin)» (kun admin): redigerer systemprompter lagret i DB med fil-fallback
    - Overstyringer lagres i `SystemSetting` med nøkkel `staging:<key>` (ingen egen tabell)
    - Registry i `src/lib/staging-registry.ts` (grunntekst per notattype, vedlegg-instrukser, felles Stikkord/Vedlegg-seksjon)
    - Server-resolver `src/lib/staging-server.ts`: `hentStagingOverrides` + `byggStaging`/`byggChatStaging`/`resolverVedleggInstruksjon`
    - `STIKKORD:` og `{KONTEKST}` styres sentralt via felles-oppføringer; grunntekst per type kan ikke brekke dem
    - Vanlige brukere ser aldri staging-tekst; `/api/admin/staging` krever admin (`isAdmin`)
  - Valgt mal sendes til Claude etter systemprompt (kan overstyre)
  - Dropdown har ikke lenger «Standard (systemprompt)» — stagingprompt er alltid skjult for bruker
  - Valgt mal huskes per konsultasjonstype i localStorage og brukes automatisk på neste sesjon
- AI-genererte stikkord: tre korte nøkkelord per konsultasjon/møte
  - Instruksjon i systemprompt; Claude legger til `STIKKORD: ord1, ord2, ord3` sist i svaret
  - Strippes fra notat og lagres separat som `stikkord: string[]` i `Konsultasjon`
  - Vises i sidebar-kortene etter typenavnet (f.eks. «Konsultasjon · feber · hoste · tretthet»)
- Konsultasjonsform (fysisk/telefon/video) lagres på `Konsultasjon.form`
  - Knappevalg, sidebar-etikett (Telefon-/Videokonsultasjon) og notatlogikk overlever sidebytte
  - Telefon/video bruker egen staging via `KONSULTASJON_FORM_STAGING`; `konsultasjonEtikett()` gir riktig visningsnavn
- Fargetema per type (`src/lib/tema.ts`: `TYPE_TEMA` + `TYPE_IKON_KOMP`)
  - Hovedvisning og sidebar-kort fargelegges etter type: Konsultasjon (blå), Møte (grønn), Diktat (amber), Journalgjennomgang (violett)
  - Sidebar-kort viser samme ikon som oppgaveknappen, uavhengig av form; aktivt kort markeres i temafargen
- Diktat: fri diktering med språkvask (egen oppgaveknapp i sidebar, amber Mic-ikon)
  - Staging (`DIKTAT` i `staging.ts`) gjør primært språkvask uten å endre form/innhold
  - Innebygde instruksjoner i diktatet (f.eks. «list opp matvarer rike på jern») utføres
    kortfattet, i sammenhengende tekst (ingen stjerne-lister)
  - Egen kategori `DIKTAT` i promptbiblioteket → maler velges i «Velg mal»-dropdown
    (f.eks. brev til/om pasient); mal har forrang for sluttformen
  - Egen `DiktatView` (rutes via `HovedInnhold`): kun Notat-ID + opptak (pause/fortsett,
    fortløpende transkript) + resultatfelt — ingen kontekst/tilleggsinfo/vedlegg/chat
  - Original/bearbeidet-toggle over resultatfeltet (verifiser at språkvask ikke endret innhold)
  - «Tøm»: nullstiller transkript/notat/stikkord og starter på nytt
  - Lagres i IndexedDB (24t TTL) med stikkord, som øvrige typer
- Journalgjennomgang: gjennomgang av pasientjournal fra tidligere fastlege
  - Last opp PDF → klientside-ekstraksjon med `pdfjs-dist` (side-for-side fremgang)
  - Redigerbart tekstfelt med ekstrahert tekst + live tokenteller og NOK-kostnadsestimat
  - Advarsel ved >180 000 tokens; valgfrie fokusspørsmål (→ `tilleggsinfo`)
  - Claude genererer strukturert oppsummering med 9 seksjoner: SOSIALT, KLINISK OPPSUMMERING, ALLERGIER OG BIVIRKNINGER, OPERASJONER OG INNLEGGELSER, FAMILIEHISTORIKK, SCREENINGHISTORIKK, VIKTIGE PUNKTER, MEDIKAMENTHISTORIKK (SISTE 5 ÅR), SYKMELDINGSHISTORIKK OG NAV-HISTORIKK + FOKUS-seksjon ved fokusspørsmål
  - Sesjoner lagres i IndexedDB og vises i sidebar (violet BookOpen-ikon)
  - Routing: `page.tsx` → `HovedInnhold` → `JournalgjennomgangView` / `DiktatView` / `KonsultasjonView`
- AI-hjelp: frittstående Chat / AI-hjelp uavhengig av pasient/konsultasjon (egen oppgaveknapp, teal Sparkles-ikon)
  - Egen `AiHjelpView` (rutes via `HovedInnhold`): sammenleggbart Kontekst-felt + vedlegg, chat-tråd, snarveier og inputfelt
  - All kontekst legges inn manuelt av bruker (`Konsultasjon.kontekst`); ingen transkript/opptak
  - Kontekst-feltet åpnes automatisk ved ny oppgave (effekt på `aktiv.id`) og har fullskjerm-utvidelse
    (`Maximize2` + `Dialog`, som journal-/konsultasjonsbildet)
  - Opplasting + OCR «helt tilsvarende konsultasjonsbildet», men uten bilde-/OCR-instruks: `VedleggPanel modus="enkel" kompakt`
    (kompakt = opplastingssone på én rad) legger filer til som `oppgave: "kontekst"` uten oppgavevalg — prompten styrer hva Claude gjør
  - Snarveier fra egen promptkategori `AIHJELP`; klikk legger malteksten i inputfeltet (ikke direkte send)
    - Hover over en snarvei viser et utklippstavle-ikon («Lim inn fra utklippstavle og send»): ett klikk
      leser `navigator.clipboard.readText()` → setter som `kontekst`, legger snarveien som instruksjon og sender
      forespørselen (`handleSnarveiMedUtklippstavle`). Tom/nektet utklippstavle → kjører videre med eksisterende kontekst
    - `useChat.sendMelding(tekst, vedlegg, overstyrKontekst?)`: valgfri kontekst-override sendes i API-kallet og
      `chatKontekstSnapshot`, siden `aktiv.kontekst` i closuren ennå er stale rett etter `oppdater({ kontekst })`
  - Svar-bobler har hover-synlig «Kopier»-knapp (`KopierKnapp`, `navigator.clipboard.writeText`)
  - Tom chat: meldingsområdet kollapser og inputfeltet vokser til full høyde (`tomChat`-flagg); ved send minimeres kontekst/vedlegg og chatfeltet overtar
  - Gjenbruker `useChat` + `/api/chat` med `modus: "aihjelp"` → egen systemprompt `AIHJELP_STAGING` (ikke konsultasjonsbundet)
  - Chat-historikk lagres i IndexedDB (24t TTL); «Tøm» nullstiller tråden
- Hurtigtaster (Alt-baserte, globale): `src/hooks/use-hurtigtaster.ts`
  - Bruker `KeyboardEvent.code` (layout-uavhengig) og krever Alt (ikke Ctrl/Meta), så de
    aldri kolliderer med skriving — virker også med markør i tekstfelt; `e.repeat` ignoreres
  - `preventDefault` kun ved treff (Digit1–5, KeyR, KeyS), så andre Alt-snarveier i nettleser består
  - Sidebar (`app-sidebar.tsx`): `Alt+1..5` oppretter ny oppgave i samme rekkefølge som
    `NY_KNAPPER` (1 Konsultasjon, 2 Møte, 3 Diktat, 4 Journalgjennomgang, 5 AI-hjelp);
    knappene viser et `Alt+N`-merke
  - Opptak (kontekstavhengig, i `konsultasjon-view.tsx` og `diktat-view.tsx`):
    - `Alt+R` veksler ut fra tilstand: stoppet/ny → Start, opptar → Pause, pause → Fortsett,
      lagret pause → Fortsett, ferdig → Fortsett opptak, kobler → ignoreres
    - `Alt+S` = Stopp & Send (genererer notat); egen tast siden den committer/trigger AI
    - `Alt+V` = åpne/lukke Kliniske verktøy (kun `konsultasjon-view.tsx`)
    - Hooken er montert per view (kun ett vises via `HovedInnhold`); knapper har `title`-hint
- Diktering i tekstbokser: gjenbrukbart mikrofonikon for live transkribering rett inn i et tekstfelt
  - Komponent `DikteringKnapp` (`src/components/app/diktering-knapp.tsx`) + hook `useDiktering` (`src/hooks/use-diktering.ts`)
  - Kun sanntidstranskript via Soniox (`stt-rt-v5`, norsk) — ingen AI-behandling, ingen video/skjermdeling
  - Markør i feltet → tekst settes inn ved `selectionStart`; ellers legges til på slutten (mellomrom mot eksisterende tekst)
  - Foreløpige (non-final) tokens vises umiddelbart og erstattes når de blir endelige (lav latency)
  - Soniox-spesialtokens (`<end>` o.l.) filtreres bort; knappen bruker `onMouseDown` `preventDefault` for å bevare markørfokus
  - Standard innfelling: wrap `<Textarea>` i `relative`-div, gi feltet `pr-10` + `ref`, plasser knappen `absolute bottom-1.5 right-1.5`
  - I bruk: AI-hjelp-input, konsultasjons-chat (`chat-modal.tsx`), Fokusspørsmål i Journalgjennomgang
- Kliniske verktøy: skåringsverktøy og strukturerte undersøkelser i konsultasjonsbildet
  - Egen knapp ved siden av «Chat / AI-hjelp» (`ClipboardList`-ikon) → `VerktoyModal`, hurtigtast `Alt+V`
  - **Poeng og terskler beregnes alltid av koden, aldri av Claude** (`src/lib/verktoy/beregn.ts`)
  - Verktøy er deklarative, JSON-serialiserbare definisjoner (`src/lib/verktoy/definisjoner/*.ts`):
    felter (`ja_nei`/`valg`/`tall`/`funn`/`fritekst`), `beregning` (`sum`/`sum_per_seksjon`/`ingen`)
    og en `terskler`-tabell. Formen er bevisst uten funksjoner, slik at admin senere kan opprette
    verktøy fra frontend med nøyaktig samme datamodell
  - Implementert: CHA₂DS₂-VASc, qSOFA, Wells DVT, Wells LE, MADRS, klokketest (Shulman 1–6),
    strukturert kne- og skulderundersøkelse
  - Undersøkelser (`kategori: "undersokelse"`, `beregning: "ingen"`) har `funn`-felter
    (normal/patologisk/ikke utført), `lateralitet: true` og ingen sum. Testlistene er bevisst korte
    — kun tester med god dokumentert treffsikkerhet, hver med én linje `hjelp` om hva funnet betyr.
    Tester legen ikke krysser av, utelates fra notatet, og «Kilde»-linjen droppes for verktøy uten skår
  - `detaljStil` styrer notatlinjen: `full` (standard), `poeng` (MADRS — 10 ledd ville ellers gitt
    en avsnittslang linje), `tekst` (klokketest — ett ledd, poenget står allerede i summen).
    `sumEtikett` overstyrer «poeng» der summen ikke er poeng (klokketest: «på Shulman-skalaen»)
  - `ubesvarteValg()` blokkerer lagring til alle `valg`-felter er besvart. Et halvutfylt MADRS gir
    ellers en sum som ser gyldig ut, men er for lav — og ville landet i feil alvorlighetsgrad.
    Undersøkelser krever tilsvarende at minst ett funn er registrert
  - `testkasus` på hver definisjon = referansekasus med kjent fasit; `kjorTestkasus()` verifiserer
    poengsummeringen (prosjektet har ingen testrunner)
  - Søkbar liste + nøkkelordbaserte forslag ut fra transkript/kontekst (`src/lib/verktoy/sok.ts`)
  - Resultatet lagres strukturert som `Konsultasjon.verktoyResultater` (IndexedDB), ikke bare som
    tekst i notatet — ellers forsvinner det ved «Regenerer»
  - `synkVerktoySeksjon()` skriver seksjonen `--- KLINISKE VERKTØY ---` inn i notatet. Idempotent
    (ingen duplikater ved gjentatte kall) og plasseres foran `--- OCR ---`. Kalles fra
    `handleStreamFerdig` og ved hver endring i modalen
  - Systemprompt: `felles:verktoy` (staging-registry) legges på kun når verktøy er utført. Gir
    Claude tallene som kontekst og forbyr modellen å gjengi eller endre dem
  - `VerktoyModal` remounter innholdet via `key={aktiv.id}` slik at et halvutfylt skjema aldri
    følger med til neste pasient

### Planlagt
- Kliniske verktøy, gjenstående faser: MMS-NR (krever rettighetsavklaring for itemtekst),
  AI-forslag og AI-forhåndsutfylling med bekreftelseskrav, admin-CRUD for egne verktøy
  (`/admin/verktoy` + Prisma-modell)
- Frasebibliotek
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
├── prisma.config.ts               # Prisma 7-konfig: schema-sti + datasource-URL (for CLI)
├── .env                           # Miljøvariabler (server-side)
├── .env.example                   # Mal for .env (hemmeligheter tomme; committet)
├── .env.local                     # Lokal override
├── .gitattributes                 # *.sh = LF (så deploy-skript ikke feiler på Linux)
├── Dockerfile                     # Multi-stage build (deps → prisma generate + next build → runner)
├── docker-compose.yml             # Service «legeassist», env_file .env, eksterne nett: reverse-proxy_default + app-backend
├── deploy.sh                      # Kjøres på server: git pull → docker compose build/up → prisma db push → restart
├── push-and-deploy.sh             # Kjøres lokalt: push + SSH kjører deploy.sh på server + helsesjekk
├── db-tunnel.sh                   # Kjøres lokalt (Git Bash): SSH-tunnel til shared-mariadb (slår opp container-IP)
├── db-tunnel.ps1                  # Samme tunnel for PowerShell (bruker Windows sin ssh.exe)
├── prisma/
│   └── schema.prisma              # User (inkl. dpa*), Mal, sesjon, PasswordSetupToken, DpaVersjon
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # Offentlige: login, tilgang (tilgangsforespørsel), sett-passord
│   │   ├── databehandleravtale/   # Offentlig: gjeldende DPA + sikkerhet/ROS/teknisk
│   │   ├── godta-avtale/          # Innlogget signeringsgate (egen rot-rute, ingen app-skall)
│   │   ├── (app)/                 # Hovedapp (beskyttet; gates av DPA-signatur)
│   │   │   ├── konsultasjon/      # Konsultasjonsvisning + notatgenerering
│   │   │   ├── innstillinger/     # Brukerinnstillinger (2FA, DPA-status, Bedrock-info)
│   │   │   └── admin/
│   │   │       ├── innstillinger/ # Adminside: modell/region/nøkler (kun admin)
│   │   │       ├── brukere/       # Adminside: opprett/inviter/slett brukere
│   │   │       └── databehandleravtale/ # Adminside: opprett/se DPA-versjoner
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
│   ├── actions/                   # Server actions
│   │   ├── auth.ts                # sjekkInnlogging (credential-presjekk)
│   │   ├── to-faktor.ts           # 2FA: generer/bekreft/deaktiver
│   │   ├── admin-brukere.ts       # opprettBruker (m/invitasjon), sendInvitasjonPaaNytt, slettBruker
│   │   ├── tilgang.ts             # sendTilgangsforesporsel + settPassordMedToken (signerer DPA)
│   │   ├── dpa.ts                 # signerAvtale (innlogget signering)
│   │   └── admin-dpa.ts           # opprettDpaVersjon (admin, immutable versjoner)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui-komponenter
│   │   ├── dpa/                   # dpa-sammendrag, godta-avtale-skjema, markdown (renderer)
│   │   ├── auth/                  # sett-passord-skjema
│   │   ├── app/
│   │   │   ├── konsultasjon-view.tsx      # KonsultasjonsUI med Claude-integrasjon
│   │   │   ├── journalgjennomgang-view.tsx# Journalgjennomgang: PDF-opplasting + oppsummering
│   │   │   ├── diktat-view.tsx            # Diktat: fri diktering + språkvask (opptak, mal, resultat)
│   │   │   ├── ai-hjelp-view.tsx          # Frittstående AI-hjelp: kontekst + vedlegg + chat (modus: aihjelp)
│   │   │   ├── hoved-innhold.tsx          # Ruter mellom KonsultasjonView / DiktatView / JournalgjennomgangView
│   │   │   ├── chat-modal.tsx             # Chat / AI-hjelp modal
│   │   │   ├── verktoy-modal.tsx          # Kliniske verktøy: søkbar liste + aktivt skjema + utførte
│   │   │   ├── verktoy-skjema.tsx         # Generisk renderer for alle felttyper i et verktøy
│   │   │   ├── diktering-knapp.tsx        # Gjenbrukbart mikrofonikon: live transkribering inn i et tekstfelt
│   │   │   ├── vedlegg-panel.tsx          # Vedlegg: opplasting, kamera, oppgavevalg (modus: ocr|standard)
│   │   │   ├── to-faktor-paaminnelse.tsx  # Diskret 2FA-påminnelse (~1/mnd, localStorage)
│   │   │   ├── app-header-meny.tsx        # Brukermeny (innstillinger, DPA, admin-lenker)
│   │   │   └── app-sidebar.tsx            # Sidebar med konsultasjonsliste (stikkord)
│   │   ├── settings/
│   │   │   ├── innstillinger-klient.tsx   # Tabulert innstillingsside (Konto / Promptbibliotek)
│   │   │   ├── to-faktor-seksjon.tsx      # 2FA-oppsett (QR, bekreft, deaktiver)
│   │   │   └── promptbibliotek-klient.tsx # CRUD-UI for maler (Konsultasjon, Møte, Diktat, Chat, AI-hjelp)
│   │   └── admin/
│   │       ├── bedrock-innstillinger.tsx  # Client-komponent for admin-konfig
│   │       ├── bruker-administrasjon.tsx  # Opprett/inviter/slett brukere (admin-merke, status)
│   │       └── opprett-dpa-skjema.tsx     # Skjema for ny DPA-versjon (admin)
│   ├── lib/
│   │   ├── auth.ts                # NextAuth konfigurasjon
│   │   ├── db.ts                  # Prisma-klient (Prisma 7 + mariadb-driveradapter, parser DATABASE_URL)
│   │   ├── mail.ts               # SMTP (nodemailer): sendEpost, hentBasisUrl (server-only)
│   │   ├── passord-token.ts      # Engangstoken for passordoppsett (SHA-256-hash)
│   │   ├── dpa.ts                # DPA: hentGjeldendeDpa, harGyldigSignatur, baseline (server-only)
│   │   ├── admin.ts               # isAdmin(), hentSystemSetting(), tilgjengeligeModeller/Regioner()
│   │   ├── idb.ts                 # IndexedDB-operasjoner (konsultasjoner, 24t TTL)
│   │   ├── staging.ts             # Grunntekster + TYPE_STAGING + CHAT/AIHJELP/PROMPTBYGGER_STAGING + felles seksjoner
│   │   ├── staging-registry.ts    # STAGING_REGISTRY: overstyrbare staging-tekster (fil-standard)
│   │   ├── staging-server.ts      # Server-resolver: DB-override + fil-fallback, bygger system prompt
│   │   ├── tema.ts                # TYPE_TEMA (fargetema) + TYPE_IKON_KOMP (ikon per type)
│   │   ├── verktoy/               # Kliniske verktøy (typer, beregning, søk, definisjoner)
│   │   │   ├── typer.ts           # Verktoy, Felt, Seksjon, Terskel, VerktoyResultat
│   │   │   ├── beregn.ts          # beregn/byggResultat/synkVerktoySeksjon/kjorTestkasus
│   │   │   ├── sok.ts             # sokVerktoy + foreslaaVerktoy (nøkkelord)
│   │   │   ├── registry.ts        # INNEBYGDE_VERKTOY + finnVerktoy
│   │   │   └── definisjoner/      # Én fil per verktøy (chadsvasc, qsofa, wells-*, madrs,
│   │   │                          #   klokketest, kne, skulder)
│   │   └── vedlegg.ts             # VEDLEGG_OPPGAVE_INFO, VEDLEGG_OCR_BRUK_INFO, lagVedleggInstruksjon()
│   ├── types/
│   │   └── konsultasjon.ts        # Konsultasjon (inkl. stikkord, malId), ChatMelding, Vedlegg, VedleggOcrBruk, typer
│   └── hooks/
│       ├── use-claude.ts          # SSE-hook for notatgenerering
│       ├── use-verktoy.ts         # Utførte kliniske verktøy + notat-synk
│       ├── use-chat.ts            # SSE-hook for multi-turn chat + IndexedDB-persistering
│       ├── use-konsultasjon.tsx   # KonsultasjonContext + oppdater()
│       ├── use-transkribering.ts  # Soniox WebSocket-klient
│       ├── use-diktering.ts       # Enkel Soniox-diktering for tekstfelt (final + partial, ingen AI)
│       ├── use-hurtigtaster.ts    # Alt-baserte globale hurtigtaster
│       └── use-mikrofon.ts        # Mikrofontillatelse og enhetsliste
└── public/
```

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

# Administrasjon
ADMIN_EMAILS=admin@klinikk.no     # Kommaseparert liste over admin-e-poster

# E-post (SMTP) — Google Workspace med app-passord
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465                     # 465 = implisitt TLS, 587 = STARTTLS
SMTP_USER=ragnar@lilletorget.org
SMTP_PASSWORD=...                 # App-passord (ikke vanlig kontopassord)
SMTP_FROM="legeassist <ragnar@lilletorget.org>"  # Valgfri; faller tilbake til SMTP_USER
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
- **SSH:** `ssh -i ~/.ssh/legeassist_vps_new ragnar@159.195.146.240`
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

**Formatkrav (ren tekst, ingen markdown):** Notat- og chat-tekst rendres uten markdown-tolkning
(`whitespace-pre-wrap`/`Textarea` — stjerner og `#` vises bokstavelig), så samtlige grunntekster i
`staging.ts` (SOAP-typer, MØTE, DIKTAT, JOURNALGJENNOMGANG, CHAT, AI-HJELP, PROMPTBYGGER) instruerer
Claude om å ikke bruke `**fet skrift**`, `#`-overskrifter eller punktlister med stjerne/strek.

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
