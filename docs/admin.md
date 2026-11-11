# Brukere, databehandleravtale, meldinger og bruksstatistikk

Detaljer flyttet fra `CLAUDE.md`. Gjelder `/admin/brukere`, invitasjon og glemt passord, DPA, meldinger fra admin og `/admin/bruk`.

- Brukeradministrasjon (kun admin): selvregistrering er deaktivert
  - `/admin/brukere`: admin oppretter bruker (navn + e-post, ikke passord). Kontoen er låst
    (`passwordHash = null`) til brukeren selv setter passord via invitasjonslenke
  - Invitasjon sendes på e-post med engangslenke → `/sett-passord?token=...` (gyldig 7 dager)
    - Token i `PasswordSetupToken` (SHA-256-hash lagret, klartekst kun i e-postlenken)
    - Brukerliste viser status «Venter på passord»/«Aktiv» + «Send invitasjon på nytt»
  - Tilgangsforespørsel: offentlig skjema `/tilgang` (navn/e-post/arbeidssted) → e-post til
    `ACCESS_REQUEST_TO`; lenket fra login («Kontakt en administrator»)
  - E-post via SMTP (`src/lib/mail.ts`, nodemailer) fra mailcow-postboksen `legeassist@lilletorget.org`
    (port 587/STARTTLS; postboksen har `smtp_access=1`, `force_pw_update=0` og egen ProISP-relay)
  - **Glemt passord** (`/glemt-passord`, `bePassordlenke` i `actions/tilgang.ts`): lenke på e-post, gyldig
    1 time, engangs (samme `PasswordSetupToken` som invitasjonen; `lagPassordOppsettToken(userId, gyldigMs)`).
    Svarer alltid «Hvis adressen har en konto …» og sender i bakgrunnen, så verken svar eller svartid
    avslører kontoer. Maks 3 per e-post og 10 per IP per time (i minnet). **Lenken bytter bare passordet —
    to-faktor står urørt**, så overtatt e-post alene gir ikke tilgang. `/sett-passord` ser selv om det er
    tilbakestilling (`harPassord`): da ingen ny DPA-signering, og e-post «passordet ditt er endret» etterpå
  - Admin: «Nytt passord» på `/admin/brukere` for aktive brukere (`sendPassordlenkeTilBruker`, lenke gyldig
    24 t) — reserven når brukeren ikke får det til selv
  - Offentlige ruter i `proxy.ts`: `/login`, `/tilgang`, `/sett-passord`, `/glemt-passord`, `/databehandleravtale`, `/api/auth`
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
- Bruksstatistikk (`Bruk`-tabellen, `/admin/bruk`, «Bruk og kostnader» i adminmenyen)
  - Én rad per Claude-kall (`funksjon`: notat, chat, aihjelp, promptbygger) og per
    Soniox-økt (transkribering, diktering). Kun tall: tokens fra Bedrocks egne invocation-metrics,
    `total_audio_proc_ms` fra Soniox, antall tegn. Rapporteres av nettleseren (`rapporterForbruk`,
    `soniox-maaler.ts`, `keepalive`) til `/api/bruk`, som validerer (zod, øvre grenser) og regner kostnad
  - Priser i SystemSetting `bruk_priser` (`src/lib/bruk-priser.ts`), redigeres på admin-siden; kostnad
    lagres per rad, så prisendringer ikke endrer historikk. Standard: Sonnet 4.6 EU $3,30/$16,50 per MTok,
    Soniox $0,12/t, kurs 10,5 NOK
  - Månedsvisning per bruker + per funksjon på siden. CSV (`/api/admin/bruk/csv?mnd=YYYY-MM`, semikolon,
    norsk komma) er detaljert: én linje per bruker per dag med aktivitet (`hentDagsstatistikk`, dato i
    norsk tid, summert i Node fordi MariaDB mangler tidssonetabeller). Summen av linjene = månedstallene
  - Ingen fremmednøkkel: statistikken består etter at en bruker slettes
  - Tallene kommer fra klienten og kan i teorien manipuleres; kryssjekk mot CloudTrail (`la-<userId>`),
    Soniox (`client_reference_id`) og fakturaene
