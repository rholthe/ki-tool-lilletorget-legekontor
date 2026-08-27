import type { Svarverdi } from "./typer"

/**
 * Navngitte formler for `beregning: { type: "formel", formelId }`.
 *
 * Definisjonene i `definisjoner/` viser til en formel ved id og forblir dermed
 * ren JSON. Koden ligger her, i git, der den går gjennom code review — **aldri
 * som lagret kode som evalueres**. Det gjelder også når admin senere kan lage
 * egne verktøy: de kan velge blant formlene som finnes, ikke skrive nye.
 */

export type Formel = (svar: Record<string, Svarverdi>) => number | null

function tall(verdi: Svarverdi): number | null {
  if (typeof verdi === "number" && Number.isFinite(verdi)) return verdi
  return null
}

function jaNei(verdi: Svarverdi): boolean {
  return verdi === true
}

/**
 * NORRISK 2 — 10-årsrisiko for fatalt og ikke-fatalt hjerteinfarkt eller
 * hjerneslag.
 *
 * Modellen er en Cox-modell på formen `risiko = 1 − exp(−exp(LP))`, med egne
 * koeffisientsett for kvinner og menn. Alder inngår kvadratisk, og blodtrykk,
 * kolesterol og røyking har hver sin aldersinteraksjon — risikobidraget fra en
 * risikofaktor avtar med alderen fordi aldersleddet selv tar over.
 *
 * **Om koeffisientene:** de er ikke skrevet av fra en artikkel, men utledet
 * numerisk fra Helsedirektoratets egen kalkulator
 * (hjerterisiko.helsedirektoratet.no). Siden `log(−log(1 − risiko))` er lineær
 * i kovariatene, faller hver koeffisient eksakt ut av endringer i ett felt om
 * gangen. Rekonstruksjonen er deretter kontrollert mot kalkulatoren i 36 000
 * punkter over hele det validerte inndataområdet; største avvik var 6·10⁻¹³
 * prosentpoeng, altså flyttallstøy. Verdiene stemmer også med tallliteralene i
 * kalkulatorens egen kildekode.
 *
 * Det gir en sterkere garanti enn transkribering: metoden kan ikke bomme på
 * hvilken koeffisient som hører til hvilket ledd, og selvtesten fanger et
 * avvik hvis Helsedirektoratet endrer modellen.
 */
interface Norrisk2Sett {
  konstant: number
  alder: number
  alderKvadrat: number
  systolisk: number
  systoliskAlder: number
  kolesterol: number
  kolesterolAlder: number
  royking: number
  roykingAlder: number
  btBehandling: number
  lavtHdl: number
  slektning1: number
  slektning2: number
}

const KVINNE: Norrisk2Sett = {
  konstant: -18.05530809,
  alder: 0.24317,
  alderKvadrat: -0.00066,
  systolisk: 0.045241,
  systoliskAlder: -0.0005,
  kolesterol: 0.07235,
  kolesterolAlder: 0,
  royking: 2.25021,
  roykingAlder: -0.02456,
  btBehandling: 0.192,
  lavtHdl: 0.32377,
  slektning1: 0.25361,
  slektning2: 0.54909,
}

const MANN: Norrisk2Sett = {
  konstant: -18.11098425,
  alder: 0.23631,
  alderKvadrat: -0.00043,
  systolisk: 0.039483,
  systoliskAlder: -0.00043,
  kolesterol: 0.71465,
  kolesterolAlder: -0.00896,
  royking: 1.73767,
  roykingAlder: -0.02051,
  btBehandling: 0.27824,
  lavtHdl: 0.33162,
  slektning1: 0.29986,
  slektning2: 0.59692,
}

/**
 * Modellens validerte inndataområde. Utenfor dette returnerer formelen null i
 * stedet for å ekstrapolere: en risikoprosent regnet på en 80-åring ville sett
 * like troverdig ut som en gyldig én, men modellen er ikke tilpasset der.
 */
export const NORRISK2_OMRADE = {
  alder: { min: 45, maks: 74 },
  systolisk: { min: 120, maks: 160 },
  kolesterol: { min: 4, maks: 8 },
}

function iOmradet(verdi: number, omrade: { min: number; maks: number }): boolean {
  return verdi >= omrade.min && verdi <= omrade.maks
}

const norrisk2: Formel = (svar) => {
  const alder = tall(svar.alder)
  const systolisk = tall(svar.systolisk)
  const kolesterol = tall(svar.kolesterol)
  const kjonn = svar.kjonn

  if (alder === null || systolisk === null || kolesterol === null) return null
  if (typeof kjonn !== "number") return null
  if (
    !iOmradet(alder, NORRISK2_OMRADE.alder) ||
    !iOmradet(systolisk, NORRISK2_OMRADE.systolisk) ||
    !iOmradet(kolesterol, NORRISK2_OMRADE.kolesterol)
  ) {
    return null
  }

  // Alternativ 0 = kvinne, 1 = mann (rekkefølgen i definisjonen)
  const k = kjonn === 1 ? MANN : KVINNE
  const slektninger = typeof svar.slektninger === "number" ? svar.slektninger : 0

  const lp =
    k.konstant +
    k.alder * alder +
    k.alderKvadrat * alder * alder +
    (k.systolisk + k.systoliskAlder * alder) * systolisk +
    (k.kolesterol + k.kolesterolAlder * alder) * kolesterol +
    (jaNei(svar.royking) ? k.royking + k.roykingAlder * alder : 0) +
    (jaNei(svar.btBehandling) ? k.btBehandling : 0) +
    (jaNei(svar.lavtHdl) ? k.lavtHdl : 0) +
    (slektninger === 1 ? k.slektning1 : slektninger === 2 ? k.slektning2 : 0)

  return (1 - Math.exp(-Math.exp(lp))) * 100
}

/**
 * MDI — Major Depression Inventory, totalskår 0–50.
 *
 * Skjemaet har tolv spørsmål, men bare ti ledd. Kilden (Bech et al., BMC
 * Psychiatry 2015, figur 1b) sier: «For items 8a versus 8b and for items 10a
 * versus 10b, it is the highest score on a or b that is used». Derfor formel og
 * ikke `sum`: en rett summering av alle tolv gir inntil 60 på en skala som går
 * til 50, og den ville systematisk overvurdert alvorlighetsgraden.
 *
 * Svarverdiene er alternativindekser. Alternativene i `definisjoner/mdi.ts` er
 * bevisst listet stigende, slik at **indeks === poeng** — formelen får bare
 * svarene, ikke definisjonen, og kan ikke slå opp poengene selv.
 * Referansekasusene i definisjonen fanger opp hvis den rekkefølgen endres.
 *
 * Returnerer null til alle tolv er besvart. Et halvutfylt skjema gir en for lav
 * sum som ser helt gyldig ut, og ville landet i feil alvorlighetsbånd.
 */
const MDI_ENKELTLEDD = [
  "nedstemt",
  "interesse",
  "energi",
  "selvtillit",
  "skyldfolelse",
  "livslyst",
  "konsentrasjon",
  "sovn",
]

/** Parene der kun det høyeste svaret teller. */
const MDI_PAR: [string, string][] = [
  ["rastlos", "dempet"],
  ["nedsatt-appetitt", "okt-appetitt"],
]

const mdi: Formel = (svar) => {
  let sum = 0

  for (const id of MDI_ENKELTLEDD) {
    const poeng = tall(svar[id])
    if (poeng === null) return null
    sum += poeng
  }

  for (const [a, b] of MDI_PAR) {
    const forste = tall(svar[a])
    const andre = tall(svar[b])
    if (forste === null || andre === null) return null
    sum += Math.max(forste, andre)
  }

  return sum
}

export const FORMLER: Record<string, Formel> = {
  norrisk2,
  mdi,
}

export function finnFormel(id: string): Formel | undefined {
  return FORMLER[id]
}
