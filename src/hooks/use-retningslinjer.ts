"use client"

import { useEffect, useState } from "react"
import type { Retningslinje } from "@/lib/verktoy/typer"

/**
 * Retningslinjer fra Helsedirektoratet, via vår server (`/api/retningslinjer`).
 *
 * Hentes én gang per sidevisning og deles mellom alle som bruker hooken. Feiler
 * hentingen, prøves den på nytt neste gang modalen åpnes.
 */

let lager: Retningslinje[] | null = null
let pagaende: Promise<Retningslinje[]> | null = null

function hent(): Promise<Retningslinje[]> {
  if (!pagaende) {
    pagaende = fetch("/api/retningslinjer")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`)
        const data = (await res.json()) as { retningslinjer: Retningslinje[] }
        lager = data.retningslinjer
        return lager
      })
      .catch((e) => {
        pagaende = null
        throw e
      })
  }
  return pagaende
}

export function useRetningslinjer() {
  const [retningslinjer, setRetningslinjer] = useState<Retningslinje[]>(lager ?? [])
  const [laster, setLaster] = useState(lager === null)
  const [feil, setFeil] = useState(false)

  useEffect(() => {
    if (lager) return
    let aktiv = true
    hent()
      .then((r) => {
        if (aktiv) setRetningslinjer(r)
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

  return { retningslinjer, laster, feil }
}
