/**
 * Søk i verktøylisten og nøkkelordbaserte forslag ut fra konsultasjonens innhold.
 *
 * Forslagene er rent tekstlige — ingen AI, ingen nettverkskall, ingen ventetid.
 * AI-baserte forslag kommer som et supplement senere.
 */

import type { Verktoy } from "./typer"
import { INNEBYGDE_VERKTOY } from "./registry"

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

/** Fritekstsøk mot navn, langt navn og søkeord. */
export function sokVerktoy(
  sok: string,
  verktoy: Verktoy[] = INNEBYGDE_VERKTOY
): Verktoy[] {
  const q = normaliser(sok)
  if (!q) return verktoy

  return verktoy.filter((v) => {
    const felter = [v.navn, v.langtNavn, ...v.sokeord].map(normaliser)
    return felter.some((f) => f.includes(q))
  })
}

export interface Forslag {
  verktoy: Verktoy
  /** Nøkkelordene som traff — vises som begrunnelse i UI-et. */
  treff: string[]
}

/**
 * Foreslår verktøy ut fra transkript/kontekst/tilleggsinfo. Rangert etter antall
 * nøkkelordtreff; verktøy uten treff utelates.
 */
export function foreslaaVerktoy(
  tekst: string,
  verktoy: Verktoy[] = INNEBYGDE_VERKTOY,
  maks = 3
): Forslag[] {
  const kilde = normaliser(tekst)
  if (!kilde) return []

  return verktoy
    .map((v) => ({
      verktoy: v,
      treff: v.sokeord.filter((ord) => inneholderOrd(kilde, ord)),
    }))
    .filter((f) => f.treff.length > 0)
    .sort((a, b) => b.treff.length - a.treff.length)
    .slice(0, maks)
}
