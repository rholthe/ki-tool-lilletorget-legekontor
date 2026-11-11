# Mappestruktur

Flyttet fra `CLAUDE.md`. Oversikten vedlikeholdes ikke fortløpende — stol på koden når de er uenige.

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
├── nettleserutvidelse/pridok/      # Chrome/Firefox-utvidelse: «Send til journal» → Pridok (se README der)
├── scripts/
│   ├── verktoy-selvtest.mjs       # npm run verktoy:test — referansekasus, terskler, notat-synk, søk, antibiotika mot fasit
│   ├── retningslinjer-reserve.mjs # npm run retningslinjer:reserve — henter fra HAPI, skriver reservekopi
│   └── fasit/                     # Manuelt verifiserte antibiotikadoser (kontroll av oversettingen)
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
│   │   │       ├── meldinger/     # Adminside: publiser meldinger, se hvem som har lest
│   │   │       ├── skjema/        # Adminside: kategorier, skjema, feltlister (import fra Pridok)
│   │   │       └── retningslinjer/ # Adminside: HAPI-status, «Hent alt nå», utvalg av retningslinjer
│   │   ├── api/
│   │   │   ├── auth/              # NextAuth
│   │   │   ├── soniox-token/      # Genererer temp-tokens for Soniox
│   │   │   ├── ai/oppsett/        # Kortlivede AWS-nøkler + modell/region/prompt-overrides til nettleseren
│   │   │   ├── bruk/              # Tar imot forbrukstall (POST), regner kostnad
│   │   │   ├── skjema/            # Aktive skjema per kategori (definisjoner, ingen pasientdata) + [id]/pdf (malen)
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
│   │   ├── passkey.ts             # Passkeys: start innlogging, legg til (krever TOTP), slett
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
│   │   │   ├── skjema-view.tsx            # Skjema: pasient, velg skjema, kontekst, AI-utfylling, send til Pridok
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
│   │   ├── passord-token.ts      # Engangstoken for passordoppsett/tilbakestilling (SHA-256-hash, gyldighet per bruk)
│   │   ├── passord-epost.ts      # E-post: lenke for nytt passord, varsel om endret passord
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
│   │   ├── gjenoppretting.ts      # Gjenopprettingskoder: lagNyeKoder, brukKode (HMAC, engangs)
│   │   ├── passkey.ts             # WebAuthn (SimpleWebAuthn): valg, verifisering, engangsutfordringer
│   │   ├── to-faktor-varsel.ts    # E-post ved brukt gjenopprettingskode og nullstilt 2FA
│   │   ├── aktivitet.ts           # registrerAktivitet() — signal til OktVakt (f.eks. under opptak)
│   │   ├── meldinger-forslag.ts   # Forhåndsutfylt sikkerhetsmelding i admin-skjemaet
│   │   ├── staging.ts             # Grunntekster + TYPE_STAGING + CHAT/AIHJELP/PROMPTBYGGER_STAGING + felles seksjoner
│   │   ├── staging-registry.ts    # STAGING_REGISTRY: overstyrbare staging-tekster (fil-standard)
│   │   ├── staging-server.ts      # Server-resolver: DB-override + fil-fallback, bygger system prompt
│   │   ├── tema.ts                # TYPE_TEMA (fargetema) + TYPE_IKON_KOMP (ikon per type)
│   │   ├── hapi/                  # Helsedirektoratets API: hent.ts (ren), retningslinjer-server.ts
│   │   ├── skjema/                # Skjemautfylling: typer.ts, ai.ts (verktøykall), fnr.ts, pdf.ts (pdf-lib), skjema-server.ts
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
│   │   │   └── retningslinjer/    # antibiotika-hapi.ts (oversetting), -tillegg.ts, -reserve.json
│   │   ├── pdf-tekst.ts           # Tekstuttrekk fra PDF i nettleseren (pdf.js) — PDF i kontekst blir tekst
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
