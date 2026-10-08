"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import { lagreKonsultasjon } from "@/lib/idb"
import type { Konsultasjon } from "@/types/konsultasjon"

interface KonsultasjonContextValue {
  aktiv: Konsultasjon | null
  setAktiv: (k: Konsultasjon | null) => void
  oppdater: (felt: Partial<Konsultasjon>) => Promise<void>
}

const KonsultasjonContext = createContext<KonsultasjonContextValue | null>(null)

export function KonsultasjonProvider({ children }: { children: ReactNode }) {
  const [aktiv, setAktivIntern] = useState<Konsultasjon | null>(null)

  // Ref holder alltid ferskeste aktiv — unngår stale-closure-bug i async callbacks
  const aktivRef = useRef(aktiv)
  aktivRef.current = aktiv

  const setAktiv = useCallback((k: Konsultasjon | null) => {
    setAktivIntern(k)
  }, [])

  const oppdater = useCallback(async (felt: Partial<Konsultasjon>) => {
    const current = aktivRef.current
    if (!current) return
    const oppdatert = { ...current, ...felt }
    setAktivIntern(oppdatert)
    await lagreKonsultasjon(oppdatert)
  }, []) // ingen aktiv-dependency — bruker ref for å alltid lese ferskeste verdi

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
