# Skjema (oppgavetypen SKJEMA)

Detaljer flyttet fra `CLAUDE.md`. Gjelder `src/lib/skjema/`, `skjema-view.tsx`, `til-skjema.tsx`, `/admin/skjema` og PDF-sporet.

- **Skjema** (oppgavetype `SKJEMA`, rosa `FileText`-ikon, `Alt+6`): hjelp til skjemautfylling. Trinn 1–2 bygget
  10.11.2026, **ikke deployet og ikke testet mot ekte Pridok** (tabellene finnes ikke før `prisma db push`)
  - Admin legger inn kategorier og skjema på `/admin/skjema` (`SkjemaKategori`, `Skjema`; `actions/admin-skjema.ts`).
    Et skjema = feltliste (JSON, `SkjemaFelt` i `src/lib/skjema/typer.ts`) + instruks til AI. Bare definisjonen
    ligger på serveren; utfylte verdier finnes kun i nettleseren (`Konsultasjon.skjema`/`skjemaVerdier`/`pasient`,
    kryptert i IndexedDB). `Konsultasjon.skjema` er et øyeblikksbilde, så oppgaven tåler at admin endrer skjemaet
  - Hvert felt har en **kilde**: `ai`, `manuell`, `pasient.*` eller `dato.idag`. `pasient.fornavn`/`pasient.etternavn`
    deler det fulle navnet (`delNavn`: etternavn = siste navn, fornavn = resten). Personalia og dato settes av
    koden (`fyllFraKilder`), aldri av Claude, og sendes ikke til Bedrock
  - **Lege:** `lege.navn`/`lege.fornavn`/`lege.etternavn`/`lege.hpr` hentes fra brukerkontoen (`User.name`,
    `User.hprNummer`, 7–9 siffer). Legen legger dem inn under Innstillinger → Profil (`actions/profil.ts`,
    `profil-seksjon.tsx`); `/api/skjema` leverer dem sammen med skjemalisten. Mangler de, får legen et hint i
    skjemaet, og tomme legefelt fylles når opplysningene finnes. Øktens navn (brukermenyen) oppdateres først
    ved neste innlogging
  - **Pasient:** ved ny oppgave spør `SkjemaView` utvidelsen (`hent-pasient`) om hvem som er åpen i Pridok — navn,
    fødselsdato, fødselsnummer og adresse fra journalhodet (`button.journalheader` + `.box-contextitem[title]`).
    Én → fylles inn, flere → legen velger, ingen/ingen utvidelse → skrives inn. Fødselsnummer kontrolleres med
    modulus 11 (`src/lib/skjema/fnr.ts`)
  - **AI-utfylling:** `byggSkjemaForesporsel` (`src/lib/skjema/ai.ts`) tvinger svaret gjennom verktøykallet
    `fyll_skjema` med én egenskap per AI-felt (`hentStrukturertSvar` i `bedrock-nettleser.ts`, ikke strømmet).
    Systemprompt = staging `skjema` (felles) + skjemaets instruks. Felt uten grunnlag i konteksten skal stå tomme.
    Felt legen har skrevet i selv, overskrives ikke ved ny utfylling; AI-forslag er merket til legen endrer dem
  - **Send til skjema i Pridok** (utvidelse ≥ 1.2, `stotterSkjema`): feltene kjennes igjen på teksten sin
    (`SkjemaFelt.pridokTekst`), som i Pridok står i `.legend`, i `placeholder`, i `.chktxt` eller i `.tristate-caption`. Element-id-ene
    der er løpende tellere og brukes ikke. `finn-skjema` → velg dokument → `fyll-skjema`; samme
    «Legg til under»/«Erstatt» som for dagsnotat, og advarsel hvis dokumentet i Pridok gjelder en annen pasient
    - Hvilke felt et skjema har, står i skjemadefinisjonen, ikke i utvidelsen — nye Pridok-skjema krever ikke ny signering
    - **Avkrysning** finnes i to slag i Pridok, begge er `avkrysning` hos oss: `button.b-check` (av/på;
      `.chkbx .fa-check` = på, `.fa-tag` = av) og `div.tristate` med knappene Ja (`.checkyes`) og Nei (`.checkno`).
      Tilstanden leses først, og det klikkes bare når den avviker. Avkrysning settes før tekst, fordi noen
      tekstfelt først vises når et ja/nei-felt er besvart
    - **Oppslagsfelt hoppes over** (dato, poststed, ICPC-2B: `input.stretch` uten `type`, med nedtrekksknapp).
      De må velges fra Pridoks egen liste; legen fyller dem selv
    - «Importer fra Pridok» i admin (`les-skjema`): leser tekst, type og fane for feltene i et åpent skjema
      (aldri verdier) og lager feltlisten
  - **AI-hjelp til oppsettet** (admin, «Lag forslag»): `byggOppsettForesporsel` sender skjemaets navn og
    feltliste (aldri pasientdata) og får tilbake instruks for skjemaet, tydeligere feltnavn, kilde og instruks
    per felt (`SKJEMAOPPSETT_STAGING`, verktøykall `foresla_oppsett`, logges som `promptbygger`). Det som alt er
    skrevet, beholdes med mindre «Erstatt» er krysset av; «Angre AI-forslag» setter utkastet tilbake
  - Bruksstatistikk: funksjon `skjema`
  - Utvidelsen testet 10.11.2026 i Chromium (Playwright, `--load-extension`) mot en kopi av markupen for
    journalhodet, SPK-fanen «Om uførheten» og NAV-skjemaet «Legeerklæring ved arbeidsuførhet» (avkrysset
    tilstand, ja/nei-felt, skjulte felt, oppslagsfelt, to felt med samme tekst)
  - **PDF-sporet** (bygget 11.11.2026, **ikke prøvd i nettleser** — krever `prisma db push` for tabellen `SkjemaPdf`):
    admin laster opp det tomme skjemaet som PDF-mal, legen får «Last ned PDF» med feltene fylt inn
    - Malen ligger i egen tabell `SkjemaPdf` (LongBlob, maks 10 MB) så den ikke følger med skjemalisten.
      Opplasting `PUT /api/admin/skjema/[id]/pdf` (rå fil i kroppen — for stor for en server action), henting
      `GET /api/skjema/[id]/pdf` (innlogget). Malen er et tomt skjema, aldri pasientdata
    - **Utfyllingen skjer i nettleseren** med `pdf-lib` (`src/lib/skjema/pdf.ts`: `lesPdfMal`, `fyllPdf`). Den
      utfylte PDF-en er aldri innom serveren. Filnavnet er skjemanavn + dato, bevisst uten pasientnavn
    - To slags maler, og et skjema kan blande dem (`SkjemaFelt.pdf`/`pdfNei`: `PdfMaal` = `felt`, `valg`, `boks`):
      - **Utfyllbare PDF-er (AcroForm):** feltet kobles til PDF-feltets navn. Avkrysning: avkrysningsboks, eller
        et alternativ i en radiogruppe (`valg`); `pdfNei` er ruten for «Nei». «Lag feltlisten fra PDF-en» leser
        feltene i leserekkefølge (hjelpeteksten `TU` som etikett; ja/nei-radiogrupper blir én avkrysning)
      - **Flate PDF-er:** admin tegner bokser på siden (`pdf-plassering.tsx`, pdf.js-visning). Boksene er
        brøkdeler av sidens CropBox fra øvre venstre hjørne. Avkrysning tegnes som et kryss. Roterte sider
        støttes ikke (admin får advarsel)
    - **Begrenset plass** (PDF-felt utvider seg aldri; dynamisk XFA fjernes av pdf-lib):
      - `SkjemaFelt.maksTegn` = omtrent hvor mange tegn det er plass til, regnet ut fra feltets/boksens størrelse
        i 9 punkt (`plassITegn`/`plassForMaal`; snittbredde 0,5 × skriftstørrelsen, bevisst forsiktig). Settes
        når feltet kobles eller boksen tegnes, «Regn ut plass» gjør det for alle, og admin kan rette tallet
      - Claude får grensen i feltbeskrivelsen («høyst N tegn»), og legen ser en teller under feltet
      - Ved utfylling (`tilpass`): 9 punkt (eller feltets egen størrelse når den er mindre), krymper i halve
        punkt ned til 7 — også i utfyllbare felt, der skriftstørrelsen overstyres. Felt med én rute per tegn
        (comb, f.eks. fødselsnummer) røres ikke
      - Får teksten fortsatt ikke plass: feltet får begynnelsen + «(forts. eget ark)», og **hele** teksten
        legges på et fortsettelsesark bakerst (A4, feltets etikett som overskrift, skjemanavn og pasient øverst).
        Legen får beskjed om hvilke felt det gjelder. Ingenting kuttes i stillhet
      - **Egne felt på fortsettelsesarket** (`PdfMaal.ark`, valget «På fortsettelsesarket» i nedtrekket for
        PDF-felt): et vanlig tekstfelt med egen AI-instruks (f.eks. «List alle sykmeldingsperioder med
        diagnoser») som ikke har plass i selve skjemaet. Teksten settes på arket under feltets etikett, etter
        tekstene som ikke fikk plass. Ingen tegngrense. Legen ser og retter feltet som alle andre
    - Feltene «flates» ikke — legen kan rette i PDF-leseren. Standardskriften (Helvetica) har bare WinAnsi:
      «≥», «→» o.l. byttes ut (`lagRens`), ukjente tegn blir «?», ellers ville hele utfyllingen stoppet
    - Skriftstørrelsen settes alltid eksplisitt: med automatisk størrelse («0 Tf») blåser pdf-lib kort tekst
      opp til å fylle hele feltet
    - `SkjemaDefinisjon.pdf` (`filnavn`, `versjon` = `updatedAt`) følger øyeblikksbildet i oppgaven. Har admin
      byttet mal i mellomtiden (`X-Pdf-Versjon` avviker), får legen beskjed om å se nøye over eller bytte skjema
    - Admin: «Last ned prøve» fyller malen med feltenes egne tekster, så plasseringen kan kontrolleres
    - Testet i Node mot en generert PDF (tekstfelt, makslengde, radiogruppe, bokser, æøå; tekst på grensen,
      35 % over og tre ganger for lang).
      Ikke testet mot ekte NAV-/forsikringsskjema — de kan være XFA-hybrider eller låste (låste avvises)
  - **Start fra konsultasjon** (`til-skjema.tsx`, knappen «Skjema» i konsultasjonsbildet): legen velger hva som
    tas med (notat, kontekst, tilleggsinfo og vedlegg på; transkript av), og det **kopieres** inn i konteksten
    til en ny skjemaoppgave under overskrifter (`byggSkjemaKontekst`). Skjema velges etterpå, i skjemavisningen —
    ingen AI-forespørsel går før legen har sett konteksten. Kopi, ikke kobling: skjemaet tåler at konsultasjonen
    slettes. `Konsultasjon.fraKonsultasjon` gir lenken «Fra konsultasjon kl. …» tilbake. OCR-vedlegg tas ikke
    med som fil (teksten står i notatet). Knappen er av under opptak og notatgenerering. Bare for
    konsultasjoner (`konsultasjon-view.tsx` brukes også av Møte, som ikke har knappen); heller ikke Diktat og
    Journalgjennomgang
