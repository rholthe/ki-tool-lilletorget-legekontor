/**
 * Typer for kliniske verktøy (scoringsskjema, strukturerte undersøkelser,
 * kalkulatorer, retningslinjer).
 *
 * Definisjonene er bevisst **JSON-serialiserbare**: beregningen er deklarativ
 * (`beregning` + `terskler`), ikke en funksjon. Det gjør at innebygde verktøy fra
 * repoet og admin-opprettede verktøy fra databasen har nøyaktig samme form.
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

/** Ett alternativ i et `valg`-felt. `kriterium` vises som forklarende hjelpetekst. */
export interface Alternativ {
  tekst: string
  poeng: number
  kriterium?: string
}

export type Felt =
  | {
      type: "ja_nei"
      id: string
      sporsmal: string
      poeng: number
      hjelp?: string
      /** Kort etikett brukt i journalnotatet i stedet for hele spørsmålsteksten. */
      kort?: string
    }
  | {
      type: "valg"
      id: string
      sporsmal: string
      alternativer: Alternativ[]
      hjelp?: string
      kort?: string
    }
  | {
      type: "tall"
      id: string
      sporsmal: string
      enhet: string
      min?: number
      max?: number
      hjelp?: string
    }
  | {
      type: "funn"
      id: string
      test: string
      hjelp?: string
      kort?: string
    }
  | {
      type: "fritekst"
      id: string
      sporsmal: string
      hjelp?: string
    }

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
  farge: "gronn" | "gul" | "rod"
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
  beregning: { type: "sum" | "sum_per_seksjon" | "ingen" }
  terskler: Terskel[]
  visDelscorer?: boolean
  /**
   * Hvordan bidragene skrives i notatet. `"full"` (standard) tar med etikett,
   * valgt alternativtekst og poeng; `"poeng"` skriver kun etikett + poeng, som er
   * det man vil ha på skalaer med mange ledd (MADRS ville ellers fått en
   * avsnittslang linje); `"tekst"` skriver kun alternativteksten, for verktøy med
   * ett enkelt vurderingsledd der poenget allerede står i summen.
   */
  detaljStil?: "full" | "poeng" | "tekst"
  /** Enheten summen måles i. Standard «poeng» — skalaer som Shulman bruker nivå. */
  sumEtikett?: string
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
