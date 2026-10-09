"use client"

import { useEffect, useState } from "react"
import type { LeseRetningslinje, Retningslinje } from "@/lib/verktoy/typer"

/**
 * Retningslinjer fra Helsedirektoratet, via vår server (`/api/retningslinjer`).
 *
 * Hentes én gang per sidevisning og deles mellom alle som bruker hooken. Feiler
 * hentingen, prøves den på nytt neste gang modalen åpnes.
 */

interface Svar {
  retningslinjer: Retningslinje[]
  /** Innholdsfortegnelser uten brødtekst — teksten hentes med `useLeseRetningslinje`. */
  lese: LeseRetningslinje[]
  /** Valgte retningslinjer serveren ennå ikke har hentet. */
  leseVenter: number
}

let lager: Svar | null = null
let pagaende: Promise<Svar> | null = null

function hent(): Promise<Svar> {
  if (!pagaende) {
    // `no-store` også her, ikke bare i svaret: en nettleser som har et svar lagret fra
    // før (da ruten sendte max-age=3600), ville ellers brukt det til det utløp
    pagaende = fetch("/api/retningslinjer", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`)
        const data = (await res.json()) as Partial<Svar>
        const svar = {
          retningslinjer: data.retningslinjer ?? [],
          lese: data.lese ?? [],
          leseVenter: data.leseVenter ?? 0,
        }
        // Mangler noe ennå, spør på nytt neste gang modalen åpnes
        if (svar.leseVenter > 0) pagaende = null
        else lager = svar
        return svar
      })
      .catch((e) => {
        pagaende = null
        throw e
      })
  }
  return pagaende
}

export function useRetningslinjer() {
  const [svar, setSvar] = useState<Svar>(lager ?? { retningslinjer: [], lese: [], leseVenter: 0 })
  const [laster, setLaster] = useState(lager === null)
  const [feil, setFeil] = useState(false)

  useEffect(() => {
    if (lager) return
    let aktiv = true
    hent()
      .then((r) => {
        if (aktiv) setSvar(r)
      })
      .catch(() => {
        if (aktiv) setFeil(true)
      })
      .finally(() => {
        if (aktiv) setLaster(false)
      })
    return () => {
      aktiv = false
    }
  }, [])

  return { retningslinjer: svar.retningslinjer, lese: svar.lese, leseVenter: svar.leseVenter, laster, feil }
}

// ─── Full tekst for én retningslinje ──────────────────────────────────────────

const fullLager = new Map<string, LeseRetningslinje>()
const fullPagaende = new Map<string, Promise<LeseRetningslinje>>()

/** Hele retningslinjen med tekst (fra minnet hvis den er hentet før). */
export function hentFull(id: string): Promise<LeseRetningslinje> {
  const lagret = fullLager.get(id)
  if (lagret) return Promise.resolve(lagret)
  let p = fullPagaende.get(id)
  if (!p) {
    p = fetch(`/api/retningslinjer/les/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`)
        const r = (await res.json()) as LeseRetningslinje
        fullLager.set(id, r)
        return r
      })
      .finally(() => fullPagaende.delete(id))
    fullPagaende.set(id, p)
  }
  return p
}

/** Hele retningslinjen med tekst. Lastes første gang den åpnes, deretter fra minnet. */
export function useLeseRetningslinje(id: string | null) {
  const [, setVersjon] = useState(0)
  const [feil, setFeil] = useState<string | null>(null)
  const full = id ? (fullLager.get(id) ?? null) : null

  useEffect(() => {
    if (!id || fullLager.has(id)) return
    let aktiv = true
    hentFull(id)
      .then(() => {
        if (aktiv) {
          setFeil(null)
          setVersjon((v) => v + 1)
        }
      })
      .catch(() => {
        if (aktiv) setFeil(id)
      })
    return () => {
      aktiv = false
    }
  }, [id])

  return { full, laster: Boolean(id) && !full && feil !== id, feil: feil === id }
}
