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
  /** `maks` kapper totalsummen, for skalaer der kilden oppgir et tak. */
  beregning: { type: "sum" | "sum_per_seksjon" | "ingen"; maks?: number }
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
  utfortAt: number
  aiForhandsutfylt: boolean
  bekreftet: boolean
}
