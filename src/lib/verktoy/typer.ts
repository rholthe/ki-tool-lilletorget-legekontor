/**
 * Typer for kliniske verktøy (scoringsskjema, strukturerte undersøkelser,
 * kalkulatorer, retningslinjer).
 *
 * Definisjonene er bevisst **JSON-serialiserbare**: beregningen er deklarativ
 * (`beregning` + `terskler` + `overstyringer`), ikke en funksjon. Det gjør at
 * innebygde verktøy fra repoet og admin-opprettede verktøy fra databasen har
 * nøyaktig samme form.
 *
 * Poengsummer og terskler beregnes alltid av koden i `beregn.ts` — aldri av Claude.
 */

export type VerktoyKategori =
  | "score"
  | "undersokelse"
  | "kalkulator"
  | "retningslinje"

export type Funnverdi = "normal" | "patologisk" | "ikke_utfort"

export type Svarverdi = boolean | number | string | null

export type Farge = "gronn" | "gul" | "rod"

/**
 * Hvordan et bidrag skrives i notatet.
 *
 * `full` tar med etikett, valgt alternativtekst og poeng; `poeng` skriver kun
 * etikett + poeng (det man vil ha på skalaer med mange ledd — MADRS ville ellers
 * fått en avsnittslang linje); `tekst` skriver kun alternativteksten, for verktøy
 * med ett enkelt vurderingsledd der poenget allerede står i summen; `uten_poeng`
 * skriver etikett + tekst uten poeng, for klassifiserende felter som ikke skårer
 * (PEVS sin aldersgruppe).
 */
export type DetaljStil = "full" | "poeng" | "tekst" | "uten_poeng"

/**
 * Blokk i en lengre veiledning. Formen er bevisst enkel og serialiserbar, slik at
 * admin senere kan bygge veiledninger fra frontend uten å skrive markup.
 */
export type VeiledningBlokk =
  | { type: "overskrift"; tekst: string }
  | { type: "avsnitt"; tekst: string }
  | { type: "punkter"; punkter: string[] }
  | { type: "tabell"; kolonner: string[]; rader: string[][]; fotnote?: string }
  | { type: "lenke"; tekst: string; url: string }

/**
 * Full veiledning, vist i egen modal. Feltene har kort `hjelp` inline; alt som er
 * lengre enn én linje hører hjemme her i stedet for å fylle opp skjemaet.
 */
export interface Veiledning {
  tittel: string
  blokker: VeiledningBlokk[]
}

/** Ett alternativ i et `valg`-felt. `kriterium` vises som forklarende hjelpetekst. */
export interface Alternativ {
  tekst: string
  poeng: number
  kriterium?: string
}

interface FeltBase {
  id: string
  /** Én kort linje under spørsmålet. Lengre tekst hører hjemme i `veiledning`. */
  hjelp?: string
  /** Full veiledning for dette punktet, åpnes i egen modal fra en lenke. */
  veiledning?: Veiledning
  /** Overstyrer verktøyets `detaljStil` for dette ene feltet. */
  detaljStil?: DetaljStil
  /**
   * Feltet vises bare når et annet felt har denne verdien.
   *
   * Svangerskapskalkulatoren har fire inngangsveier til samme størrelse, og bare
   * feltene for den valgte veien skal stå framme. Skjulte felter regnes heller
   * ikke med i utfyllingskravet.
   */
  synligNar?: { felt: string; erLik: Svarverdi | Svarverdi[] }
}

export type Felt =
  | (FeltBase & {
      type: "ja_nei"
      sporsmal: string
      poeng: number
      /** Kort etikett brukt i journalnotatet i stedet for hele spørsmålsteksten. */
      kort?: string
    })
  | (FeltBase & {
      type: "valg"
      sporsmal: string
      alternativer: Alternativ[]
      kort?: string
    })
  | (FeltBase & {
      type: "tall"
      sporsmal: string
      enhet: string
      min?: number
      max?: number
      kort?: string
    })
  | (FeltBase & {
      /** ISO-dato («2026-08-20») fra en `<input type="date">`. */
      type: "dato"
      sporsmal: string
      kort?: string
    })
  | (FeltBase & {
      type: "funn"
      test: string
      kort?: string
    })
  | (FeltBase & {
      type: "fritekst"
      sporsmal: string
    })

export interface Seksjon {
  id: string
  tittel: string
  /** Maks oppnåelig poeng i seksjonen — vises som «4 / 5» ved delscorer. */
  maksPoeng?: number
  felter: Felt[]
}

export interface Terskel {
  /** Inklusiv nedre og øvre grense. */
  fra: number
  til: number
  klasse: string
  /** Publisert tolkning, sitert fra kilden. Ingen egne handlingsanbefalinger. */
  tekst: string
  farge: Farge
  /**
   * Terskelen gjelder bare når et annet felt ligger i dette intervallet.
   *
   * NORRISK 2 er eksempelet: samme risikoprosent er «lav» hos en 70-åring og
   * «høy» hos en 50-åring, så grensene er aldersbåndede. Første terskel som
   * matcher både sum og betingelse vinner.
   */
  betingelse?: { felt: string; min?: number; maks?: number }
}

/**
 * Regel som slår ut uavhengig av totalsummen, fordi ett enkeltfelt alene er
 * alvorlig nok. PEVS er eksempelet: 3 poeng på én parameter krever umiddelbart
 * legetilsyn selv om totalen er 3. Terskeltabellen kan ikke uttrykke dette, siden
 * den bare kjenner summen.
 */
export interface Overstyring {
  type: "enkeltfelt_minst"
  /** Utløses når minst ett felt bidrar med så mange poeng. */
  poeng: number
  klasse: string
  tekst: string
  farge: Farge
}

export interface Kilde {
  navn: string
  url?: string
  versjon?: string
  sistRevidert: string
}

/** Referansekasus med kjent fasit — kjøres som selvtest, se `kjorTestkasus`. */
export interface Testkasus {
  navn: string
  svar: Record<string, Svarverdi>
  forventetSum: number
  /** Valgfri fasit for tolkningen — verifiserer terskler og overstyringer. */
  forventetKlasse?: string
}

export interface Verktoy {
  id: string
  navn: string
  langtNavn: string
  kategori: VerktoyKategori
  /** Driver både søkefeltet og nøkkelordbaserte forslag. */
  sokeord: string[]
  /** Verktøy som gjelder én kroppsside — legen velger venstre/høyre. */
  lateralitet?: boolean
  seksjoner: Seksjon[]
  /**
   * Hvordan resultatet regnes ut. `maks` kapper totalsummen, for skalaer der
   * kilden oppgir et tak.
   *
   * `formel` slår opp en navngitt funksjon i `formler.ts` — aldri lagret kode
   * som evalueres. Det holder definisjonen JSON-serialiserbar også for
   * regresjonsmodeller, slik at admin-opprettede verktøy har samme form.
   */
  beregning:
    | { type: "sum" | "sum_per_seksjon" | "ingen"; maks?: number }
    | { type: "formel"; formelId: string; desimaler?: number }
  terskler: Terskel[]
  /** Regler som overstyrer terskeltabellen når de utløses. */
  overstyringer?: Overstyring[]
  visDelscorer?: boolean
  /** Standard notatstil for verktøyets felter. Kan overstyres per felt. */
  detaljStil?: DetaljStil
  /** Enheten summen måles i. Standard «poeng» — skalaer som Shulman bruker nivå. */
  sumEtikett?: string
  /** Full veiledning for hele verktøyet, åpnes i egen modal fra overskriften. */
  veiledning?: Veiledning
  /** Overskrift i journalnotatet. */
  notatTittel: string
  kilde: Kilde
  testkasus?: Testkasus[]
  opphav: "innebygd" | "egendefinert"
}

export type Side = "venstre" | "hoyre"

export interface Delscore {
  seksjon: string
  sum: number
  maks?: number
}

export interface VerktoyResultat {
  id: string
  verktoyId: string
  /** Snapshot av navnet — verktøydefinisjonen kan endres senere. */
  navn: string
  notatTittel: string
  side?: Side
  svar: Record<string, Svarverdi>
  sum: number | null
  /** Snapshot av enheten summen måles i, f.eks. «poeng». */
  sumEtikett: string
  delscorer?: Delscore[]
  /**
   * Snapshot av bidragene («hjertesvikt 1», «Lachman patologisk»), slik at
   * notatseksjonen kan bygges uten oppslag i definisjonen.
   */
  detaljer: string[]
  klasse: string | null
  tolkning: string | null
  kilde: string
  /**
   * Tvinger fram kildelinjen i notatet. Undersøkelser uten skår dropper den
   * bevisst, men for et retningslinjeoppslag er nettopp kilden hele poenget.
   */
  visKilde?: boolean
  utfortAt: number
  aiForhandsutfylt: boolean
  bekreftet: boolean
}

/* ────────────────────────── Retningslinjer (oppslag) ──────────────────────────
 *
 * En retningslinje er ikke et verktøy uten poeng — den er en annen datatype. Legen
 * fyller ikke ut noe; hun slår opp. Derfor egen type i stedet for å strekke
 * `Verktoy` med felter som er `undefined` for halvparten av innholdet.
 *
 * Innholdet gjengis ordrett fra kilden. Doser skrives aldri fra hukommelsen og
 * omformuleres aldri av en språkmodell — samme prinsipp som for poengsummer.
 */

/** Én behandlingslinje, gjengitt slik den står i kilden. */
export interface Anbefaling {
  id: string
  /** Kildens egen etikett: «Voksne og barn > 40 kg», «Ved penicillinallergi: barn < 25 kg». */
  etikett: string
  legemiddel: string
  administrasjon: string
  dose: string
  /** «mikstur (etylsuksinat)», «kan knuses og blandes i mat». */
  merknad?: string
  /** Kombinasjonsbehandling — legemidler som gis i tillegg til hovedpreparatet. */
  iTillegg?: { legemiddel: string; administrasjon: string; dose: string }[]
  gruppe: "standard" | "alternativ"
}

export interface Tilstand {
  id: string
  navn: string
  sokeord: string[]
  /** Direkte lenke til kapitlet hos kilden — ett klikk til fasit. */
  url: string
  /** ISO-dato: når innholdet her sist ble sammenholdt med kilden. */
  sistVerifisert: string
  /** Kildens egen «sist oppdatert»-dato, slik den var ved verifiseringen. */
  kildeOppdatert?: string
  indikasjon: string[]
  varighet?: string
  /** Kan være tom — akutt bronkitt skal som regel ikke ha antibiotika. */
  anbefalinger: Anbefaling[]
  merknader?: string[]
  /**
   * Settes når kun et utvalg av kildens rader er gjengitt. Legen må se dette i
   * UI-et, ellers kan hun tro at listen er uttømmende.
   */
  utvalg?: boolean
}

export interface Retningslinje {
  id: string
  navn: string
  langtNavn: string
  kategori: "retningslinje"
  sokeord: string[]
  kilde: Kilde
  url: string
  tilstander: Tilstand[]
}

/** Alt som kan velges i verktøymodalen. */
export type Oppslag = Verktoy | Retningslinje | Kalkulator

/* ────────────────────────── Kalkulatorer ──────────────────────────
 *
 * En kalkulator er verken en skår eller et oppslag. Den har flere inngangsveier
 * til samme underliggende størrelse, og gir flere utdata samtidig — ikke ett
 * tall med et tolkningsbånd. Svangerskapskalkulatoren regner ut termin, siste
 * menstruasjon og aktuell gestasjonsalder på én gang, og `sum: number | null`
 * kan ikke bære det.
 *
 * Inndataene har derimot nøyaktig samme form som verktøyene, så `Felt`,
 * `Seksjon` og skjemarendreren gjenbrukes uendret.
 */

/** Én linje i kalkulatorens resultat. */
export interface Resultatlinje {
  etikett: string
  verdi: string
  /** Løftes fram visuelt — hovedsvaret, som termindato. */
  uthevet?: boolean
  /** Kort presisering under linjen. */
  merknad?: string
}

export interface KalkulatorResultat {
  linjer: Resultatlinje[]
  /** Bidragene som går inn i journalnotatet, i rekkefølge. */
  notatDetaljer: string[]
}

export interface Kalkulator {
  id: string
  navn: string
  langtNavn: string
  kategori: "kalkulator"
  sokeord: string[]
  seksjoner: Seksjon[]
  /**
   * Slår opp en navngitt funksjon i `kalkulatorer.ts` — aldri lagret kode som
   * evalueres, samme prinsipp som `formelId`.
   */
  kalkulatorId: string
  notatTittel: string
  kilde: Kilde
  veiledning?: Veiledning
  /** Referansekasus med kjent fasit, kjørt av selvtesten. */
  testkasus?: {
    navn: string
    svar: Record<string, Svarverdi>
    /** Forventede linjer som «etikett: verdi». Delmengde — kun det som testes. */
    forventet: Record<string, string>
  }[]
  opphav: "innebygd" | "egendefinert"
}
