"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Share2, Lock, Download, ChevronDown, ChevronUp, Check, X, Sparkles, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PromptbyggerKlient } from "@/components/settings/promptbygger-klient"
import { StagingAdminKlient } from "@/components/settings/staging-admin-klient"

export interface MalData {
  id: string
  tittel: string
  beskrivelse: string | null
  innhold: string
  kategori: "KONSULTASJON" | "MOTE" | "CHAT" | "DIKTAT" | "AIHJELP"
  erDelt: boolean
  createdAt: string
  updatedAt: string
}

interface DeltMalData {
  id: string
  tittel: string
  beskrivelse: string | null
  innhold: string
  kategori: "KONSULTASJON" | "MOTE" | "CHAT" | "DIKTAT" | "AIHJELP"
  eier: { name: string | null; email: string | null }
  createdAt: string
}

type Kategori = "KONSULTASJON" | "MOTE" | "CHAT" | "DIKTAT" | "AIHJELP"

const KATEGORI_FANER: { id: Kategori; label: string }[] = [
  { id: "KONSULTASJON", label: "Konsultasjon" },
  { id: "MOTE", label: "Møte" },
  { id: "DIKTAT", label: "Diktat" },
  { id: "CHAT", label: "Chat" },
  { id: "AIHJELP", label: "AI-hjelp" },
]

interface MalFormData {
  tittel: string
  beskrivelse: string
  innhold: string
  erDelt: boolean
}

const TOM_FORM: MalFormData = { tittel: "", beskrivelse: "", innhold: "", erDelt: false }

export function PromptbibliotekKlient({ erAdmin = false }: { erAdmin?: boolean }) {
  const [maler, setMaler] = useState<MalData[]>([])
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)

  // Delte maler — laster per kategori (lazy)
  const [delteMaler, setDelteMaler] = useState<DeltMalData[]>([])
  const [viserDelte, setViserDelte] = useState(false)
  const [lasterDelte, setLasterDelte] = useState(false)
  const [aktivKategori, setAktivKategori] = useState<Kategori>("KONSULTASJON")
  const [visning, setVisning] = useState<Kategori | "ai" | "staging">("KONSULTASJON")

  // Skjema-state
  const [redigerer, setRedigerer] = useState<string | "ny" | null>(null)
  const [form, setForm] = useState<MalFormData>(TOM_FORM)
  const [lagrer, setLagrer] = useState(false)
  const [formFeil, setFormFeil] = useState<string | null>(null)

  const lastMaler = useCallback(async () => {
    setLaster(true)
    try {
      const res = await fetch("/api/maler")
      if (!res.ok) throw new Error("Kunne ikke laste maler")
      setMaler(await res.json())
    } catch {
      setFeil("Kunne ikke laste promptbiblioteket")
    } finally {
      setLaster(false)
    }
  }, [])

  useEffect(() => { lastMaler() }, [lastMaler])

  async function lastDelteMaler(kategori: Kategori) {
    setLasterDelte(true)
    try {
      const res = await fetch(`/api/maler/delt?kategori=${kategori}`)
      if (!res.ok) throw new Error()
      setDelteMaler(await res.json())
    } catch {
      setDelteMaler([])
    } finally {
      setLasterDelte(false)
    }
  }

  function toggleDelte() {
    if (!viserDelte) {
      lastDelteMaler(aktivKategori)
    }
    setViserDelte((v) => !v)
  }

  function byttKategori(kat: Kategori) {
    setAktivKategori(kat)
    setRedigerer(null)
    setForm(TOM_FORM)
    setFormFeil(null)
    if (viserDelte) lastDelteMaler(kat)
  }

  function byttVisning(v: string) {
    if (v === "ai" || v === "staging") {
      setVisning(v)
      return
    }
    setVisning(v as Kategori)
    byttKategori(v as Kategori)
  }

  // Brukes av promptbyggeren: forhåndsutfyll «Ny mal»-skjemaet i valgt kategori
  function prefyllNyMal(kategoriId: string, innhold: string) {
    const kat = kategoriId as Kategori
    setAktivKategori(kat)
    setVisning(kat)
    setRedigerer("ny")
    setForm({ ...TOM_FORM, innhold })
    setFormFeil(null)
  }

  function startNy() {
    setRedigerer("ny")
    setForm({ ...TOM_FORM })
    setFormFeil(null)
  }

  function startRediger(mal: MalData) {
    setRedigerer(mal.id)
    setForm({ tittel: mal.tittel, beskrivelse: mal.beskrivelse ?? "", innhold: mal.innhold, erDelt: mal.erDelt })
    setFormFeil(null)
  }

  function avbryt() {
    setRedigerer(null)
    setForm(TOM_FORM)
    setFormFeil(null)
  }

  async function lagre() {
    if (!form.tittel.trim() || !form.innhold.trim()) {
      setFormFeil("Tittel og instruksjon er påkrevd")
      return
    }
    setLagrer(true)
    setFormFeil(null)
    try {
      const body = { ...form, kategori: aktivKategori }
      let res: Response
      if (redigerer === "ny") {
        res = await fetch("/api/maler", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      } else {
        res = await fetch(`/api/maler/${redigerer}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      }
      if (!res.ok) throw new Error("Lagring feilet")
      await lastMaler()
      avbryt()
    } catch {
      setFormFeil("Kunne ikke lagre malen")
    } finally {
      setLagrer(false)
    }
  }

  async function slett(id: string) {
    if (!confirm("Slette denne malen? Kan ikke angres.")) return
    try {
      const res = await fetch(`/api/maler/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setMaler((prev) => prev.filter((m) => m.id !== id))
    } catch {
      alert("Kunne ikke slette malen")
    }
  }

  async function importer(mal: DeltMalData) {
    try {
      const res = await fetch(`/api/maler/${mal.id}/importer`, { method: "POST" })
      if (!res.ok) throw new Error()
      await lastMaler()
      alert(`«${mal.tittel}» er lagt til i ditt bibliotek`)
    } catch {
      alert("Kunne ikke importere malen")
    }
  }

  async function toggleDelt(mal: MalData) {
    try {
      const res = await fetch(`/api/maler/${mal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tittel: mal.tittel, beskrivelse: mal.beskrivelse, innhold: mal.innhold, erDelt: !mal.erDelt }),
      })
      if (!res.ok) throw new Error()
      setMaler((prev) => prev.map((m) => m.id === mal.id ? { ...m, erDelt: !mal.erDelt } : m))
    } catch {
      alert("Kunne ikke oppdatere delingstatus")
    }
  }

  const malerForKategori = maler.filter((m) => m.kategori === aktivKategori)
  const delteMalerForKategori = delteMaler.filter((m) => m.kategori === aktivKategori)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Promptbibliotek</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Egendefinerte AI-instruksjoner som brukes ved notatgenerering og chat.
        </p>
      </div>

      {feil && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{feil}</div>
      )}

      <Tabs value={visning} onValueChange={byttVisning}>
        <TabsList>
          {KATEGORI_FANER.map((f) => (
            <TabsTrigger key={f.id} value={f.id}>
              {f.label}
              {maler.filter((m) => m.kategori === f.id).length > 0 && (
                <span className="ml-1.5 bg-slate-200 text-slate-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {maler.filter((m) => m.kategori === f.id).length}
                </span>
              )}
            </TabsTrigger>
          ))}
          <TabsTrigger value="ai">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
            Lag med AI
          </TabsTrigger>
          {erAdmin && (
            <TabsTrigger value="staging">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              Staging
            </TabsTrigger>
          )}
        </TabsList>

        {KATEGORI_FANER.map((f) => (
          <TabsContent key={f.id} value={f.id} className="mt-4 space-y-3">

            {/* Kategoribeskrivelse */}
            <p className="text-xs text-slate-500">
              {f.id === "KONSULTASJON" && "Vises i «Velg notatmal»-menyen for konsultasjonsoppgaver."}
              {f.id === "MOTE" && "Vises i «Velg notatmal»-menyen for møteoppgaver."}
              {f.id === "DIKTAT" && "Vises i «Velg mal»-menyen i Diktat — f.eks. brev til eller om pasienten."}
              {f.id === "CHAT" && "Vises som snarveisknapper i Chat / AI-hjelp-dialogen i konsultasjoner."}
              {f.id === "AIHJELP" && "Vises som snarveisknapper i den frittstående AI-hjelp-oppgaven."}
            </p>

            {/* Liste over egne maler */}
            {laster ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : malerForKategori.length === 0 && redigerer !== "ny" ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                Ingen maler ennå — opprett din første nedenfor.
              </p>
            ) : (
              <ul className="space-y-2">
                {malerForKategori.map((mal) => (
                  <li key={mal.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    {redigerer === mal.id ? (
                      <MalForm
                        form={form}
                        onChange={setForm}
                        onLagre={lagre}
                        onAvbryt={avbryt}
                        lagrer={lagrer}
                        feil={formFeil}
                      />
                    ) : (
                      <div className="flex items-start gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700">{mal.tittel}</p>
                          {mal.beskrivelse && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{mal.beskrivelse}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => toggleDelt(mal)}
                            title={mal.erDelt ? "Delt — klikk for å gjøre privat" : "Privat — klikk for å dele"}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                              mal.erDelt
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                            }`}
                          >
                            {mal.erDelt ? <Share2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            {mal.erDelt ? "Delt" : "Privat"}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startRediger(mal)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => slett(mal.id)}
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Ny mal-skjema */}
            {redigerer === "ny" && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
                <MalForm
                  form={form}
                  onChange={setForm}
                  onLagre={lagre}
                  onAvbryt={avbryt}
                  lagrer={lagrer}
                  feil={formFeil}
                  erNy
                />
              </div>
            )}

            {redigerer !== "ny" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={startNy}
              >
                <Plus className="w-4 h-4" />
                Ny mal
              </Button>
            )}

            <Separator />

            {/* Delte maler fra andre */}
            <button
              onClick={toggleDelte}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              {viserDelte ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Delte maler fra andre brukere
            </button>

            {viserDelte && (
              <div className="space-y-2">
                {lasterDelte ? (
                  <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
                ) : delteMalerForKategori.length === 0 ? (
                  <p className="text-sm text-slate-400">Ingen delte maler tilgjengelig i denne kategorien.</p>
                ) : (
                  <ul className="space-y-2">
                    {delteMalerForKategori.map((mal) => (
                      <li key={mal.id} className="rounded-xl border border-slate-200 bg-white flex items-start gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700">{mal.tittel}</p>
                          {mal.beskrivelse && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{mal.beskrivelse}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-0.5">
                            Av: {mal.eier.name ?? mal.eier.email}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1.5"
                          onClick={() => importer(mal)}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Importer
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </TabsContent>
        ))}

        {/* ── Lag prompt med AI ── */}
        <TabsContent value="ai" className="mt-4">
          <PromptbyggerKlient kategorier={KATEGORI_FANER} onBrukSomMal={prefyllNyMal} />
        </TabsContent>

        {/* ── Staging (admin) ── */}
        {erAdmin && (
          <TabsContent value="staging" className="mt-4">
            <StagingAdminKlient />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

interface MalFormProps {
  form: MalFormData
  onChange: (f: MalFormData) => void
  onLagre: () => void
  onAvbryt: () => void
  lagrer: boolean
  feil: string | null
  erNy?: boolean
}

function MalForm({ form, onChange, onLagre, onAvbryt, lagrer, feil, erNy }: MalFormProps) {
  return (
    <div className="p-4 space-y-3">
      {erNy && <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Ny mal</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Tittel *</label>
          <Input
            autoFocus
            placeholder="Kort, beskrivende tittel"
            value={form.tittel}
            onChange={(e) => onChange({ ...form, tittel: e.target.value })}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Beskrivelse (valgfritt)</label>
          <Input
            placeholder="Kort forklaring til legen"
            value={form.beskrivelse}
            onChange={(e) => onChange({ ...form, beskrivelse: e.target.value })}
            className="text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">Instruksjon til AI *</label>
        <Textarea
          placeholder="Skriv instruksjonen som sendes til Claude etter systemprompt…"
          value={form.innhold}
          onChange={(e) => onChange({ ...form, innhold: e.target.value })}
          className="resize-none text-sm h-28"
        />
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange({ ...form, erDelt: !form.erDelt })}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
            form.erDelt
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 text-slate-500 hover:border-slate-300"
          }`}
        >
          {form.erDelt ? <><Share2 className="w-3 h-3" /> Delt</> : <><Lock className="w-3 h-3" /> Privat</>}
        </button>
        <div className="flex items-center gap-2">
          {feil && <p className="text-xs text-red-600">{feil}</p>}
          <Button variant="outline" size="sm" onClick={onAvbryt} disabled={lagrer}>
            <X className="w-3.5 h-3.5 mr-1" />
            Avbryt
          </Button>
          <Button size="sm" onClick={onLagre} disabled={lagrer} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Check className="w-3.5 h-3.5 mr-1" />
            {lagrer ? "Lagrer…" : "Lagre"}
          </Button>
        </div>
      </div>
    </div>
  )
}
