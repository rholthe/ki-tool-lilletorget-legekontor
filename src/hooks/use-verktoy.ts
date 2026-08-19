"use client"

import { useCallback } from "react"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import { synkVerktoySeksjon } from "@/lib/verktoy/beregn"
import type { VerktoyResultat } from "@/lib/verktoy/typer"

/**
 * Utførte kliniske verktøy på den aktive konsultasjonen.
 *
 * Resultatene lagres strukturert (IndexedDB via `oppdater`), og notatets
 * verktøyseksjon synkroniseres på nytt ved hver endring. Fordi
 * `synkVerktoySeksjon` er idempotent, gir gjentatte lagringer og regenerering av
 * notatet aldri duplikater.
 */
export function useVerktoy() {
  const { aktiv, oppdater } = useKonsultasjon()
  const resultater = aktiv?.verktoyResultater ?? []

  const skrivResultater = useCallback(
    async (nye: VerktoyResultat[]) => {
      await oppdater({
        verktoyResultater: nye,
        notat: synkVerktoySeksjon(aktiv?.notat ?? "", nye),
      })
    },
    [aktiv?.notat, oppdater]
  )

  const lagreResultat = useCallback(
    async (resultat: VerktoyResultat) => {
      const eksisterende = aktiv?.verktoyResultater ?? []
      const finnes = eksisterende.some((r) => r.id === resultat.id)
      const nye = finnes
        ? eksisterende.map((r) => (r.id === resultat.id ? resultat : r))
        : [...eksisterende, resultat]
      await skrivResultater(nye)
    },
    [aktiv?.verktoyResultater, skrivResultater]
  )

  const slettResultat = useCallback(
    async (id: string) => {
      const nye = (aktiv?.verktoyResultater ?? []).filter((r) => r.id !== id)
      await skrivResultater(nye)
    },
    [aktiv?.verktoyResultater, skrivResultater]
  )

  return { resultater, lagreResultat, slettResultat }
}
