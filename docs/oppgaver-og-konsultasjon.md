# Konsultasjon og øvrige oppgavetyper

Detaljer flyttet fra `CLAUDE.md`: opptak og notat, chat, vedlegg og OCR, promptbibliotek og staging, stikkord, diktat, journalgjennomgang, AI-hjelp, hurtigtaster og diktering i tekstfelt.

## Funksjoner

- Mikrofonfangst i nettleser (Web Audio API) + skjermdeling for videomøter (NAV)
- Sanntidstranskribering med Soniox, pause/fortsett opptak
  - SDK `@soniox/client`, felles oppsett i `src/lib/soniox-opptak.ts` (`startSonioxOpptak`). Nøkkelen
    sendes som subprotokoll. Lyden er som med den gamle SDK-en: valgt mikrofon gir bare `deviceId`
    (nettleserens ekkodemping/støyreduksjon på), ingen valgt gir alt av og 44,1 kHz mono; 120 ms biter
  - Video/skjermdeling: SDK-ens `MicrophoneSource` tar ikke en ferdig strøm, så `StromKilde` (samme fil)
    kjører `MediaRecorder` på en klone av strømmen
  - Pause er `cancel()` og fortsett er en ny tilkobling med ny nøkkel (ikke SDK-ens `pause()`), så samme
    vei virker etter bytte av konsultasjon
  - Video (konsultasjon og Møte): den delte fanen beholdes over pause, så Fortsett bruker samme fanelyd
    uten ny dialog. Er delingen stoppet («Stopp deling»), spørres det på nytt. Fortsett fra lagret
    pause og «Fortsett opptak» etter stopp spør alltid på nytt (kan være et annet møte). Stopp slipper fanen
- Autolagring av transkript hvert 10 sek under opptak + lagring ved pause
- Alle "fortsett"-knapper pre-laster eksisterende transkript (ingen appendModus)
- Notatgenerering via Claude (SSE-streaming), auto-start etter stopp. Konsultasjonsnotatene har
  overskriftene ANAMNESE, UNDERSØKELSE, VURDERING og TILTAK (tidligere SOAP), som i Pridok
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
  - **PDF i kontekst leses som tekst** (AI-hjelp og Skjema, `VedleggPanel` med `kontekst`/`onKontekst`): PDF-er med
    tekstlag trekkes ut i nettleseren (`src/lib/pdf-tekst.ts`, pdf.js) og legges i kontekstfeltet mellom
    `--- filnavn (N sider) ---` og `--- slutt filnavn ---` i stedet for å sendes som fil — billigere, ingen
    sidegrense, og legen ser hva som sendes. Under 200 tegn per side i snitt = skannet → vedlegg som før, med
    beskjed. «Send som PDF i stedet» tar teksten ut igjen (for tabeller, bilder, kurver). Tekst-PDF-er kan være
    opptil 50 MB; vedlegg fortsatt 8 MB. Avviste filer gir nå en melding i stedet for å forsvinne stille
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
  - Sidebar (`app-sidebar.tsx`): `Alt+1..6` oppretter ny oppgave i samme rekkefølge som
    `NY_KNAPPER` (1 Konsultasjon, 2 Møte, 3 Diktat, 4 Journalgjennomgang, 5 AI-hjelp, 6 Skjema);
    knappene viser et `Alt+N`-merke
  - Opptak (kontekstavhengig, i `konsultasjon-view.tsx` og `diktat-view.tsx`):
    - `Alt+R` veksler ut fra tilstand: stoppet/ny → Start, opptar → Pause, pause → Fortsett,
      lagret pause → Fortsett, ferdig → Fortsett opptak, kobler → ignoreres
    - `Alt+S` = Stopp & Send (genererer notat); egen tast siden den committer/trigger AI
    - `Alt+V` = åpne/lukke Kliniske verktøy (kun `konsultasjon-view.tsx`)
    - Hooken er montert per view (kun ett vises via `HovedInnhold`); knapper har `title`-hint
- Diktering i tekstbokser: gjenbrukbart mikrofonikon for live transkribering rett inn i et tekstfelt
  - Komponent `DikteringKnapp` (`src/components/app/diktering-knapp.tsx`) + hook `useDiktering` (`src/hooks/use-diktering.ts`)
  - Kun sanntidstranskript via Soniox (`stt-rt-v6`, norsk) — ingen AI-behandling, ingen video/skjermdeling
  - Markør i feltet → tekst settes inn ved `selectionStart`; ellers legges til på slutten (mellomrom mot eksisterende tekst)
  - Foreløpige (non-final) tokens vises umiddelbart og erstattes når de blir endelige (lav latency)
  - Soniox-spesialtokens (`<end>` o.l.) filtreres bort; knappen bruker `onMouseDown` `preventDefault` for å bevare markørfokus
  - Standard innfelling: wrap `<Textarea>` i `relative`-div, gi feltet `pr-10` + `ref`, plasser knappen `absolute bottom-1.5 right-1.5`
  - I bruk: AI-hjelp-input, konsultasjons-chat (`chat-modal.tsx`), Fokusspørsmål i Journalgjennomgang

## Notatmaler og stikkord

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

## Chat / AI-hjelp

Multi-turn chat tilgjengelig fra konsultasjonsvisningen via `ChatModal`.

```
Browser (chat-modal.tsx / ai-hjelp-view.tsx)
  ├─ useChat.sendMelding() → byggChatForesporsel(): CHAT_STAGING/AIHJELP_STAGING + kontekstfelt
  ├─ Vedlegg kun i første melding (uten oppgave-instruksjon), maks 20 meldinger historikk
  └─ strommFraClaude() direkte til Bedrock → tekst strømmes inn i chatten
```

**Historikk:** Lagres i `konsultasjon.chatHistorikk` (IndexedDB, 24t TTL). Overlever lukking av modal og sideoppdatering. `chatKontekstSnapshot` brukes til å detektere endringer og vise markørlinjer i chatvinduet.
