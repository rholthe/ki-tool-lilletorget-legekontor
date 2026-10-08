"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { signOut } from "next-auth/react"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AKTIVITET_HENDELSE, SIST_AKTIV_NOKKEL } from "@/lib/aktivitet"
import { INAKTIV_GRENSE_MS, INAKTIV_VARSEL_MS, PULS_INTERVALL_MS, type UtloggingGrunn } from "@/lib/okt"

const SJEKK_INTERVALL_MS = 15_000
const BRUKERHENDELSER = ["keydown", "pointerdown", "pointermove", "wheel", "touchstart", "scroll"] as const

function lesDelt(): number {
  try {
    return Number(localStorage.getItem(SIST_AKTIV_NOKKEL)) || 0
  } catch {
    return 0
  }
}

/**
 * Innloggingsvakt: logger ut etter en time uten aktivitet. Konsultasjonene
 * slettes ikke — nøkkelen forsvinner fra minnet når siden lastes på nytt, så de
 * er låst til neste innlogging. Varsler fem minutter før, og sender livstegn til
 * serveren mens brukeren er aktiv (serveren har samme grense, se lib/okt.ts).
 * Aktivitet deles mellom faner via localStorage.
 */
export function OktVakt() {
  const sistAktiv = useRef(0)
  const sistDelt = useRef(0)
  const sistPuls = useRef(0)
  const loggerUt = useRef(false)
  const [igjenMs, setIgjenMs] = useState<number | null>(null)

  const loggUt = useCallback((grunn: UtloggingGrunn) => {
    if (loggerUt.current) return
    loggerUt.current = true
    signOut({ redirectTo: `/login?grunn=${grunn}` })
  }, [])

  const merkAktiv = useCallback(() => {
    const naa = Date.now()
    sistAktiv.current = naa
    if (naa - sistDelt.current > 10_000) {
      sistDelt.current = naa
      try {
        localStorage.setItem(SIST_AKTIV_NOKKEL, String(naa))
      } catch {
        /* privat modus o.l. — vakten virker likevel i denne fanen */
      }
    }
  }, [])

  const sjekk = useCallback(async () => {
    const naa = Date.now()
    const sist = Math.max(sistAktiv.current, lesDelt())
    const inaktiv = naa - sist

    if (inaktiv >= INAKTIV_GRENSE_MS) return loggUt("inaktiv")
    setIgjenMs(inaktiv >= INAKTIV_GRENSE_MS - INAKTIV_VARSEL_MS ? INAKTIV_GRENSE_MS - inaktiv : null)

    // Livstegn bare når brukeren har vært aktiv siden forrige
    if (naa - sistPuls.current >= PULS_INTERVALL_MS && sist > sistPuls.current) {
      sistPuls.current = naa
      try {
        const res = await fetch("/api/okt/puls", { method: "POST", cache: "no-store" })
        // Serveren har avsluttet økten (dagsgrense e.l.) — lås her også
        if (res.status === 401 || res.redirected) loggUt("utlopt")
      } catch {
        /* nettverksfeil: prøv igjen ved neste intervall */
      }
    }
  }, [loggUt])

  useEffect(() => {
    merkAktiv()
    sistPuls.current = Date.now()
    const valg = { passive: true, capture: true }
    for (const h of BRUKERHENDELSER) window.addEventListener(h, merkAktiv, valg)
    window.addEventListener(AKTIVITET_HENDELSE, merkAktiv)
    // Bakgrunnsfaner får strupet timere — sjekk med en gang fanen blir synlig
    const vedSynlig = () => { if (document.visibilityState === "visible") sjekk() }
    document.addEventListener("visibilitychange", vedSynlig)
    const intervall = setInterval(sjekk, SJEKK_INTERVALL_MS)
    return () => {
      for (const h of BRUKERHENDELSER) window.removeEventListener(h, merkAktiv, valg)
      window.removeEventListener(AKTIVITET_HENDELSE, merkAktiv)
      document.removeEventListener("visibilitychange", vedSynlig)
      clearInterval(intervall)
    }
  }, [merkAktiv, sjekk])

  if (igjenMs === null) return null

  const minutter = Math.max(1, Math.ceil(igjenMs / 60_000))
  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[28rem] max-w-[calc(100vw-2rem)] rounded-xl border border-amber-200 bg-amber-50 shadow-lg px-4 py-3 flex items-center gap-3">
      <Clock className="w-5 h-5 text-amber-600 shrink-0" />
      <p className="text-sm text-amber-900 flex-1">
        Du logges ut om {minutter} min på grunn av inaktivitet. Konsultasjonene låses, men slettes ikke.
      </p>
      <Button size="sm" onClick={() => { merkAktiv(); setIgjenMs(null) }}>
        Fortsett
      </Button>
    </div>
  )
}
