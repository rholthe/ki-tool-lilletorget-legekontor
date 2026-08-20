/**
 * Søk i verktøylisten og nøkkelordbaserte forslag ut fra konsultasjonens innhold.
 *
 * Forslagene er rent tekstlige — ingen AI, ingen nettverkskall, ingen ventetid.
 * AI-baserte forslag kommer som et supplement senere.
 *
 * Retningslinjenes **tilstander** er egne treff, ikke bare retningslinjen de
 * ligger i. Legen søker etter «ørebetennelse», ikke etter «Antibiotika i
 * allmennpraksis».
 */

import type { Kalkulator, Oppslag, Retningslinje, Tilstand, Verktoy } from "./typer"
import { INNEBYGDE_OPPSLAG, erKalkulator, erRetningslinje } from "./registry"

function normaliser(tekst: string): string {
  return tekst.toLowerCase().trim()
}

function escapeRegex(tekst: string): string {
  return tekst.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Treff på helt ord, slik at korte nøkkelord («af», «le», «pe») ikke slår ut
 * inni andre ord. Bruker unicode-klasser så norske bokstaver teller som ordtegn.
 */
function inneholderOrd(tekst: string, ord: string): boolean {
  const monster = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegex(ord)}(?![\\p{L}\\p{N}])`,
    "iu"
  )
  return monster.test(tekst)
}

/** Én rad i verktøylisten: enten et verktøy, eller én tilstand i en retningslinje. */
export type Treff =
  | { slag: "verktoy"; verktoy: Verktoy }
  | { slag: "kalkulator"; kalkulator: Kalkulator }
  | { slag: "tilstand"; retningslinje: Retningslinje; tilstand: Tilstand }

export function treffId(treff: Treff): string {
  if (treff.slag === "verktoy") return treff.verktoy.id
  if (treff.slag === "kalkulator") return treff.kalkulator.id
  return `${treff.retningslinje.id}:${treff.tilstand.id}`
}

/** Alle rader, uten filtrering. */
function alleTreff(oppslag: Oppslag[]): Treff[] {
  return oppslag.flatMap<Treff>((o) => {
    if (erRetningslinje(o)) {
      return o.tilstander.map((tilstand) => ({
        slag: "tilstand" as const,
        retningslinje: o,
        tilstand,
      }))
    }
    if (erKalkulator(o)) return [{ slag: "kalkulator" as const, kalkulator: o }]
    return [{ slag: "verktoy" as const, verktoy: o }]
  })
}

/** Fritekstsøk mot navn, langt navn og søkeord. */
export function sokOppslag(
  sok: string,
  oppslag: Oppslag[] = INNEBYGDE_OPPSLAG
): Treff[] {
  const q = normaliser(sok)
  const alle = alleTreff(oppslag)
  if (!q) return alle

  return alle.filter((t) => {
    const felter =
      t.slag === "verktoy"
        ? [t.verktoy.navn, t.verktoy.langtNavn, ...t.verktoy.sokeord]
        : t.slag === "kalkulator"
          ? [t.kalkulator.navn, t.kalkulator.langtNavn, ...t.kalkulator.sokeord]
          : [
            t.tilstand.navn,
            t.retningslinje.navn,
            t.retningslinje.langtNavn,
            ...t.tilstand.sokeord,
            ...t.retningslinje.sokeord,
          ]
    return felter.map(normaliser).some((f) => f.includes(q))
  })
}

export interface Forslag {
  treff: Treff
  /** Nøkkelordene som traff — vises som begrunnelse i UI-et. */
  ord: string[]
}

/**
 * Foreslår oppslag ut fra transkript/kontekst/tilleggsinfo. Rangert etter antall
 * nøkkelordtreff; oppslag uten treff utelates.
 *
 * Retningslinjens egne søkeord («antibiotika», «infeksjon») teller ikke med her —
 * de er for generelle og ville foreslått noe i annenhver konsultasjon. Kun
 * tilstandens egne nøkkelord utløser et forslag.
 */
export function foreslaaOppslag(
  tekst: string,
  oppslag: Oppslag[] = INNEBYGDE_OPPSLAG,
  maks = 3
): Forslag[] {
  const kilde = normaliser(tekst)
  if (!kilde) return []

  return alleTreff(oppslag)
    .map((treff) => {
      const sokeord =
        treff.slag === "verktoy"
          ? treff.verktoy.sokeord
          : treff.slag === "kalkulator"
            ? treff.kalkulator.sokeord
            : treff.tilstand.sokeord
      return { treff, ord: sokeord.filter((o) => inneholderOrd(kilde, o)) }
    })
    .filter((f) => f.ord.length > 0)
    .sort((a, b) => b.ord.length - a.ord.length)
    .slice(0, maks)
}

/** Slår opp én rad fra id-en `treffId` produserer. */
export function finnTreff(
  id: string,
  oppslag: Oppslag[] = INNEBYGDE_OPPSLAG
): Treff | undefined {
  return alleTreff(oppslag).find((t) => treffId(t) === id)
}

export interface Kandidat {
  id: string
  navn: string
  beskrivelse: string
}

/**
 * Kandidatlisten som sendes til språkmodellen ved AI-forslag.
 *
 * Bygges på serveren, aldri av klienten: modellen får kun lov til å returnere
 * id-er herfra, og samme liste brukes til å validere svaret. Da kan verken
 * modellen eller en manipulert klient introdusere et verktøy som ikke finnes.
 */
export function forslagKandidater(oppslag: Oppslag[] = INNEBYGDE_OPPSLAG): Kandidat[] {
  return alleTreff(oppslag).map((t) =>
    t.slag === "verktoy"
      ? { id: treffId(t), navn: t.verktoy.navn, beskrivelse: t.verktoy.langtNavn }
      : t.slag === "kalkulator"
        ? { id: treffId(t), navn: t.kalkulator.navn, beskrivelse: t.kalkulator.langtNavn }
        : {
          id: treffId(t),
          navn: t.tilstand.navn,
          beskrivelse: `Behandlingsanbefaling — ${t.retningslinje.navn}`,
        }
  )
}
