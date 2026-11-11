# Kliniske verktøy

Detaljer flyttet fra `CLAUDE.md`. Gjelder `src/lib/verktoy/` og verktøymodalen. Retningslinjer og pakkeforløp fra Helsedirektoratet står i `retningslinjer-hapi.md`.

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
  - **Oversikt med faner:** uten valgt verktøy fyller oversikten hele modalen, med forslag og
    «Nylig brukt» øverst. Fanen «Verktøy» viser verktøyene i koden som kort per fagområde
    (`Fagomrade` i `typer.ts`, `FAGOMRADE_LABEL` i `registry.ts` bestemmer rekkefølgen). Hver
    retningslinje har egen fane med kildens kapitler som kort, i tillegg til «Andre retningslinjer» og «Pakkeforløp» — ellers druknet 12 verktøy i 63
    antibiotikarader. Søket gjelder alle faner; siste fane huskes (localStorage
    `legeassist:verktoy-fane`). Når et verktøy velges, krymper søket til en linje med
    «Alle verktøy», og skjemaet får hele bredden. Går legen tilbake til oversikten (eller søker fra
    skjemaet), beholdes skjemaet, og «Tilbake til …» henter det fram igjen med svarene
    - `fagomrader` er påkrevd på `Verktoy`, `Kalkulator` og hver `Tilstand` (ikke per retningslinje —
      ørebetennelse og cystitt hører hjemme ulike steder). Flere er lov; oppslaget vises da under
      hvert. Selvtesten feiler hvis et oppslag mangler fagområde
    - Fagområdenavnene er søkbare («barn», «psykiatri», «legevakt» via synonymene)
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
    - **Vekting:** navnet +5, søkeord 0, kontekst −25 (kapittel, retningslinjens navn, typeord som
      «pakkeforløp»). Ellers treffer alle sidene i en retningslinje like godt på retningslinjens navn
    - **Svake treff viker:** finnes et treff ≥ 60 (`GODT_TREFF`), utelates treff under 50
      (`SVAKT_TREFF`) — skrivefeil og ord inni konteksten. «hjerte» ga ellers alle sidene om
      hjerneslag («hjerne»): 184 treff, nå 70. Rene skrivefeilsøk («ørebetenelse») virker som før
    - **Kategorifilter** over søketreffene: Alle · Verktøy · Antibiotika · Retningslinjer ·
      Pakkeforløp, med antall (`sokKategori()`). «Alle» viser de 6 beste per kategori med
      «Vis alle N →»; en valgt kategori viser hele listen. Enter åpner første synlige treff
    - **Forslag** ut fra transkript/kontekst er hele-ord-treff på `sokeord`; retningslinjens egne
      søkeord teller ikke
    - «Nylig brukt» (maks 5, kun treff-id-er i localStorage `legeassist:verktoy-nylig`)
    - Selvtesten har søkekasus (`SOKEKASUS`) — legg til et kasus når et søk har bommet
    - AI-forslag (Claude foreslo verktøy ut fra hele transkriptet) ble fjernet 2026-10-09: kallet
      gikk på nytt ved hver endring i transkriptet, med hele transkriptet som input, og sto for en
      uforholdsmessig stor del av kostnadene. Kategorien er fjernet fra `/api/bruk` og
      `/admin/bruk`, og radene (46 stk., 1,27 USD, 09.10) er slettet fra `Bruk`
  - Resultatet lagres strukturert som `Konsultasjon.verktoyResultater` (IndexedDB), ikke bare som
    tekst i notatet — ellers forsvinner det ved «Regenerer»
  - `synkVerktoySeksjon()` skriver seksjonen `--- KLINISKE VERKTØY ---` inn i notatet. Idempotent
    (ingen duplikater ved gjentatte kall) og plasseres foran `--- OCR ---`. Kalles fra
    `handleStreamFerdig` og ved hver endring i modalen
  - Systemprompt: `felles:verktoy` (staging-registry) legges på kun når verktøy er utført. Gir
    Claude tallene som kontekst og forbyr modellen å gjengi eller endre dem
  - `VerktoyModal` remounter innholdet via `key={aktiv.id}` slik at et halvutfylt skjema aldri
    følger med til neste pasient
