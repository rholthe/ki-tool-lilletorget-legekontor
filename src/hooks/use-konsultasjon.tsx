"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { lagreKonsultasjon, hentKonsultasjon } from "@/lib/idb"
import type { Konsultasjon } from "@/types/konsultasjon"

interface KonsultasjonContextValue {
  aktiv: Konsultasjon | null
  setAktiv: (k: Konsultasjon | null) => void
  oppdater: (felt: Partial<Konsultasjon>) => Promise<void>
}

const KonsultasjonContext = createContext<KonsultasjonContextValue | null>(null)

export function KonsultasjonProvider({ children }: { children: ReactNode }) {
  const [aktiv, setAktivIntern] = useState<Konsultasjon | null>(null)

  const setAktiv = useCallback((k: Konsultasjon | null) => {
    setAktivIntern(k)
  }, [])

  const oppdater = useCallback(
    async (felt: Partial<Konsultasjon>) => {
      if (!aktiv) return
      const oppdatert = { ...aktiv, ...felt }
      setAktivIntern(oppdatert)
      await lagreKonsultasjon(oppdatert)
    },
    [aktiv]
  )

  return (
    <KonsultasjonContext.Provider value={{ aktiv, setAktiv, oppdater }}>
      {children}
    </KonsultasjonContext.Provider>
  )
}

export function useKonsultasjon(): KonsultasjonContextValue {
  const ctx = useContext(KonsultasjonContext)
  if (!ctx)
    throw new Error("useKonsultasjon må brukes inne i KonsultasjonProvider")
  return ctx
}
