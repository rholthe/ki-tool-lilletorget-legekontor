"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import type { HapiStatus as Status } from "@/lib/hapi/retningslinjer-server"

function tid(iso: string | null): string {
  if (!iso) return "–"
  return new Date(iso).toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function HapiStatus({ status: start }: { status: Status }) {
  const [status, setStatus] = useState(start)
  const [henter, setHenter] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)

  async function oppdater() {
    setHenter(true)
    setFeil(null)
    try {
      const res = await fetch("/api/admin/retningslinjer", { method: "POST" })
      const data = await res.json()
      setStatus(data)
      if (!res.ok) setFeil(data.feil ?? "Henting feilet")
    } catch {
      setFeil("Kunne ikke nå serveren")
    } finally {
      setHenter(false)
    }
  }

  const ok = status.hentetAt && !status.sisteFeil

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">HELSEDIR_API_KEY</span>
        {status.nokkelSatt ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            Konfigurert
          </span>
        ) : (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
            Mangler
          </span>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Antibiotika i primærhelsetjenesten</dt>
        <dd className="text-slate-700">
          {status.antallTilstander !== null
            ? `${status.antallTilstander} tilstander`
            : "Ikke hentet ennå — reservekopien i appen brukes"}
        </dd>
        <dt className="text-slate-500">Sist hentet</dt>
        <dd className="text-slate-700">{tid(status.hentetAt)}</dd>
        <dt className="text-slate-500">Faglig oppdatert hos kilden</dt>
        <dd className="text-slate-700">{tid(status.sistFagligOppdatert)}</dd>
      </dl>

      {status.sisteFeil && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Siste forsøk ({tid(status.sisteForsokAt)}) feilet: {status.sisteFeil}. Forrige
            versjon vises fortsatt.
          </span>
        </div>
      )}
      {feil && !status.sisteFeil && (
        <p className="text-sm text-red-700">{feil}</p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={oppdater} disabled={henter || !status.nokkelSatt} variant="outline" size="sm">
          {henter ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Hent nå
        </Button>
        {ok && !henter && (
          <span className="inline-flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> OK
          </span>
        )}
      </div>
    </div>
  )
}
