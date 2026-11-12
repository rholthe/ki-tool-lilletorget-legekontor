# Legge inn et nytt skjema (instruks til Claude)

Brukes når Ragnar ber om å få lagt inn et skjema med feltliste, mapping og prompt, i stedet for å
gjøre det for hånd på `/admin/skjema`. Første gang: SPK S030, 12.11.2026. Les også `docs/skjema.md`.

**Databasen er den samme i dev og prod.** Skjemaet legges inn som inaktivt, og Ragnar aktiverer det
selv etter å ha sett over. Skriptet oppdaterer aldri et skjema som finnes fra før — endringer gjøres i admin.

## Det du trenger fra Ragnar

- PDF-en (det tomme skjemaet), hvis skjemaet skal kunne lastes ned utfylt
- HTML-en for skjemaet i Pridok (høyreklikk → kopier ytre HTML på dokumentet), hvis det skal sendes dit
- At DB-tunnelen er oppe (`KEY=~/.ssh/id_ed25519 bash db-tunnel.sh`)

## Fremgangsmåte

1. **Les PDF-en.** `pdftotext -layout <fil>` for spørsmålene og hjelpetekstene, og
   `node scripts/skjema/les-pdf.mjs <fil>` for de utfyllbare feltene (navn, type, ruter, plass i tegn).
   Har PDF-en ingen utfyllbare felt, må Ragnar tegne bokser i admin etterpå («Plasser felt på siden»).
2. **Les Pridok-HTML-en.** Hvert felt kjennes igjen på teksten sin, som blir `pridokTekst`:
   `.legend` (når den ikke er `&nbsp;`), `placeholder`, `.chktxt` eller `.tristate-caption`. Kopier teksten
   **nøyaktig**, med Pridoks egne skrivefeil og tegn («en ulykkestilfelle», semikolon til slutt). Bare et
   kolon til slutt og mellomrom normaliseres bort.
   - Felt Pridok fyller selv (fanen er `ng-hide`, typisk personopplysninger) og oppslagsfelt
     (`input.stretch` med nedtrekksknapp: dato, poststed, ICPC) får **ikke** `pridokTekst`
   - Flere felt med samme tekst er greit; rekkefølgen i feltlisten avgjør hvilket som er hvilket
3. **Se på et skjema som ligger inne** for stil på prompt og instrukser (KLP og SPK i «Pensjon og
   forsikring»). Les fra databasen, ikke fra hukommelsen.
4. **Skriv definisjonen** i `scripts/skjema/definisjoner/<navn>.mjs` (kopier `spk-uforepensjon.mjs`).
   Den eksporterer `kategori`, `navn`, `beskrivelse`, `prompt` og `felter`.
5. **Kontroller og se på prøven:** `node scripts/skjema/legg-inn.mjs <definisjon> <pdf>`. Skriptet stopper
   på ukjente PDF-felt, manglende `valg` og ugyldige kilder, og lager en prøve-PDF. **Åpne sidene som
   bilder og se at hvert kryss står i riktig rute** (`pdftoppm -r 70 -png …`, så Read). Prøven krysser
   annenhver avkrysning ja/nei og skriver ut hvilken som er hva.
6. **Legg inn:** samme kommando med `--skriv`. Si til Ragnar at skjemaet er inaktivt.
7. Måtte koden endres for at PDF-en skulle bli riktig, skal skjemaet stå inaktivt til rettelsen er deployet.

## Valg per felt

- **Rekkefølge og seksjon:** som i PDF-en/Pridok. `seksjon` = overskriften feltet står under
- **Etikett:** spørsmålet slik legen forstår det alene. «Hvis ja …»-felt får med hva de hører til
  («Hvis ja (ulykke), hvordan skjedde ulykken?»)
- **Type:** `tekst` for én linje, `flerlinje` for avsnitt, `avkrysning` for ja/nei. Er feltet én linje i
  Pridok (`<input>`), bruk `tekst` selv om PDF-feltet har flere linjer
- **Kilde:**
  - `pasient.*`, `lege.*`, `dato.idag` for personalia og dato — aldri AI
  - `ai` for alt som kan besvares ut fra kliniske opplysninger, også ja/nei som framgår av journalen
  - `manuell` for det bare legen kan svare på: bekreftelser, hva søkeren ikke bør få vite, samtykker
- **Instruks** (bare `ai`): hva som hører hjemme i feltet, omfang («tre til fem setninger») og format
  (dato som dd.mm.åååå). For avkrysning: når ja, når nei, når ubesvart. For «Hvis ja»-felt: «ellers tomt»
- **PDF-mål:** `pdf: { felt }` for tekst. Avkrysning med egen rute for ja og nei:
  `pdf: { felt, valg: "Ja" }` og `pdfNei: { felt, valg: "Nei" }`. **Har PDF-feltet typen `radio` i
  `les-pdf`, må `valg` alltid med** — også når det egentlig er én avkrysningsboks med to ruter (SPK)
- **`maksTegn`:** tallet `les-pdf` regner ut («plass»). Ikke gjett
- **Fortsettelsesark:** når en rubrikk er for liten for det skjemaet faktisk spør om (sykmeldingsperioder),
  lag et eget felt med `pdf: { ark: true }` og egen instruks, og la rubrikken i skjemaet få en kort
  sammenfatning. Ragnar vil ha sykmeldingsperioder på arket
- **Ulik type i PDF og Pridok** (SPK S031: avkrysning i PDF-en, fritekst i Pridok): lag to felt, ett per
  mål, og be i instruksen om samme konklusjon i begge. Merk etikettene «(avkrysning i PDF-en)»/«(tekst til Pridok)»
- **Legens egne betalingsopplysninger** (fanen «Legefaktura» i Pridok: kontonummer, adresse) tas ikke med
- **Underskrift:** kobles ikke, heller ikke til legens navn. Feltet skal signeres for hånd

## Prompten

Tre til fem korte avsnitt i sammenhengende tekst: hvem mottakeren er og hva erklæringen brukes til, hva
som skal vektlegges (funksjon og arbeidsevne framfor diagnose), særtrekk ved akkurat dette skjemaet
(hentet fra skjemaets egen tekst, f.eks. SPKs «ingen minimumsgrense på 50 prosent»), og hva som skal
unngås. Skriv ikke regelverk du ikke har fra skjemaet eller fra Ragnar.

## Etterpå

Fortell Ragnar hvilke felt som bare går til PDF, hvilke PDF-felt som ikke er koblet og hvorfor, hvilke
valg han bør se over, og at sendingen til Pridok ikke er prøvd før han har gjort det selv.
