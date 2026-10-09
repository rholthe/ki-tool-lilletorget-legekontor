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
- Claude via AWS Bedrock: IAM-brukeren **`legeassist`** (egen bruker, ikke personlig) har policyen
  `bedrock-claude-eu` + `sts:GetFederationToken` på `arn:aws:sts::171433610132:federated-user/la-*`.
  Nøklene ligger i `.env` som `BEDROCK_API_KEY`/`BEDROCK_SECRET_KEY` og forlater aldri serveren.
  - `/api/ai/oppsett` lager kortlivede nøkler per bruker (`la-<userId>`, 1 t) med sesjonspolicy som bare
    tillater `InvokeModel(WithResponseStream)` på `eu.anthropic.*`/`anthropic.*` i `eu-*`. CloudTrail viser
    hvem som kalte. Verifisert 2026-10-09: EU virker, us-east-1 avvises
  - Region: eu-central-1 (Frankfurt) med `eu.`-prefiks modeller

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
- Meldinger fra admin (`/admin/meldinger`, `Melding` + `MeldingLest`)
  - Admin publiserer en melding (markdown). Uleste aktive meldinger vises én om gangen som stor modal
    øverst i appen (`melding-visning.tsx`), som ikke kan lukkes med Esc/klikk utenfor — brukeren må
    trykke «Jeg har lest» (`markerMeldingLest`)
  - Admin ser «Lest av X av Y» og navn på hvem som har/ikke har lest; «Trekk tilbake» skjuler meldingen
  - Er ingen meldinger publisert, er skjemaet forhåndsutfylt med `SIKKERHETSMELDING_FORSLAG`
- Øktsikkerhet og kryptering i nettleseren (regler i `src/lib/okt.ts`)
  - **Daglig innlogging:** økten varer maks 12 t fra innlogging (`MAKS_OKT_MS`)
  - **Inaktivitet:** 1 t uten aktivitet → utlogget, data **låst, ikke slettet**. Serveren håndhever det i
    JWT-callbacken (`fornyOktToken`, kjøres via proxyen på hver forespørsel). Klienten (`OktVakt`) varsler
    5 min før, logger ut, og sender `/api/okt/puls` hvert 5. min mens brukeren er aktiv. Pågående opptak
    teller som aktivitet (`registrerAktivitet()` i Soniox-hookene). Aktivitet deles mellom faner via localStorage
  - **Lukket nettleser:** øktcookien `la_okt` (uten utløpsdato, httpOnly) må matche `session.oktId`.
    Proxyen setter den de første 30 s etter innlogging; mangler den senere, sendes brukeren til
    `/utlogget?grunn=lukket` som logger ut via Auth.js. Auth.js' egen cookie har alltid utløpsdato og
    kan ikke brukes til dette. Begrensning: Chrome/Edge med «fortsett der du slapp» gjenoppretter øktcookies
  - **Kryptering:** konsultasjoner i IndexedDB er AES-256-GCM-kryptert per bruker (`src/lib/datakrypto.ts`,
    `src/lib/idb.ts`). Nøkkelen (`User.datanokkel`, kryptert med `TOTP_ENCRYPTION_KEY`) hentes fra
    `/api/datanokkel` etter innlogging og holdes bare i minnet som ikke-eksporterbar `CryptoKey`.
    Klartekst i IndexedDB: kun `id`, `userId`, `createdAt`, `expiresAt`. Andre brukeres poster på samme
    maskin vises ikke og kan ikke leses. Ukrypterte poster fra før kryptering krypteres ved første
    lesing og tilfaller den som logger inn først
  - **Aktiv «Logg ut»** krever bekreftelse og sletter brukerens konsultasjoner på maskinen (andres blir
    liggende). 24-timers sletting gjelder som før, for alle brukere
  - Innloggingssiden forklarer hvorfor brukeren ble logget ut (`?grunn=inaktiv|lukket|utlopt|utlogget`)
- Obligatorisk to-faktor fra en dato (`src/lib/to-faktor-krav.ts`, SystemSetting `krev_2fa_fra`, YYYY-MM-DD i norsk tid)
  - Settes/fjernes av admin på `/admin/brukere` (viser også «X av Y har aktivert»)
  - Før datoen: daglig påminnelse med datoen (`ToFaktorPaaminnelse fristTekst`)
  - Fra datoen: `(app)/layout.tsx` sender brukere uten 2FA til `/sikre-kontoen` (egen rot-rute som
    `/godta-avtale`), og `/api/ai/oppsett` og `/api/soniox-token` svarer 403
    (`maaAktivere2fa`). `deaktiver2FA` nektes mens kravet gjelder
- Bruksstatistikk (`Bruk`-tabellen, `/admin/bruk`, «Bruk og kostnader» i adminmenyen)
  - Én rad per Claude-kall (`funksjon`: notat, chat, aihjelp, promptbygger; `verktoyforslag` kun historisk) og per
    Soniox-økt (transkribering, diktering). Kun tall: tokens fra Bedrocks egne invocation-metrics,
    `total_audio_proc_ms` fra Soniox, antall tegn. Rapporteres av nettleseren (`rapporterForbruk`,
    `soniox-maaler.ts`, `keepalive`) til `/api/bruk`, som validerer (zod, øvre grenser) og regner kostnad
  - Priser i SystemSetting `bruk_priser` (`src/lib/bruk-priser.ts`), redigeres på admin-siden; kostnad
    lagres per rad, så prisendringer ikke endrer historikk. Standard: Sonnet 4.6 EU $3,30/$16,50 per MTok,
    Soniox $0,12/t, kurs 10,5 NOK
  - Månedsvisning per bruker + per funksjon + CSV (`/api/admin/bruk/csv?mnd=YYYY-MM`, semikolon, norsk komma)
  - Ingen fremmednøkkel: statistikken består etter at en bruker slettes
  - Tallene kommer fra klienten og kan i teorien manipuleres; kryssjekk mot CloudTrail (`la-<userId>`),
    Soniox (`client_reference_id`) og fakturaene
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
- Kliniske verktøy: skåringsverktøy, strukturerte undersøkelser og retningslinjer i konsultasjonsbildet
  - Egen knapp ved siden av «Chat / AI-hjelp» (`ClipboardList`-ikon) → `VerktoyModal`, hurtigtast `Alt+V`
  - **Poeng og terskler beregnes alltid av koden, aldri av Claude** (`src/lib/verktoy/beregn.ts`)
  - Verktøy er deklarative, JSON-serialiserbare definisjoner (`src/lib/verktoy/definisjoner/*.ts`):
    felter (`ja_nei`/`valg`/`tall`/`funn`/`fritekst`), `beregning` (`sum`/`sum_per_seksjon`/`ingen`)
    og en `terskler`-tabell. Formen er bevisst uten funksjoner, slik at admin senere kan opprette
    verktøy fra frontend med nøyaktig samme datamodell
  - Implementert: CHA₂DS₂-VASc, qSOFA, PEVS, NORRISK 2, Wells DVT, Wells LE, MADRS, MDI,
    klokketest (Shulman 1–6), strukturert kne- og skulderundersøkelse
  - **Formelverktøy** (`beregning: { type: "formel", formelId }`): resultatet kommer fra en
    navngitt funksjon i `src/lib/verktoy/formler.ts`, aldri fra lagret kode som evalueres.
    Definisjonen forblir dermed JSON-serialiserbar også for regresjonsmodeller
    - NORRISK 2 er første: Cox-modell som gir 10-årsrisiko i prosent, med egne koeffisientsett
      per kjønn, kvadratisk aldersledd og aldersinteraksjoner for BT, kolesterol og røyking
    - **Koeffisientene er utledet, ikke transkribert.** Siden `log(−log(1 − risiko))` er lineær i
      kovariatene, faller hver koeffisient eksakt ut av å endre ett felt om gangen i
      Helsedirektoratets egen kalkulator. Rekonstruksjonen er kontrollert mot kalkulatoren i
      36 000 punkter; største avvik 6·10⁻¹³ prosentpoeng. Metoden kan ikke bomme på hvilken
      koeffisient som hører til hvilket ledd — det kan transkribering
    - Utenfor validert område (alder 45–74, BT 120–160, kolesterol 4–8) returnerer formelen null
      i stedet for å ekstrapolere. En risikoprosent regnet på en 80-åring ville sett like
      troverdig ut som en gyldig
    - MDI er det andre: tolv spørsmål, men ti ledd. For parene 8a/8b og 10a/10b teller kun
      det høyeste svaret, så en rett `sum` ville gitt inntil 60 på en skala som går til 50 —
      og systematisk overvurdert alvorlighetsgraden. Alternativene er listet stigende slik at
      **indeks === poeng**; formelen får bare svarene, ikke definisjonen
    - **Kilden er den åpne originalpublikasjonen, ikke NHI.** Ledd, svaralternativer,
      maksregelen og alvorlighetsbåndene er hentet fra figur 1a/1b i Bech et al., BMC
      Psychiatry 2015 (CC BY 4.0). NHIs norske versjon er opphavsrettslig beskyttet med
      uttrykkelig forbehold mot tekst- og datautvinning, og er ikke brukt. Den norske
      ordlyden er vår egen oversettelse av originalen — ikke validert på norsk, hvilket
      står i `veiledning` slik at legen ser det. NHI opplyser det samme om sin versjon
    - MDI er pasientutfylt, MADRS legeskåret. Begge kommer opp på søk etter «depresjon»,
      og det er riktig — de svarer på hvert sitt spørsmål
    - Formelverktøy viser ikke poeng per alternativ i skjemaet (`visPoeng` i
      `verktoy-skjema.tsx`). For et selvutfyllingsskjema er det en fordel: pasienten ser
      svaralternativene, ikke hva de er verdt
  - **Kalkulatorer** (`Kalkulator` i `Oppslag`-unionen) er en tredje datatype ved siden av
    `Verktoy` og `Retningslinje`: flere inngangsveier til samme størrelse, og flere utdata
    samtidig i stedet for ett tall med tolkningsbånd. Inndataene har samme form, så `Felt`,
    `Seksjon` og `VerktoySkjema` gjenbrukes uendret
    - Implementert: Svangerskapskalkulator (termin, siste menstruasjon, gestasjonsalder)
    - `kalkulatorId` slår opp en navngitt funksjon i `kalkulatorer.ts`, samme prinsipp som
      `formelId`. Merk at NORRISK 2 også har `kategori: "kalkulator"` men er et `Verktoy` —
      `erKalkulator()` skiller på `kalkulatorId`, ikke på kategorien
    - `Felt.synligNar` skjuler felter som hører til en annen inngangsvei. Skjulte felter teller
      heller ikke som ubesvarte
    - Ny felttype `dato` (ISO-streng fra `<input type="date">`)
    - **All datoregning skjer i UTC-midnatt.** Legger man dager til en lokal `Date`, gir
      sommertid av og til 23- eller 25-timersdøgn, og en termindato bommer med én dag to ganger
      i året. Ett av referansekasusene krysser sommertidsskiftet med vilje
    - **Termin = effektiv siste mens + 283 dager**, der effektiv siste mens er oppgitt dato
      justert for sykluslengde (`+ syklus − 28`). Internasjonalt regnes 280 dager, men norske
      kalkulatorer bruker 283 fordi median svangerskapslengde er tre dager lengre her. Terminen
      faller dermed på gestasjonsalder 40+3, ikke 40+0 — en konsekvens av konvensjonen
    - Sykluslengde justerer **både** termin og gestasjonsalder like mye. Verifisert mot NHIs
      terminkalkulator for både 28 og 35 dagers syklus, på alle tre utdataene
    - Ved IVF er «siste menstruasjon» en beregnet ekvivalent: overføringsdato − embryoalder − 14,
      deretter samme 283 dager. Det gir overføring + 264 for blastocyst dag 5, mot + 261
      internasjonalt. Valgt bevisst: med 280-dagersregelen for IVF ville samme svangerskap fått
      to ulike terminer avhengig av hvilken inngangsvei legen brukte
    - `Felt.synligNar.erLik` tar også en liste, for felter som hører til flere inngangsveier
  - `Veiledning` har blokktypen `lenke`, og `kilde.url` vises som «Kilde»-lenke i modalhodet
  - `Terskel.betingelse` lar en terskel gjelde bare når et annet felt ligger i et intervall.
    NORRISK 2 har aldersbåndede grenser — 9 % er lav risiko hos en 70-åring og høy hos en
    50-åring. Første terskel som matcher både sum og betingelse vinner
  - PEVS (Pediatric Early Warning Score, Asker og Bærum legevakt 1.6) drev tre utvidelser av
    datamodellen, alle fortsatt JSON-serialiserbare:
    - `beregning.maks` kapper totalsummen (PEVS: maks 9, men tilleggspoengene kan gi råsum 13)
    - `overstyringer: [{ type: "enkeltfelt_minst", poeng, klasse, tekst, farge }]` slår ut
      uavhengig av totalen. Terskeltabellen kjenner bare summen, og PEVS krever umiddelbart
      legetilsyn ved 3 poeng på én parameter selv når totalen er 3
    - `veiledning` (`Veiledning` med blokker `overskrift`/`avsnitt`/`punkter`/`tabell`) på både
      verktøy og enkeltfelt, vist via `VeiledningLenke` → egen modal (`verktoy-veiledning.tsx`).
      Skjemaet viser kun én kort `hjelp`-linje per punkt; normalverdi-tabeller og
      administreringsinstruks hører hjemme bak lenken
    - Aldersgruppe er et eget `valg`-felt med 0 poeng, siden PEVS-kriteriene er avvik fra
      aldersavhengige normalverdier. Normalverdiene står som `kriterium` på hvert alternativ
  - Undersøkelser (`kategori: "undersokelse"`, `beregning: "ingen"`) har `funn`-felter
    (normal/patologisk/ikke utført), `lateralitet: true` og ingen sum. Testlistene er bevisst korte
    — kun tester med god dokumentert treffsikkerhet, hver med én linje `hjelp` om hva funnet betyr.
    Tester legen ikke krysser av, utelates fra notatet, og «Kilde»-linjen droppes for verktøy uten skår
  - `detaljStil` styrer notatlinjen: `full` (standard), `poeng` (MADRS og PEVS — 10 ledd eller
    avsnittslange alternativtekster ville ellers gitt en uleselig linje), `tekst` (klokketest —
    ett ledd, poenget står allerede i summen), `uten_poeng` (etikett + tekst, for klassifiserende
    felter som ikke skårer, som PEVS sin aldersgruppe). Kan settes per felt og overstyrer da
    verktøyets. `sumEtikett` overstyrer «poeng» der summen ikke er poeng (klokketest:
    «på Shulman-skalaen»)
  - `ubesvarteValg()` blokkerer lagring til alle `valg`-felter er besvart. Et halvutfylt MADRS gir
    ellers en sum som ser gyldig ut, men er for lav — og ville landet i feil alvorlighetsgrad.
    Undersøkelser krever tilsvarende at minst ett funn er registrert
  - `testkasus` på hver definisjon = referansekasus med kjent fasit (`forventetSum`, valgfritt
    `forventetKlasse` som også dekker terskler og overstyringer); `kjorTestkasus()` verifiserer dem
  - Selvtest: `npm run verktoy:test` (`scripts/verktoy-selvtest.mjs`) kompilerer `src/lib/verktoy`
    med tsc og kjører alle referansekasus, sjekker at hver oppnåelige sum treffer en terskel, og at
    `synkVerktoySeksjon()` er idempotent. For formelverktøy sveipes terskeltabellens eget spenn —
    feltenes ytterpunkter sier ingenting om hva formelen kan gi (MDI når aldri 60, NORRISK 2 gir
    en prosent), så der dekker referansekasusene grenseverdiene i stedet. Prosjektet har ingen
    testrunner, og poengsummene er nettopp det som ikke får være feil — kjør dette etter hver
    endring i et verktøy
  - Søk og forslag skjer lokalt i `src/lib/verktoy/sok.ts`, **uten AI**. Retningslinjenes
    tilstander er egne rader, så legen kan søke på «ørebetennelse»
    - **Fritekstsøket** er rangert (beste treff først, Enter åpner det) og tåler synonymer,
      bøyninger («halsbetennelsen»), skrivefeil («ørebetenelse», avstand 1 fra 4 bokstaver, 2 fra 8)
      og tastatur uten æøå («orebetennelse»). `normaliser()` bretter æ/ø/å og aksenter på begge sider
    - **Synonymgrupper** i `src/lib/verktoy/synonymer.ts` (fagterm, folkelig ord, forkortelse:
      «drypp» → CHA₂DS₂-VASc, «slapp baby» → PEVS). Gjelder kun søkefeltet — brede ord der ville
      gitt forslag i annenhver konsultasjon. Det som skal utløse forslag, står i `sokeord`
    - Synonymer får ikke skrivefeiltoleranse (ellers traff «knesmerter» «øresmerter»), og treff
      inni et ord krever minst fire bokstaver (ellers traff «tia» «visuospatial»)
    - **Forslag** ut fra transkript/kontekst er hele-ord-treff på `sokeord`; retningslinjens egne
      søkeord teller ikke
    - «Nylig brukt» (maks 5, kun treff-id-er i localStorage `legeassist:verktoy-nylig`)
    - Selvtesten har søkekasus (`SOKEKASUS`) — legg til et kasus når et søk har bommet
    - AI-forslag (Claude foreslo verktøy ut fra hele transkriptet) ble fjernet 2026-10-09: kallet
      gikk på nytt ved hver endring i transkriptet, med hele transkriptet som input, og sto for en
      uforholdsmessig stor del av kostnadene. `verktoyforslag` består i `/api/bruk` og
      `/admin/bruk` bare for historikkens skyld
  - Resultatet lagres strukturert som `Konsultasjon.verktoyResultater` (IndexedDB), ikke bare som
    tekst i notatet — ellers forsvinner det ved «Regenerer»
  - `synkVerktoySeksjon()` skriver seksjonen `--- KLINISKE VERKTØY ---` inn i notatet. Idempotent
    (ingen duplikater ved gjentatte kall) og plasseres foran `--- OCR ---`. Kalles fra
    `handleStreamFerdig` og ved hver endring i modalen
  - Systemprompt: `felles:verktoy` (staging-registry) legges på kun når verktøy er utført. Gir
    Claude tallene som kontekst og forbyr modellen å gjengi eller endre dem
  - `VerktoyModal` remounter innholdet via `key={aktiv.id}` slik at et halvutfylt skjema aldri
    følger med til neste pasient
  - **Retningslinjer** (`kategori: "retningslinje"`) er en egen datatype, ikke et verktøy uten
    poeng. Legen fyller ikke ut noe — hun slår opp. `Retningslinje` → `Tilstand` → `Anbefaling`
    (`src/lib/verktoy/typer.ts`), og `Oppslag = Verktoy | Retningslinje` deler modal, søk og
    notat-innsetting
    - Implementert: Antibiotika i allmennpraksis (nasjonal faglig retningslinje, Helsedirektoratet),
      kuratert utvalg på 18 tilstander i `src/lib/verktoy/retningslinjer/antibiotika.ts`
      (øvre/nedre luftveier, urinveier, hud, genitalt, samt sepsis og bakteriell meningitt der
      anbefalingen er prehospital engangsdose før innleggelse)
    - **Alt innhold er hentet ordrett fra kilden**, aldri skrevet fra hukommelsen og aldri
      omformulert av en språkmodell. Doser settes inn i notatet av koden, ikke via prompten —
      en omskrevet «660 mg x 4» ville vært like usynlig som en feilsummert skår
    - `Anbefaling` speiler kildens egne vektbånd (`etikett`: «Barn 25–35 kg») i stedet for en
      voksen/barn-akse kilden ikke har. Båndene varierer mellom tilstander og mellom
      standardbehandling og allergialternativ
    - **Ferskhet er hoveddesigndriveren.** En behandlingsretningslinje revideres løpende, i
      motsetning til CHA₂DS₂-VASc. `sistVerifisert` ligger per tilstand, vises i UI-et, og
      `npm run verktoy:test` **feiler** når en tilstand er eldre enn
      `VERIFISERING_ADVARSEL_DAGER` (180). Uten en mekanisk påminnelse blir dette glemt
    - Tilstandene er egne rader i søkelisten — legen søker «ørebetennelse», ikke «Antibiotika i
      allmennpraksis». Retningslinjens egne søkeord teller ikke i forslagene («infeksjon» ville
      slått ut i annenhver konsultasjon)
    - «Antibiotika ikke indisert» er et eget valg: å journalføre at behandling ikke er indisert er
      et like gyldig utfall som å velge preparat (akutt bronkitt har ingen anbefalinger i det hele tatt)
    - Resultatet lagres som et vanlig `VerktoyResultat` med `visKilde: true` — gir persistering,
      gjenåpning og «Regenerer»-motstand gratis, uten egen datamodell

### Planlagt
- Antibiotikaretningslinjen: rettighetsavklaring med Helsedirektoratet før produksjonssetting
  (utgiver oppgir ingen eksplisitt lisens); flere tilstander og kapitler; vektbasert
  barnedosering som egen `kalkulator`
- Kliniske verktøy, gjenstående faser: MMS-NR (krever rettighetsavklaring for itemtekst),
  AI-forhåndsutfylling med bekreftelseskrav, admin-CRUD for egne verktøy
  (`/admin/verktoy` + Prisma-modell)
- Frasebibliotek
- Klinikk-teamfunksjonalitet

## GDPR og personvern

- Pasientdata behandles i nettleseren og hos Soniox/AWS Bedrock
- VPS håndterer autentisering og deler ut kortlivede nøkler; pasientinnhold er aldri innom serveren
- Soniox: EU-databehandling, DPA tilgjengelig
- AWS Bedrock (eu-west-1 Irland): EU-databehandling for Claude-modeller
  - IAM-nøklene til `legeassist` ligger kun på serveren; nettleseren får 1-times STS-nøkler
  - Pasienttranskript sendes fra nettleseren direkte til Bedrock (STS-nøkler, kun EU)
- Ingen lydopptak lagres — streames direkte gjennom Soniox
- Transkript og notater beholdes kun i nettlesersesjon (eller IndexedDB med TTL)
- Logging på serveren skal ikke inneholde pasientrelatert innhold
- 2FA anbefalt for alle brukere (blir obligatorisk — brukerne varsles via meldingssystemet først)
- Konsultasjoner i nettleseren er kryptert per bruker; nøkkelen finnes bare i minnet mens brukeren er innlogget

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
├── scripts/
│   └── verktoy-selvtest.mjs       # npm run verktoy:test — referansekasus, terskler, notat-synk
├── prisma/
│   └── schema.prisma              # User (inkl. dpa*, datanokkel), Mal, sesjon, PasswordSetupToken, DpaVersjon, Melding, MeldingLest
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # Offentlige: login, tilgang (tilgangsforespørsel), sett-passord
│   │   ├── databehandleravtale/   # Offentlig: gjeldende DPA + sikkerhet/ROS/teknisk
│   │   ├── godta-avtale/          # Innlogget signeringsgate (egen rot-rute, ingen app-skall)
│   │   ├── utlogget/              # Offentlig: logger ut via Auth.js når nettleseren har vært lukket
│   │   ├── sikre-kontoen/         # Gate: aktiver 2FA når det er obligatorisk (ingen app-skall)
│   │   ├── (app)/                 # Hovedapp (beskyttet; gates av DPA-signatur)
│   │   │   ├── konsultasjon/      # Konsultasjonsvisning + notatgenerering
│   │   │   ├── innstillinger/     # Brukerinnstillinger (2FA, DPA-status, Bedrock-info)
│   │   │   └── admin/
│   │   │       ├── innstillinger/ # Adminside: modell/region/nøkler (kun admin)
│   │   │       ├── brukere/       # Adminside: opprett/inviter/slett brukere
│   │   │       ├── databehandleravtale/ # Adminside: opprett/se DPA-versjoner
│   │   │       └── meldinger/     # Adminside: publiser meldinger, se hvem som har lest
│   │   ├── api/
│   │   │   ├── auth/              # NextAuth
│   │   │   ├── soniox-token/      # Genererer temp-tokens for Soniox
│   │   │   ├── ai/oppsett/        # Kortlivede AWS-nøkler + modell/region/prompt-overrides til nettleseren
│   │   │   ├── bruk/              # Tar imot forbrukstall (POST), regner kostnad
│   │   │   ├── maler/             # CRUD for Mal (GET/POST, PUT/DELETE per ID, delte maler, importer)
│   │   │   ├── datanokkel/        # Brukerens nøkkel for kryptering i nettleseren (opprettes ved behov)
│   │   │   ├── okt/puls/          # Livstegn fra aktiv klient (holder serverøkten i live)
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
│   │   ├── admin-dpa.ts           # opprettDpaVersjon (admin, immutable versjoner)
│   │   ├── meldinger.ts           # markerMeldingLest, opprettMelding, settMeldingAktiv
│   │   └── krav-2fa.ts            # settKrav2faFra (admin)
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
│   │   │   ├── verktoy-veiledning.tsx     # Full veiledning (blokker/tabeller) i egen modal, via lenke
│   │   │   ├── retningslinje-visning.tsx  # Oppslag: indikasjon, behandlingslinjer, ferskhet + kildelenke
│   │   │   ├── diktering-knapp.tsx        # Gjenbrukbart mikrofonikon: live transkribering inn i et tekstfelt
│   │   │   ├── vedlegg-panel.tsx          # Vedlegg: opplasting, kamera, oppgavevalg (modus: ocr|standard)
│   │   │   ├── to-faktor-paaminnelse.tsx  # Diskret 2FA-påminnelse (~1/mnd, localStorage)
│   │   │   ├── melding-visning.tsx        # Uleste admin-meldinger som modal, «Jeg har lest»
│   │   │   ├── okt-vakt.tsx               # Inaktivitetsvakt: varsel, utlogging (låser), puls
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
│   │   ├── idb.ts                 # IndexedDB-operasjoner (konsultasjoner kryptert per bruker, 24t TTL)
│   │   ├── bedrock-nettleser.ts   # Claude fra nettleseren: SigV4, event-strøm, forbruksrapport
│   │   ├── ai-foresporsler.ts     # Bygger notat-/chat-forespørsler (flyttet fra API-rutene)
│   │   ├── staging-bygg.ts        # Rene funksjoner for systemprompter (brukes i nettleseren)
│   │   ├── soniox-maaler.ts       # Måler lydtid/tegn per Soniox-økt og rapporterer
│   │   ├── bruk-priser.ts         # Priser + kostnadsberegning (server-only)
│   │   ├── bruk-statistikk.ts     # Månedsaggregering per bruker/funksjon (server-only)
│   │   ├── datakrypto.ts          # Nøkkel fra /api/datanokkel (kun i minnet) + AES-GCM krypter/dekrypter
│   │   ├── okt.ts                 # Øktregler: 1 t inaktivitet, 12 t maks, øktcookie, fornyOktToken
│   │   ├── to-faktor-krav.ts      # Obligatorisk 2FA fra dato: hentKrav2faFra, maaAktivere2fa (server-only)
│   │   ├── aktivitet.ts           # registrerAktivitet() — signal til OktVakt (f.eks. under opptak)
│   │   ├── meldinger-forslag.ts   # Forhåndsutfylt sikkerhetsmelding i admin-skjemaet
│   │   ├── staging.ts             # Grunntekster + TYPE_STAGING + CHAT/AIHJELP/PROMPTBYGGER_STAGING + felles seksjoner
│   │   ├── staging-registry.ts    # STAGING_REGISTRY: overstyrbare staging-tekster (fil-standard)
│   │   ├── staging-server.ts      # Server-resolver: DB-override + fil-fallback, bygger system prompt
│   │   ├── tema.ts                # TYPE_TEMA (fargetema) + TYPE_IKON_KOMP (ikon per type)
│   │   ├── verktoy/               # Kliniske verktøy (typer, beregning, søk, definisjoner)
│   │   │   ├── typer.ts           # Verktoy, Felt, Seksjon, Terskel, VerktoyResultat
│   │   │   ├── beregn.ts          # beregn/byggResultat/synkVerktoySeksjon/kjorTestkasus
│   │   │   ├── sok.ts             # sokOppslag (rangert, synonymer/skrivefeil) + foreslaaOppslag (nøkkelord)
│   │   │   ├── synonymer.ts       # Synonymgrupper for søkefeltet (ikke for forslag)
│   │   │   ├── retningslinje.ts   # byggRetningslinjeResultat + ferskhetssjekk (dagerSidenVerifisert)
│   │   │   ├── formler.ts         # Navngitte formler for beregning.type «formel» (norrisk2, mdi)
│   │   │   ├── kalkulator.ts      # beregnKalkulator/byggKalkulatorResultat + erSynlig
│   │   │   ├── kalkulatorer.ts    # Navngitte kalkulatorer (svangerskap), all datoregning i UTC
│   │   │   ├── registry.ts        # INNEBYGDE_VERKTOY + finnVerktoy
│   │   │   ├── definisjoner/      # Én fil per verktøy (chadsvasc, qsofa, pevs, wells-*, madrs,
│   │   │   │                      #   mdi, klokketest, kne, skulder)
│   │   │   └── retningslinjer/    # Én fil per retningslinje (antibiotika)
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
Browser (chat-modal.tsx / ai-hjelp-view.tsx)
  ├─ useChat.sendMelding() → byggChatForesporsel(): CHAT_STAGING/AIHJELP_STAGING + kontekstfelt
  ├─ Vedlegg kun i første melding (uten oppgave-instruksjon), maks 20 meldinger historikk
  └─ strommFraClaude() direkte til Bedrock → tekst strømmes inn i chatten
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
- **Pasientinnhold skal aldri sendes til vår server.** Nye AI-funksjoner bygges i nettleseren med
  `ai-foresporsler.ts` + `bedrock-nettleser.ts`, ikke som API-ruter
- Bedrock API-nøkkel og Soniox API-nøkkel behandles som hemmelighet (aldri logg, aldri git)
- SSE-streaming for optimale ytelse og brukeropplevelse (real-time notatgenerering)
