"use client"

import { useState } from "react"
import {
  Mic,
  MicOff,
  Pause,
  Square,
  FileText,
  RefreshCw,
  MessageSquare,
  Copy,
  Paperclip,
  ChevronDown,
  Stethoscope,
  Phone,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import { TYPE_LABELS, TYPE_STAGING } from "@/types/konsultasjon"

const TYPE_IKON = {
  KONSULTASJON: <Stethoscope className="w-3.5 h-3.5" />,
  TELEFONKONSULTASJON: <Phone className="w-3.5 h-3.5" />,
  DIALOGMOTE_NAV: <Users className="w-3.5 h-3.5" />,
}

const TYPE_FARGE = {
  KONSULTASJON: "bg-blue-100 text-blue-700 border-blue-200",
  TELEFONKONSULTASJON: "bg-violet-100 text-violet-700 border-violet-200",
  DIALOGMOTE_NAV: "bg-emerald-100 text-emerald-700 border-emerald-200",
}

export function KonsultasjonView() {
  const { aktiv, oppdater } = useKonsultasjon()
  const [kopiert, setKopiert] = useState(false)

  if (!aktiv) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto">
            <Stethoscope className="w-7 h-7 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700">
            Ingen aktiv konsultasjon
          </h2>
          <p className="text-sm text-slate-400">
            Klikk en av knappene i sidepanelet for å starte en ny konsultasjon.
          </p>
        </div>
      </div>
    )
  }

  async function kopierNotat() {
    if (!aktiv?.notat) return
    await navigator.clipboard.writeText(aktiv.notat)
    setKopiert(true)
    setTimeout(() => setKopiert(false), 2000)
  }

  const erFerdig = aktiv.status === "ferdig"
  const harNotat = Boolean(aktiv.notat)

  return (
    <div className="h-full flex flex-col">
      {/* Topprad: type-badge + pasient-ID */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-4">
        <Badge
          variant="outline"
          className={`flex items-center gap-1.5 text-xs font-medium ${TYPE_FARGE[aktiv.type]}`}
        >
          {TYPE_IKON[aktiv.type]}
          {TYPE_LABELS[aktiv.type]}
        </Badge>
        <Input
          placeholder="Pasient / Notat-ID (f.eks. Frank Hansen 210182)"
          value={aktiv.pasientId}
          onChange={(e) => oppdater({ pasientId: e.target.value })}
          className="max-w-xs text-sm border-slate-200"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Kontekst + Tilleggsinfo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Kontekst
            </label>
            <Textarea
              placeholder="Lim inn epikriser, tidligere journalnotater eller annen relevant bakgrunn..."
              value={aktiv.kontekst}
              onChange={(e) => oppdater({ kontekst: e.target.value })}
              className="resize-none text-sm h-28 border-slate-200"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Tilleggsinfo
            </label>
            <Textarea
              placeholder="Blodprøvesvar, målinger, observasjoner eller annet som ikke fremgår av samtalen..."
              value={aktiv.tilleggsinfo}
              onChange={(e) => oppdater({ tilleggsinfo: e.target.value })}
              className="resize-none text-sm h-28 border-slate-200"
            />
          </div>
        </div>

        {/* Vedlegg + Mal-velger */}
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger>
              <Button variant="outline" size="sm" className="gap-2 text-sm">
                <Paperclip className="w-4 h-4" />
                Bilder / PDF
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Last opp EKG, spirometri, lab-utskrifter eller bilder (kommer snart)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button variant="outline" size="sm" className="gap-2 text-sm">
                <FileText className="w-4 h-4" />
                {aktiv.malId ? "Bytt mal" : "Velg notatmal"}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Velg systemprompt / notatmal (kommer snart)</TooltipContent>
          </Tooltip>

          <p className="text-xs text-slate-400 italic ml-1">
            Staging: {TYPE_STAGING[aktiv.type].substring(0, 60)}…
          </p>
        </div>

        {/* Opptakskontroller */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              disabled
            >
              <Mic className="w-4 h-4" />
              Start opptak
            </Button>
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <Pause className="w-4 h-4" />
              Pause
            </Button>
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <Square className="w-4 h-4" />
              Stopp & Send
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-200" />
              <span className="text-xs text-slate-400">
                {aktiv.status === "ny"
                  ? "Klar til opptak"
                  : aktiv.status === "opptar"
                    ? "Opptar..."
                    : aktiv.status === "prosesserer"
                      ? "Prosesserer..."
                      : "Ferdig"}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            AssemblyAI-integrasjon implementeres i neste steg.
          </p>
        </div>

        <Separator />

        {/* Handlingsknapper */}
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-sm"
                disabled={!aktiv.transkript}
              >
                <FileText className="w-4 h-4" />
                Transkript
              </Button>
            </TooltipTrigger>
            <TooltipContent>Vis fullstendig transkript</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-sm"
                disabled={!harNotat}
              >
                <RefreshCw className="w-4 h-4" />
                Regenerer
              </Button>
            </TooltipTrigger>
            <TooltipContent>Regenerer notat med gjeldende mal</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-sm"
                disabled={!harNotat}
              >
                <MessageSquare className="w-4 h-4" />
                Chat / AI-hjelp
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Spør AI om konsultasjonen — skriv henvisning, legg til diagnoser etc.
            </TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          <Tooltip>
            <TooltipTrigger>
              <Button
                size="sm"
                className="gap-1.5 text-sm bg-slate-800 hover:bg-slate-900"
                disabled={!harNotat}
                onClick={kopierNotat}
              >
                <Copy className="w-4 h-4" />
                {kopiert ? "Kopiert!" : "Kopier notat"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Kopier notat til utklippstavlen</TooltipContent>
          </Tooltip>
        </div>

        {/* Notatvisning */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Generert notat
          </label>
          <Textarea
            placeholder="Notat genereres her etter at konsultasjonen er tatt opp og sendt til AI..."
            value={aktiv.notat}
            onChange={(e) => oppdater({ notat: e.target.value })}
            className="min-h-48 text-sm border-slate-200 font-mono"
          />
        </div>
      </div>
    </div>
  )
}
