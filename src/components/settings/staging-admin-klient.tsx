"use client"

import { useState, useEffect, useCallback } from "react"
import { ShieldCheck, RotateCcw, Check, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface StagingOppføring {
  key: string
  gruppe: "Notattyper" | "Vedlegg" | "Felles"
  label: string
  beskrivelse: string
  standard: string
  verdi: string
  erOverstyrt: boolean
}

const GRUPPER: StagingOppføring["gruppe"][] = ["Notattyper", "Vedlegg", "Felles"]

export function StagingAdminKlient() {
  const [oppføringer, setOppføringer] = useState<StagingOppføring[]>([])
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [utkast, setUtkast] = useState<Record<string, string>>({})
  const [apen, setApen] = useState<Set<string>>(new Set())
  const [lagrer, setLagrer] = useState<string | null>(null)

  const last = useCallback(async () => {
    setLaster(true)
    try {
      const res = await fetch("/api/admin/staging")
      if (!res.ok) throw new Error()
      const data: StagingOppføring[] = await res.json()
      setOppføringer(data)
      setUtkast(Object.fromEntries(data.map((e) => [e.key, e.verdi])))
    } catch {
      setFeil("Kunne ikke laste staging-tekster (krever admin-tilgang).")
    } finally {
      setLaster(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { last() }, [last])

  function toggle(key: string) {
    setApen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function lagre(key: string) {
    setLagrer(key)
    setFeil(null)
    try {
      const res = await fetch("/api/admin/staging", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, verdi: utkast[key] ?? "" }),
      })
      if (!res.ok) throw new Error()
      await last()
    } catch {
      setFeil("Kunne ikke lagre. Sjekk at teksten ikke er tom.")
    } finally {
      setLagrer(null)
    }
  }

  async function tilbakestill(key: string) {
    if (!confirm("Tilbakestille til standardteksten? Admin-overstyringen slettes.")) return
    setLagrer(key)
    setFeil(null)
    try {
      const res = await fetch(`/api/admin/staging?key=${encodeURIComponent(key)}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      await last()
    } catch {
      setFeil("Kunne ikke tilbakestille.")
    } finally {
      setLagrer(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 space-y-0.5">
          <p className="font-medium">Systemprompter (staging) — kun admin</p>
          <p>
            Disse styrer hva Claude blir bedt om for alle brukere. Tom override = fil-standard brukes.
            Felles «Stikkord-instruksjon» må beholde <code className="bg-amber-100 px-1 rounded">STIKKORD:</code>-formatet,
            og chat/AI-hjelp må beholde <code className="bg-amber-100 px-1 rounded">{"{KONTEKST}"}</code>.
          </p>
        </div>
      </div>

      {feil && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{feil}</span>
        </div>
      )}

      {laster ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        GRUPPER.map((gruppe) => {
          const iGruppe = oppføringer.filter((e) => e.gruppe === gruppe)
          if (iGruppe.length === 0) return null
          return (
            <section key={gruppe} className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{gruppe}</h3>
              <ul className="space-y-2">
                {iGruppe.map((e) => {
                  const erApen = apen.has(e.key)
                  const endret = (utkast[e.key] ?? e.verdi) !== e.verdi
                  return (
                    <li key={e.key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <button
                        onClick={() => toggle(e.key)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                      >
                        {erApen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                        <span className="text-sm font-medium text-slate-700 flex-1 min-w-0 truncate">{e.label}</span>
                        <span
                          className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            e.erOverstyrt
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {e.erOverstyrt ? "Overstyrt" : "Standard"}
                        </span>
                      </button>

                      {erApen && (
                        <div className="px-4 pb-4 space-y-2 border-t border-slate-100 pt-3">
                          <p className="text-xs text-slate-400">{e.beskrivelse}</p>
                          <Textarea
                            value={utkast[e.key] ?? ""}
                            onChange={(ev) => setUtkast((prev) => ({ ...prev, [e.key]: ev.target.value }))}
                            className="resize-y text-xs font-mono min-h-40 border-slate-200"
                          />
                          <div className="flex items-center justify-end gap-2">
                            {e.erOverstyrt && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs text-slate-500"
                                disabled={lagrer === e.key}
                                onClick={() => tilbakestill(e.key)}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Tilbakestill til standard
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                              disabled={lagrer === e.key || !endret || !(utkast[e.key] ?? "").trim()}
                              onClick={() => lagre(e.key)}
                            >
                              <Check className="w-3.5 h-3.5" />
                              {lagrer === e.key ? "Lagrer…" : "Lagre override"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
