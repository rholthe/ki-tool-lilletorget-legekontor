# Retningslinjer og pakkeforløp fra Helsedirektoratet (HAPI)

Detaljer flyttet fra `CLAUDE.md`. En del av Kliniske verktøy (se `kliniske-verktoy.md`). Gjelder `src/lib/hapi/`, `src/lib/verktoy/retningslinjer/` og `/admin/retningslinjer`.

  - **Retningslinjer** (`kategori: "retningslinje"`) er en egen datatype, ikke et verktøy uten
    poeng. Legen fyller ikke ut noe — hun slår opp. `Retningslinje` → `Tilstand` → `Anbefaling`
    (`src/lib/verktoy/typer.ts`), og `Oppslag = Verktoy | Retningslinje` deler modal, søk og
    notat-innsetting
    - **Hentes fra Helsedirektoratets API (HAPI)**, ikke skrevet av oss. Antibiotika i
      primærhelsetjenesten: alle 63 tilstander (11 kapitler) med strukturerte doseringsregimer
      - `src/lib/hapi/hent.ts` (ren, nøkkel inn): `hentTre()` går produkt → kapittel → enhet med
        3 samtidige kall. Header `Ocp-Apim-Subscription-Key`, nøkkel `HELSEDIR_API_KEY` i `.env`.
        **Bruk produksjons-API-et** (`api.helsedirektoratet.no`); QA (`api-qa.`) har testdata og
        utdaterte doser, og QA-nøkler virker ikke mot produksjon (egen portal: utvikler-qa.)
      - `src/lib/verktoy/retningslinjer/antibiotika-hapi.ts` (ren): `byggAntibiotika()` oversetter
        til `Retningslinje`/`Tilstand`/`Anbefaling`. Doseteksten er kildens `displayOppsummering`
        ordrett — **ikke** tittelfeltet, som av og til mangler ladningsdosen («10 mg/kg … med
        ladningsdose fra dag 2» mot «20 mg/kg ladningsdose etterfulgt av 10 mg/kg»). Flere
        doseringsregimer i én rad = kombinasjon («+»). HTML → Markdown med `turndown`, vist med
        react-markdown uten rå HTML (`retningslinje-visning.tsx`). Lenker til API-et skrives om
        til helsedirektoratet.no. Øk `ANTIBIOTIKA_FORMAT` når oversettingen endres
      - Id-er er API-ets `infoId`, ikke URL-sluggen (sluggen er feil for enkelte tilstander)
      - `antibiotika-tillegg.ts`: det API-et ikke vet — fagområde og søkeord per `infoId`, ellers
        fagområde fra kapittelet (`KAPITTEL_FAGOMRADE`). Selvtesten feiler på nøkler som forsvinner
      - Server: `src/lib/hapi/retningslinjer-server.ts` mellomlagrer i `HapiInnhold` (ferdig
        oversatt JSON). Forespørsler venter aldri på API-et: eldre enn et døgn → ny henting i
        bakgrunnen; feil → forrige versjon vises, feilen lagres (`sisteFeil`), nytt forsøk tidligst
        etter 15 min. Tom tabell/gammelt format → reservekopien
        `antibiotika-reserve.json` (i repoet, `npm run retningslinjer:reserve`)
      - `/api/retningslinjer` (innlogget, `Cache-Control: no-store`) →
        `useRetningslinjer()` (én henting per sidevisning). Verktøymodalen slår sammen
        `INNEBYGDE_OPPSLAG` med retningslinjene; `sok.ts`-funksjonene tar listen som parameter
      - Admin: «Retningslinjer (Helsedirektoratet)» på `/admin/innstillinger` viser status og
        «Hent nå» (`/api/admin/retningslinjer`)
      - UI viser «Hentet fra Helsedirektoratet …» og kildens «sist faglig oppdatert». Advarsel når
        hentingen er eldre enn `HENTING_ADVARSEL_DAGER` (7) — da feiler hentingen
      - **Kontroll:** `npm run verktoy:test` sammenholder reservekopien med de 100 behandlingslinjene
        i 18 tilstander som ble verifisert manuelt 2026-08-20 (`scripts/fasit/antibiotika-verifisert.json`),
        på preparat og hvert tall i dosen i rekkefølge. Feiler testen etter ny reservekopi: les
        kilden, og oppdater fasiten hvis Helsedirektoratet har endret anbefalingen. Testen feiler
        også når reservekopien er eldre enn 180 dager
    - **Retningslinjer til oppslag (leseren, fase 2):** andre nasjonale faglige retningslinjer,
      valgt av admin på `/admin/retningslinjer` (SystemSetting `hapi_lese_utvalg`, JSON med
      `infoId`-er; uten valg brukes `STANDARD_UTVALG` i `retningslinjer-server.ts`). Katalogen over
      alle gjeldende retningslinjer mellomlagres som `katalog:retningslinje`
      - `hentNestet()` beholder kapittelstrukturen og henter ikke referanser/PICO (400+ i diabetes)
      - `lese-hapi.ts` (ren): `LeseRetningslinje` → `LeseKapittel` → `LeseEnhet` (anbefaling med
        `styrke`, `tekst`, `praktisk`, `begrunnelse` = nokkelInfo-feltene + rasjonale). Et
        kapittel med egen brødtekst blir første enhet i kapittelet (`erKapitteltekst`, samme id) —
        røykeavvenning har nesten alt innholdet slik. «Metode og prosess», «Om retningslinjen» og
        «Referanser» utelates. Øk `LESE_FORMAT` når oversettingen endres
      - Noen retningslinjer (overvekt hos voksne, underernæring) har ingen kapitler i API-et —
        vises som kort med lenke «Finnes bare på helsedirektoratet.no»
      - Rader `les:<infoId>` i `HapiInnhold`. Alle hentinger går i én kø (aldri parallelle
        retningslinjer mot API-et); parset JSON holdes i minnet per `hentetAt`
      - `/api/retningslinjer` gir også innholdsfortegnelsene (`tilIndeks`, uten brødtekst, ~10–60 kB
        per retningslinje) og `leseVenter`. Begge rutene svarer `no-store`: med `max-age` viste
        nettleseren et gammelt svar uten pakkeforløpene i opptil en time etter deploy. Full tekst: `/api/retningslinjer/les/[id]` (kun retningslinjer i utvalget),
        `useLeseRetningslinje()`/`hentFull()`
      - Søket: `Treff` har `slag: "leseenhet"` (tittel, kapittel, retningslinjenavn); ingen søkeord og
        ingen forslag fra transkriptet. Fanen «Andre retningslinjer» viser kort per retningslinje med
        kapitlene; `RetningslinjeLeser` har innholdsfortegnelse + tekst, «Praktisk» åpen og
        «Begrunnelse» lukket
      - «Legg i notat» (`byggLeseResultat`): anbefalingens tekst ordrett (uten markdown), eller bare
        tittelen for kapitteltekst og tekster over 500 tegn, + styrke og kilde med faglig dato.
        `verktoyId` = `les:<infoId>`, så resultatet kan gjenåpnes i leseren
    - **Pakkeforløp og nasjonale forløp (fase 3):** egen fane «Pakkeforløp» (kreftforløpene og
      «Andre nasjonale forløp»). Samme leser og datatype (`LeseRetningslinje` med `art: "forlop"`),
      eget utvalg (`hapi_forlop_utvalg`; standard = alt med «pakkeforløp» i tittelen) og egen katalog
      (`katalog:forlop`, `infoTyper=nasjonalt-forlop`). Rader `forlop:<infoId>`, rot
      `/innhold/nasjonalt-forlop/0006-0007-<id>`. `retningslinjer-server.ts` har én `Samling` per type
      - Snarvei per forløp (`henvisningFor`): «Kriterier» → siden «Begrunnet mistanke – kriterier for
        henvisning», ellers «Inngang» → første side i «Inngang til pakkeforløp …» (prostatakreft har
        kriteriene under «Mistanke», kreft hos barn per krefttype)
      - «Om pakkeforløpet» og «Registrering av koder …» utelates (koding i spesialisthelsetjenesten)
      - Notattittel «Pakkeforløp (brystkreft)»
    - **Kvote:** HAPI tillater omtrent 1000 kall i minuttet og svarer 429 med `Retry-After`. `hent.ts`
      sender alle kall med 200 ms mellomrom (felles for prosessen) og venter ved 429 (inntil 5 forsøk).
      En full oppdatering (antibiotika + 8 retningslinjer + 28 forløp, ~1700 kall) tar ~6 min i
      bakgrunnen. Noen forløp lenker til upubliserte enheter (204 No Content) og samme enhet to
      ganger — begge hoppes over
    - **Lisens: NLOD** (vilkårene for Helsedirektoratets API, lest 2026-10-09). Krav: oppgi
      Helsedirektoratet som kilde, tydelig, i **samme skriftstørrelse som innholdet** og rett ved
      det (`retningslinje-visning.tsx` øverst, og i notatlinjen med faglig dato); ikke framstå som
      Helsedirektoratet; ikke endre faglig innhold slik at meningen endres
    - **Innholdet vises og settes inn ordrett**, aldri omformulert av en språkmodell. Doser settes
      inn i notatet av koden, ikke via prompten — en omskrevet «660 mg x 4» ville vært like
      usynlig som en feilsummert skår
    - `Anbefaling` speiler kildens egne vektbånd (`etikett`: «Barn 25–35 kg») i stedet for en
      voksen/barn-akse kilden ikke har
    - Tilstandene er egne rader i søkelisten — legen søker «ørebetennelse», ikke «Antibiotika i
      allmennpraksis». Retningslinjens egne søkeord teller ikke i forslagene («infeksjon» ville
      slått ut i annenhver konsultasjon)
    - «Antibiotika ikke indisert» er et eget valg: å journalføre at behandling ikke er indisert er
      et like gyldig utfall som å velge preparat (akutt bronkitt har ingen anbefalinger i det hele tatt)
    - Resultatet lagres som et vanlig `VerktoyResultat` med `visKilde: true` — gir persistering,
      gjenåpning og «Regenerer»-motstand gratis, uten egen datamodell
