"use client"

import { useSyncExternalStore } from "react"
import type { JournalSeksjoner } from "@/lib/journal-eksport"

/**
 * Kontakt med nettleserutvidelsen «LegeAssist → Pridok» (`nettleserutvidelse/pridok/`).
 *
 * Utvidelsens innholdsskript på legeassist-siden svarer på `ping` med `klar`, og
 * sender `klar` av seg selv når det lastes — så rekkefølgen ikke spiller noen rolle.
 * Alt går med `window.postMessage` innenfor samme side; teksten sendes videre av
 * utvidelsen til Pridok-fanen og er aldri innom serveren.
 */

const FRA_SIDEN = "legeassist"
const FRA_UTVIDELSEN = "legeassist-utvidelse"

export type JournalModus = "tom" | "legg-til" | "erstatt"

/** Et åpent notat i Pridok, slik utvidelsen beskriver det. Finnes bare i minnet. */
export type JournalNotat = {
  tabId: number
  /** Fanens nummer blant Pridok-fanene (1 = sist brukt). */
  fane: number
  dokId: string
  /** Dokumenttype fra dokumenthodet, f.eks. «Dagsnotat». */
  tittel: string
  navn: string | null
  /** Fødselsdato slik Pridok viser den, f.eks. «14.10.75». */
  fodt: string | null
  /** Feltetiketter som allerede har tekst. */
  harInnhold: string[]
}

export type JournalFinnSvar =
  | { ok: true; antallFaner: number; notater: JournalNotat[]; laaste: number }
  | { ok: false; grunn: "feil"; melding?: string }

export type JournalSvar =
  | { ok: true; fylt: string[] }
  | {
      ok: false
      grunn: "ingen-fane" | "fant-ikke-felt" | "har-innhold" | "feil"
      /** Feltetiketter i Pridok (ved har-innhold). */
      felt?: string[]
      melding?: string
    }

let installert = false
let versjon: string | null = null
const lyttere = new Set<() => void>()
const ventende = new Map<string, (svar: unknown) => void>()
let startet = false

function start() {
  if (startet || typeof window === "undefined") return
  startet = true
  window.addEventListener("message", (e) => {
    if (e.origin !== window.location.origin) return
    const d = e.data
    if (!d || typeof d !== "object" || d.kilde !== FRA_UTVIDELSEN) return
    if (d.type === "klar") {
      versjon = typeof d.versjon === "string" ? d.versjon : null
      if (!installert) {
        installert = true
        lyttere.forEach((l) => l())
      }
    } else if (d.type === "svar" && typeof d.id === "string") {
      const ferdig = ventende.get(d.id)
      if (ferdig) {
        ventende.delete(d.id)
        ferdig(d.svar)
      }
    }
  })
  window.postMessage({ kilde: FRA_SIDEN, type: "ping" }, window.location.origin)
}

function abonner(lytter: () => void) {
  start()
  lyttere.add(lytter)
  return () => {
    lyttere.delete(lytter)
  }
}

function forespor<T>(innhold: Record<string, unknown>, ventMs: number): Promise<T | { ok: false; grunn: "feil"; melding: string }> {
  start()
  const id = crypto.randomUUID()
  return new Promise((resolve) => {
    const tidsavbrudd = setTimeout(() => {
      ventende.delete(id)
      resolve({ ok: false, grunn: "feil", melding: "Utvidelsen svarte ikke." })
    }, ventMs)
    ventende.set(id, (svar) => {
      clearTimeout(tidsavbrudd)
      resolve((svar as T) ?? { ok: false, grunn: "feil", melding: "Tomt svar fra utvidelsen." })
    })
    window.postMessage({ kilde: FRA_SIDEN, type: "foresporsel", id, innhold }, window.location.origin)
  })
}

/** Alle åpne notater i alle Pridok-faner. */
export function finnJournalNotater(): Promise<JournalFinnSvar> {
  return forespor<JournalFinnSvar>({ type: "finn-notater" }, 15_000)
}

export function fyllJournalNotat(
  notat: Pick<JournalNotat, "tabId" | "dokId">,
  seksjoner: JournalSeksjoner,
  modus: JournalModus,
): Promise<JournalSvar> {
  return forespor<JournalSvar>(
    { type: "fyll-notat", tabId: notat.tabId, dokId: notat.dokId, felter: seksjoner, modus },
    15_000,
  )
}

export function useJournalUtvidelse(): { installert: boolean; versjon: string | null } {
  const er = useSyncExternalStore(
    abonner,
    () => installert,
    () => false,
  )
  return { installert: er, versjon }
}
