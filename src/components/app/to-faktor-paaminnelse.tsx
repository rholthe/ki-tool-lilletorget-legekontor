"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck, X } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const LAGRINGSNOKKEL = "legeassist:2fa-paaminnelse-sist"
const INTERVALL_MS = 30 * 24 * 60 * 60 * 1000 // ~1 måned
const INTERVALL_MED_FRIST_MS = 20 * 60 * 60 * 1000 // daglig når 2FA snart blir obligatorisk

interface Props {
  er2FAaktivert: boolean
  /** F.eks. «fredag 16. oktober» når admin har satt en frist som ikke er nådd ennå. */
  fristTekst?: string | null
}

/**
 * Diskret påminnelse om å aktivere 2FA. Vises kun for brukere uten 2FA,
 * og maks ca. én gang i måneden (huskes i localStorage). Lukkes/utsettes
 * uten å avbryte arbeidsflyten.
 */
export function ToFaktorPaaminnelse({ er2FAaktivert, fristTekst }: Props) {
  const [vis, setVis] = useState(false)

  useEffect(() => {
    if (er2FAaktivert) return
    const sist = localStorage.getItem(LAGRINGSNOKKEL)
    const intervall = fristTekst ? INTERVALL_MED_FRIST_MS : INTERVALL_MS
    if (!sist || Date.now() - Number(sist) > intervall) {
      setVis(true)
    }
  }, [er2FAaktivert, fristTekst])

  function utsett() {
    localStorage.setItem(LAGRINGSNOKKEL, String(Date.now()))
    setVis(false)
  }

  if (!vis) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg p-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
        </div>
        <div className="space-y-1 flex-1">
          <p className="text-sm font-semibold text-slate-800">
            Sikre kontoen din
          </p>
          <p className="text-xs text-slate-500">
            {fristTekst
              ? `To-faktor blir obligatorisk fra ${fristTekst}. Aktiver det nå, så blir du ikke stoppet ved innlogging da.`
              : "Du har ikke aktivert to-faktor-autentisering. Det gir kontoen din et ekstra lag med beskyttelse."}
          </p>
        </div>
        <button
          onClick={utsett}
          aria-label="Lukk"
          className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <Button variant="ghost" size="sm" onClick={utsett}>
          Senere
        </Button>
        <Link
          href="/innstillinger"
          onClick={utsett}
          className={cn(
            buttonVariants({ size: "sm" }),
            "bg-blue-600 hover:bg-blue-700 text-white"
          )}
        >
          Aktiver 2FA
        </Link>
      </div>
    </div>
  )
}
