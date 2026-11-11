# Send til journal (Pridok-utvidelsen)

Detaljer flyttet fra `CLAUDE.md`. Gjelder `nettleserutvidelse/pridok/`, `send-til-journal.tsx`, `use-journal-utvidelse.ts` og `journal-eksport.ts`. Skjemadelen av utvidelsen står i `skjema.md`.

- **Send til journal (Pridok):** knapp ved siden av «Kopier notat» (`send-til-journal.tsx`), vises bare
  når nettleserutvidelsen `nettleserutvidelse/pridok/` er installert (`useJournalUtvidelse`, ping/klar via `postMessage`)
  - Utvidelsen finner alle åpne notater i alle Pridok-faner (`finn-notater`), gruppert per
    det ytre `<form id="docform…">` (`dokumentFor()`; ikke nærmeste `<form>` — i ekte Pridok kan AngularJS
    legge et navnløst skjema rundt hvert felt, og da ble ingen notater funnet; rettet i 1.1.1 etter test
    i Chrome 10.11.2026), med dokumenttype, pasientnavn og fødselsdato fra dokumenthodet
    (`.document-subname`, «Ragnar  Holthe, 14.10.75»). Ett notat → fylles direkte; flere → legen velger.
    Navnet holdes bare i minnet i nettleseren og sendes ikke til serveren
  - `delNotatIJournalfelt()` (`src/lib/journal-eksport.ts`) deler notatet på overskriftene (godtar også
    SOAP-overskrifter); alt etter TILTAK, også kliniske verktøy og OCR, går i Tiltak. Uten overskrifter → alt i Anamnese
  - `fyll-notat` (tabId + dokId, bakgrunnen sjekker at fanen er Pridok) fyller Anamnese (Notat)/Funn/Vurdering/Tiltak
    ut fra etikettene (`.legend` → `pddata` → `textarea`) og sender `input`/`change` så AngularJS sin
    `ng-model` oppdateres. Gul lapp og låste notater røres ikke; har feltene tekst, spør appen om
    «Legg til under» eller «Erstatt». Låser aldri notatet; Pridok autolagrer, legen ser over
  - Teksten går bare mellom fanene i nettleseren, aldri via serveren
  - Meldingen etter sending forsvinner av seg selv (5 s ved suksess, 8 s ved feil/info), men står så lenge
    musepekeren er over den
  - Ufullstendige notater (ikke alle fire felt funnet) logges med `console.debug` i Pridok-fanen — kun
    dokId og antall felt, aldri innhold
  - Testet 09.11.2026 i Chromium mot en kopi av Pridok-markupen med AngularJS 1.8 (Playwright,
    `--load-extension`), også to faner med til sammen tre dagsnotater. Mot ekte Pridok: Firefox 09.11 (1.1.0),
    Chrome 10.11 (krevde 1.1.1)
  - Appen krever utvidelse ≥ 1.1 (`MIN_VERSJON`) og ber om oppdatering ellers
  - Firefox: 1.0.0 og 1.1.0 signert «unlisted» hos Mozilla 09.11.2026, 1.1.1 signert 10.11.2026 (`web-ext sign`, krever Firefox 140+).
    Øk `version` i `manifest.json` før ny signering; fremgangsmåte i utvidelsens README
