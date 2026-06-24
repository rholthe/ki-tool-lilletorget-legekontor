"use client"

import { useEffect, useRef } from "react"

export interface Hurtigtast {
  /** Fysisk tast via KeyboardEvent.code (layout-uavhengig), f.eks. "KeyR", "Digit1". */
  code: string
  handler: () => void
  /** Hopp over snarveien når false (uten å fjerne lytteren). Default true. */
  enabled?: boolean
}

/**
 * Globale Alt-baserte hurtigtaster. Alle snarveier krever Alt (men ikke Ctrl/Meta),
 * slik at de aldri kolliderer med vanlig skriving — derfor trengs ingen tekstfelt-vakt.
 * Bruker KeyboardEvent.code så bindingene er uavhengige av tastaturoppsett.
 */
export function useHurtigtaster(snarveier: Hurtigtast[]) {
  const ref = useRef(snarveier)

  // Hold snarveiene ferske uten å re-abonnere lytteren (oppdateres etter render).
  useEffect(() => {
    ref.current = snarveier
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      if (e.repeat) return
      const treff = ref.current.find(
        (s) => s.code === e.code && (s.enabled ?? true)
      )
      if (!treff) return
      e.preventDefault()
      treff.handler()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
