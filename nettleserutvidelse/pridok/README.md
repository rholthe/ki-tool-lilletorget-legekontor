# LegeAssist → Pridok

Nettleserutvidelse (Chrome, Edge og Firefox, Manifest V3) som legger journalnotatet fra
LegeAssist inn i feltene **Anamnese (Notat)**, **Funn**, **Vurdering** og **Tiltak** i et
åpent notat i Pridok (`epj3.pridok.no`).

- Knappen «Send til journal» i konsultasjonsbildet vises bare når utvidelsen er installert.
- Utvidelsen finner alle åpne notater i alle Pridok-faner. Er det bare ett, fylles det direkte. Er det flere, velger legen i LegeAssist ut fra pasientens navn og fødselsdato (fra dokumenthodet i Pridok, `.document-subname`), dokumenttype og om feltene har tekst. Navnet holdes bare i minnet i nettleseren.
- Teksten går kun mellom fanene i nettleseren. Den er aldri innom LegeAssist-serveren, og utvidelsen lagrer ingenting.
- Utvidelsen **låser aldri** notatet. Pridok lagrer endringene automatisk; legen ser over teksten.
- Gul lapp røres aldri. Har feltene tekst fra før, spør LegeAssist om teksten skal legges til under eller erstatte den.
- Overskriftene i notatet (ANAMNESE, UNDERSØKELSE, VURDERING, TILTAK, eller de gamle SOAP-overskriftene) bestemmer hvilket felt teksten havner i. Kliniske verktøy og OCR havner i Tiltak. Uten overskrifter havner alt i Anamnese.

## Pasient og skjema (fra 1.2)

- **Pasient:** når legen starter en skjemaoppgave i LegeAssist, leser utvidelsen navn, fødselsdato,
  fødselsnummer og adresse for pasienten som er åpen i Pridok (`button.journalheader` og
  `.box-contextitem[title]` i journalhodet). Opplysningene går til LegeAssist-fanen, der de lagres
  kryptert i nettleseren sammen med oppgaven (slettes etter 24 timer). Utvidelsen lagrer ingenting.
- **Skjema:** «Send til skjema i Pridok» fyller et åpent skjema. Feltene kjennes igjen på teksten sin,
  som står i `.legend`, i feltets `placeholder`, i `.chktxt` på en avkrysningsknapp eller i
  `.tristate-caption` på et ja/nei-felt. LegeAssist
  sender tekstene den leter etter; utvidelsen kjenner ingen skjema selv. Element-id-ene i Pridok
  (`id="203"`) er løpende tellere og brukes ikke.
- **Avkrysning** finnes i to slag: `button.b-check` (av/på, `.fa-check` = på og `.fa-tag` = av) og
  `div.tristate` med knappene Ja (`.checkyes`) og Nei (`.checkno`). Tilstanden leses først, og det
  klikkes bare når den avviker. Avkrysning settes før tekst, fordi noen tekstfelt først vises når et
  ja/nei-felt er besvart.
- **Oppslagsfelt** (dato, poststed, ICPC-2B — `input.stretch` med nedtrekksknapp) hoppes over. De må
  velges fra Pridoks egen liste.
- **Import:** admin kan hente feltlisten (tekst, type, fane — aldri verdier) fra et åpent skjema.

## Filer

| Fil             | Kjører                             | Gjør                                                                                                               |
|-----------------|------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| `legeassist.js` | på ki.lilletorget.org og localhost | kunngjør utvidelsen, videresender forespørslene (dagsnotat, pasient, skjema)                                       |
| `bakgrunn.js`   | i bakgrunnen                       | `finn-notater`: spør alle Pridok-faner; `fyll-notat`: fyller valgt notat (sjekker at fanen er Pridok), viser fanen |
| `pridok.js`     | på epj3.pridok.no (alle rammer)    | finner notatene ut fra etikettene, grupperer per `<form id="docform…">`, beskriver og fyller dem                   |

Pridok er AngularJS. Feltene fylles ved å sette verdien og sende `input`/`change`, slik at
`ng-model` oppdateres. Hvert åpne dokument er et eget `<form id="docform<uuid>">` (venstre og
høyre side kan ha hvert sitt notat), og form-id-en identifiserer notatet. Endrer Pridok
etikettene eller markupen (`.legend` → `pddata` → `.fielddata textarea`, `.document-name`,
`.document-subname`), må `pridok.js` oppdateres.

LegeAssist krever minst versjon 1.1 (`MIN_VERSJON` i `send-til-journal.tsx`) og ber legen
oppdatere utvidelsen ellers.

## Installere

**Chrome/Edge (test):** `chrome://extensions` → slå på «Utviklermodus» → «Last inn
upakket» → velg denne mappen.

**Chrome/Edge (klinikk):** publiser som «Unlisted» i Chrome Web Store, eller rull ut via
policy (`ExtensionInstallForcelist`).

**Firefox (test):** `about:debugging#/runtime/this-firefox` → «Last inn midlertidig
tillegg» → velg `manifest.json`. Forsvinner ved omstart.

**Firefox (varig):** må signeres av Mozilla, også når den ikke skal i katalogen
(«unlisted»). Krever Firefox 140 eller nyere.

1. API-nøkler: https://addons.mozilla.org/developers/addon/api/key/ (JWT issuer + secret)
2. I denne mappen: `npx web-ext sign --channel=unlisted --api-key="<JWT issuer>" --api-secret="<JWT secret>"` (eller `WEB_EXT_API_KEY`/`WEB_EXT_API_SECRET` som miljøvariabler)
3. Signert `.xpi` havner i `web-ext-artifacts/` (gitignored). Installeres ved å dra filen inn i Firefox, eller `about:addons` → tannhjulet → «Installer tillegg fra fil»

Sjekk først med `npx web-ext lint` — eneste forventede advarsel er at Firefox ignorerer
`background.service_worker` (den er for Chrome; Firefox bruker `background.scripts`).

Øk `version` i `manifest.json` ved hver endring — Mozilla avviser en versjon som allerede er
signert. Versjon 1.0.0 ble signert 09.11.2026 (Ragnars AMO-konto); 1.1.0 (valg mellom flere
notater) er signert; 1.1.1 (gruppering per ytre `docform`) ble signert 10.11.2026. 1.2.0 (pasient og skjema)
er ikke signert ennå. Fra 1.2 leser utvidelsen personalia og gir dem til LegeAssist-siden; vurder om
`data_collection_permissions` i manifestet fortsatt skal være `none` før signering.

## Ikon

Kilden er `ikoner/ikon.svg`; PNG-ene (16, 32, 48, 96, 128) er laget fra den med `sharp` og ligger i
samme mappe. Endres SVG-en, må PNG-ene lages på nytt — Chrome godtar ikke SVG i manifestet.
