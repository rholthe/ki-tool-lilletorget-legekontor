"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertTriangle, Check, Loader2, RefreshCw, Search } from "lucide-react"
import type { HapiRadStatus, HapiStatus as Status } from "@/lib/hapi/retningslinjer-server"

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

function dato(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("nb-NO")
}

function RadStatus({ rad, enhet }: { rad: HapiRadStatus; enhet: string }) {
  return (
    <div className="py-2 border-t border-slate-100 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-slate-800">{rad.navn}</span>
        <span className="text-xs text-slate-500 shrink-0">
          {rad.henter ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> henter
            </span>
          ) : rad.hentetAt ? (
            rad.antall === 0 ? (
              <span className="text-amber-700">ikke i API-et — kun på helsedirektoratet.no</span>
            ) : (
              `${rad.antall ?? "?"} ${enhet} · hentet ${tid(rad.hentetAt)}`
            )
          ) : (
            "ikke hentet ennå"
          )}
        </span>
      </div>
      {rad.sisteFeil && (
        <p className="mt-1 flex gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Siste forsøk ({tid(rad.sisteForsokAt)}) feilet: {rad.sisteFeil}
          {rad.hentetAt ? " — forrige versjon vises fortsatt." : ""}
        </p>
      )}
    </div>
  )
}

export function HapiStatus({ status: start }: { status: Status }) {
  const [status, setStatus] = useState(start)
  const [henter, setHenter] = useState(false)
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [valgt, setValgt] = useState<Set<string>>(
    () => new Set(start.utvalg.map((u) => u.id.replace(/^les:/, "")))
  )
  const [filter, setFilter] = useState("")

  // Mens noe hentes i bakgrunnen, oppdateres statusen fortløpende
  const henterNoe = status.antibiotika.henter || status.utvalg.some((u) => u.henter)
  useEffect(() => {
    if (!henterNoe) return
    const t = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/retningslinjer")
        if (res.ok) setStatus(await res.json())
      } catch {
        // Prøver igjen ved neste intervall
      }
    }, 3000)
    return () => clearInterval(t)
  }, [henterNoe])

  const lagret = useMemo(() => new Set(status.utvalg.map((u) => u.id.replace(/^les:/, ""))), [status])
  const endret = valgt.size !== lagret.size || [...valgt].some((v) => !lagret.has(v))

  const katalog = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return status.katalog.filter((k) => !q || `${k.tittel} ${k.kortTittel}`.toLowerCase().includes(q))
  }, [status.katalog, filter])

  async function kall(metode: "POST" | "PUT", body?: unknown) {
    setFeil(null)
    try {
      const res = await fetch("/api/admin/retningslinjer", {
        method: metode,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (data?.katalog) setStatus(data)
      if (!res.ok) setFeil(data.feil ?? "Noe gikk galt")
    } catch {
      setFeil("Kunne ikke nå serveren")
    }
  }

  async function hentNaa() {
    setHenter(true)
    await kall("POST")
    setHenter(false)
  }

  async function lagreUtvalg() {
    setLagrer(true)
    await kall("PUT", { ider: [...valgt] })
    setLagrer(false)
  }

  function veksle(id: string) {
    setValgt((prev) => {
      const ny = new Set(prev)
      if (ny.has(id)) ny.delete(id)
      else ny.add(id)
      return ny
    })
  }

  return (
    <div className="space-y-6">
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

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</h3>
        <div className="rounded-lg border border-slate-200 px-3">
          <RadStatus rad={status.antibiotika} enhet="tilstander" />
          {status.utvalg.map((r) => (
            <RadStatus key={r.id} rad={r} enhet="sider" />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={hentNaa} disabled={henter || !status.nokkelSatt} variant="outline" size="sm">
            {henter ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Hent alt nå
          </Button>
          <span className="text-xs text-slate-400">
            Ellers oppdateres alt automatisk når det er eldre enn et døgn.
          </span>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Retningslinjer til oppslag ({valgt.size} valgt)
        </h3>
        <p className="text-xs text-slate-500">
          Vises i fanen «Andre retningslinjer» i Kliniske verktøy. Nye valg hentes med en gang du
          lagrer. Noen retningslinjer har ikke innholdet sitt i API-et og vises da bare som lenke.
        </p>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer…"
            className="pl-8 text-sm"
          />
        </div>
        <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
          {katalog.length === 0 && (
            <p className="p-3 text-sm text-slate-400 italic">
              {status.katalog.length === 0 ? "Katalogen er ikke hentet ennå." : "Ingen treff."}
            </p>
          )}
          {katalog.map((k) => {
            const erValgt = valgt.has(k.id)
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => veksle(k.id)}
                className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span
                  className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                    erValgt ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
                  }`}
                >
                  {erValgt && <Check className="w-3 h-3" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-slate-800">{k.kortTittel}</span>
                  <span className="block text-xs text-slate-400">
                    {k.tittel !== k.kortTittel ? `${k.tittel} · ` : ""}
                    faglig oppdatert {dato(k.sistFagligOppdatert)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={lagreUtvalg} disabled={!endret || lagrer} size="sm">
            {lagrer && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Lagre utvalg
          </Button>
          {endret && <span className="text-xs text-amber-700">Ulagrede endringer</span>}
        </div>
      </section>

      {feil && <p className="text-sm text-red-700">{feil}</p>}
    </div>
  )
}
