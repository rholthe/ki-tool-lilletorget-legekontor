"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Phone,
  Users,
  Stethoscope,
  Settings,
  LogOut,
  Trash2,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  hentAlleKonsultasjoner,
  nyKonsultasjon,
  lagreKonsultasjon,
  slettAlleKonsultasjoner,
  slettUtlopteKonsultasjoner,
} from "@/lib/idb"
import {
  type Konsultasjon,
  type KonsultasjonsType,
  TYPE_LABELS,
} from "@/types/konsultasjon"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"

interface AppSidebarProps {
  brukerNavn: string | null
  brukerEpost: string | null
}

const NY_KNAPPER: {
  type: KonsultasjonsType
  ikon: React.ReactNode
  farge: string
}[] = [
  {
    type: "KONSULTASJON",
    ikon: <Stethoscope className="w-4 h-4" />,
    farge: "bg-blue-600 hover:bg-blue-700",
  },
  {
    type: "TELEFONKONSULTASJON",
    ikon: <Phone className="w-4 h-4" />,
    farge: "bg-violet-600 hover:bg-violet-700",
  },
  {
    type: "DIALOGMOTE_NAV",
    ikon: <Users className="w-4 h-4" />,
    farge: "bg-emerald-600 hover:bg-emerald-700",
  },
]

function gjenvaerendeTimer(expiresAt: number): string {
  const ms = expiresAt - Date.now()
  if (ms <= 0) return "utløpt"
  const timer = Math.floor(ms / (1000 * 60 * 60))
  const min = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (timer > 0) return `${timer}t ${min}m`
  return `${min}m`
}

function statusFarger(status: Konsultasjon["status"]): string {
  switch (status) {
    case "opptar":
      return "bg-red-100 text-red-700"
    case "prosesserer":
      return "bg-amber-100 text-amber-700"
    case "ferdig":
      return "bg-green-100 text-green-700"
    default:
      return "bg-slate-100 text-slate-600"
  }
}

function statusTekst(status: Konsultasjon["status"]): string {
  switch (status) {
    case "opptar":
      return "Opptar"
    case "prosesserer":
      return "Prosesserer"
    case "ferdig":
      return "Ferdig"
    default:
      return "Ny"
  }
}

export function AppSidebar({ brukerNavn, brukerEpost }: AppSidebarProps) {
  const [konsultasjoner, setKonsultasjoner] = useState<Konsultasjon[]>([])
  const { aktiv, setAktiv } = useKonsultasjon()
  const pathname = usePathname()

  const lastKonsultasjoner = useCallback(async () => {
    await slettUtlopteKonsultasjoner()
    const liste = await hentAlleKonsultasjoner()
    setKonsultasjoner(liste)
  }, [])

  useEffect(() => {
    lastKonsultasjoner()
    const intervall = setInterval(lastKonsultasjoner, 60_000)
    return () => clearInterval(intervall)
  }, [lastKonsultasjoner])

  async function opprettNy(type: KonsultasjonsType) {
    const ny = nyKonsultasjon(type)
    await lagreKonsultasjon(ny)
    await lastKonsultasjoner()
    setAktiv(ny)
  }

  async function slettAlle() {
    if (!confirm("Slette alle konsultasjoner? Kan ikke angres.")) return
    await slettAlleKonsultasjoner()
    setAktiv(null)
    setKonsultasjoner([])
  }

  const visNavn = brukerNavn ?? brukerEpost?.split("@")[0] ?? "Bruker"

  return (
    <aside className="w-64 flex flex-col h-screen bg-white border-r border-slate-200 shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">LA</span>
          </div>
          <span className="font-semibold text-slate-800 text-base">
            legeassist
          </span>
        </div>
        <div className="text-xs text-slate-500 truncate">{visNavn}</div>
      </div>

      {/* Ny konsultasjon-knapper */}
      <div className="px-3 py-3 space-y-1.5">
        {NY_KNAPPER.map(({ type, ikon, farge }) => (
          <button
            key={type}
            onClick={() => opprettNy(type)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white text-sm font-medium transition-colors ${farge}`}
          >
            {ikon}
            <span>+ {TYPE_LABELS[type]}</span>
          </button>
        ))}
      </div>

      <Separator />

      {/* Konsultasjonsliste */}
      <div className="px-3 py-2">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-1">
          Siste 24 timer
        </p>
      </div>

      <ScrollArea className="flex-1 px-2">
        {konsultasjoner.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 px-3">
            Ingen konsultasjoner ennå
          </p>
        ) : (
          <div className="space-y-1 pb-2">
            {konsultasjoner.map((k) => (
              <button
                key={k.id}
                onClick={() => setAktiv(k)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors group ${
                  aktiv?.id === k.id
                    ? "bg-blue-50 border border-blue-200"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-medium text-slate-700 truncate leading-tight">
                    {k.pasientId || "Uten ID"}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium ${statusFarger(k.status)}`}
                  >
                    {statusTekst(k.status)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {TYPE_LABELS[k.type]}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-slate-300" />
                  <span className="text-[10px] text-slate-400">
                    Slettes om {gjenvaerendeTimer(k.expiresAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <Separator />

      {/* Bunn */}
      <div className="px-3 py-3 space-y-1">
        <Link
          href="/innstillinger"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === "/innstillinger"
              ? "bg-slate-100 text-slate-900 font-medium"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Settings className="w-4 h-4" />
          Innstillinger
        </Link>

        {konsultasjoner.length > 0 && (
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <button
                onClick={slettAlle}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Slett alle
              </button>
            </TooltipTrigger>
            <TooltipContent>Sletter alle lokale konsultasjoner</TooltipContent>
          </Tooltip>
        )}

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logg ut
        </button>
      </div>
    </aside>
  )
}
