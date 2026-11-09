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

export type JournalSvar =
  | { ok: true; fylt: string[] }
  | {
      ok: false
      grunn: "ingen-fane" | "fant-ikke-felt" | "flere-notater" | "har-innhold" | "skrivebeskyttet" | "feil"
      /** Feltetiketter i Pridok (ved har-innhold / fant-ikke-felt). */
      felt?: string[]
      melding?: string
    }

let installert = false
let versjon: string | null = null
const lyttere = new Set<() => void>()
const ventende = new Map<string, (svar: JournalSvar) => void>()
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
        ferdig(d.svar as JournalSvar)
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

export function sendTilJournal(seksjoner: JournalSeksjoner, modus: JournalModus): Promise<JournalSvar> {
  start()
  const id = crypto.randomUUID()
  return new Promise((resolve) => {
    const tidsavbrudd = setTimeout(() => {
      ventende.delete(id)
      resolve({ ok: false, grunn: "feil", melding: "Utvidelsen svarte ikke." })
    }, 15_000)
    ventende.set(id, (svar) => {
      clearTimeout(tidsavbrudd)
      resolve(svar ?? { ok: false, grunn: "feil", melding: "Tomt svar fra utvidelsen." })
    })
    window.postMessage(
      { kilde: FRA_SIDEN, type: "send-til-journal", id, felter: seksjoner, modus },
      window.location.origin,
    )
  })
}

export function useJournalUtvidelse(): { installert: boolean; versjon: string | null } {
  const er = useSyncExternalStore(
    abonner,
    () => installert,
    () => false,
  )
  return { installert: er, versjon }
}
