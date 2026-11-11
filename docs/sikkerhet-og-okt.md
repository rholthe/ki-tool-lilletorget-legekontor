# Sikkerhet: to-faktor, passkeys, økt og kryptering

Detaljer flyttet fra `CLAUDE.md`. Gjelder innlogging, `src/lib/okt.ts`, `datakrypto.ts`, `idb.ts`, `passkey.ts`, `gjenoppretting.ts` og `to-faktor-krav.ts`.

- 2FA (TOTP), admin-side for Bedrock-konfigurasjon (modell/region/tilkoblingstest)
  - **Gjenopprettingskoder** (`src/lib/gjenoppretting.ts`, tabell `Gjenopprettingskode`): ti engangskoder
    (`XXXXX-XXXXX`, alfabet uten 0/O/1/I/L/U/V, ~49 bit) lages når 2FA aktiveres og vises én gang
    (kopier/last ned, dialogen lukkes først etter «Jeg har lagret kodene»). Lagres som HMAC-SHA256 med
    `TOTP_ENCRYPTION_KEY`, ikke ren hash. Innloggingen godtar en kode i stedet for TOTP («Har du ikke
    telefonen?»); bruken er atomisk (`updateMany … bruktAt: null`) og brukeren får e-post
    (`to-faktor-varsel.ts`). Innstillinger viser antall ubrukte og «Lag nye koder» (krever gyldig TOTP).
    Valgt framfor et felles superpassord i `.env`: per bruker, engangs, kan byttes, og bruk varsles
  - **Admin nullstiller 2FA** på `/admin/brukere` («Nullstill 2FA», også for seg selv): sletter hemmelighet,
    koder og passkeys, e-post til brukeren, logglinje uten innhold. Når 2FA er obligatorisk, sender
    `(app)/layout.tsx` brukeren til `/sikre-kontoen` ved neste forespørsel (leser DB hver gang)
  - **Passkeys** (`src/lib/passkey.ts`, `actions/passkey.ts`, tabeller `Passkey` + `PasskeyUtfordring`):
    innlogging uten passord og engangskode. SimpleWebAuthn (v14) som egen Credentials-provider
    `"passkey"` i `auth.ts` — ikke Auth.js' eksperimentelle WebAuthn-provider — så øktregler, DPA-sperre
    og 2FA-krav gjelder uendret. `package.json` har `overrides` fordi next-auth/@auth/core har en
    valgfri peer-avhengighet til SimpleWebAuthn v9
    - `userVerification: "required"` (biometri/PIN): én passkey er fullverdig tofaktor
    - `residentKey: "required"`: innlogging uten å oppgi e-post, så innloggingssiden avslører aldri om en
      adresse har konto. Knapp «Logg inn med passkey» + autoutfylling i e-postfeltet (`username webauthn`)
    - Alle typer godtas (Windows Hello, Bitwarden, iCloud/Google, YubiKey FIDO2), ingen attestasjon.
      Listen i Innstillinger viser «Synkronisert» / «Kun denne enheten» (`flerEnhet`)
    - Legges til under Innstillinger → Sikkerhet; krever aktiv TOTP og en gyldig kode. E-postvarsel ved ny passkey
    - Slettes når TOTP slås av eller admin nullstiller 2FA. «Glemt passord» rører dem ikke
    - Utfordringer (challenge) er engangs i DB (5 min registrering, 15 min innlogging), maks 200 per IP i timen
    - rpID/origin fra `APP_URL`: passkeys fra prod virker ikke mot localhost
    - Testet ende til ende med Chromes virtuelle autentikator (CDP `WebAuthn.addVirtualAuthenticator`, playwright-core)
    - Deployet 15.10.2026. Ikke testet med ekte Bitwarden/YubiKey eller autoutfylling i e-postfeltet (headless
      Chrome støtter det ikke) — prøv det i prod
  - 2FA-påminnelse: diskret kort nederst til høyre for brukere uten 2FA, maks ~1 gang/mnd
    (`to-faktor-paaminnelse.tsx`, husker i localStorage `legeassist:2fa-paaminnelse-sist`)
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
