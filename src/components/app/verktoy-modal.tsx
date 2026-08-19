"use client"

import { useMemo, useState } from "react"
import { Check, Info, Search, ClipboardList, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { VerktoySkjema } from "@/components/app/verktoy-skjema"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import { useVerktoy } from "@/hooks/use-verktoy"
import { beregn, byggResultat, standardSvar, ubesvarteValg } from "@/lib/verktoy/beregn"
import { KATEGORI_LABEL, finnVerktoy } from "@/lib/verktoy/registry"
import { foreslaaVerktoy, sokVerktoy } from "@/lib/verktoy/sok"
import type { Side, Svarverdi, Verktoy, VerktoyKategori } from "@/lib/verktoy/typer"
import { cuid } from "@/lib/cuid"

interface Props {
  open: boolean
  onClose: () => void
}

const FARGE_KLASSE: Record<"gronn" | "gul" | "rod", string> = {
  gronn: "border-emerald-200 bg-emerald-50 text-emerald-800",
  gul: "border-amber-200 bg-amber-50 text-amber-800",
  rod: "border-red-200 bg-red-50 text-red-800",
}

function ordTeller(tekst: string): number {
  return tekst.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Ytre skall. Innholdet remountes via `key` når brukeren bytter konsultasjon, slik
 * at et halvutfylt skjema aldri følger med over til neste pasient — uten en
 * nullstillende effekt.
 */
export function VerktoyModal({ open, onClose }: Props) {
  const { aktiv } = useKonsultasjon()

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="!w-[90vw] !max-w-[1400px] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
      >
        <VerktoyInnhold key={aktiv?.id ?? "ingen"} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}

function VerktoyInnhold({ onClose }: { onClose: () => void }) {
  const { aktiv } = useKonsultasjon()
  const { resultater, lagreResultat, slettResultat } = useVerktoy()

  const [sok, setSok] = useState("")
  const [valgtId, setValgtId] = useState<string | null>(null)
  const [svar, setSvar] = useState<Record<string, Svarverdi>>({})
  const [side, setSide] = useState<Side | undefined>(undefined)
  const [redigererId, setRedigererId] = useState<string | null>(null)
  const [lagret, setLagret] = useState(false)

  const valgt = valgtId ? finnVerktoy(valgtId) : undefined

  const forslag = useMemo(() => {
    if (!aktiv) return []
    const tekst = [aktiv.transkript, aktiv.kontekst, aktiv.tilleggsinfo]
      .filter(Boolean)
      .join(" ")
    return foreslaaVerktoy(tekst)
  }, [aktiv])

  const treff = useMemo(() => sokVerktoy(sok), [sok])

  const gruppert = useMemo(() => {
    const grupper = new Map<VerktoyKategori, Verktoy[]>()
    for (const v of treff) {
      const liste = grupper.get(v.kategori) ?? []
      liste.push(v)
      grupper.set(v.kategori, liste)
    }
    return [...grupper.entries()]
  }, [treff])

  const beregning = valgt ? beregn(valgt, svar) : null
  const manglerSide = Boolean(valgt?.lateralitet) && !side
  // En delvis utfylt skala gir en sum som ser gyldig ut, men er for lav
  const ubesvart = valgt ? ubesvarteValg(valgt, svar) : []
  // Undersøkelser har ingen skår — der er kravet i stedet at noe faktisk er registrert
  const tomUndersokelse =
    valgt?.beregning.type === "ingen" && (beregning?.detaljer.length ?? 0) === 0
  const kanLagre =
    Boolean(valgt) && !manglerSide && ubesvart.length === 0 && !tomUndersokelse

  function velgVerktoy(v: Verktoy) {
    setValgtId(v.id)
    setSvar(standardSvar(v))
    setSide(undefined)
    setRedigererId(null)
    setLagret(false)
  }

  function apneResultat(resultatId: string) {
    const resultat = resultater.find((r) => r.id === resultatId)
    if (!resultat) return
    const verktoy = finnVerktoy(resultat.verktoyId)
    if (!verktoy) return
    setValgtId(verktoy.id)
    setSvar({ ...standardSvar(verktoy), ...resultat.svar })
    setSide(resultat.side)
    setRedigererId(resultat.id)
    setLagret(false)
  }

  async function leggINotat() {
    if (!valgt || !kanLagre) return
    const resultat = byggResultat(valgt, svar, {
      id: redigererId ?? cuid(),
      side,
    })
    await lagreResultat(resultat)
    setRedigererId(resultat.id)
    setLagret(true)
  }

  function settSvar(id: string, verdi: Svarverdi) {
    setSvar((prev) => ({ ...prev, [id]: verdi }))
    setLagret(false)
  }

  return (
    <>
      {/* ── Header ── */}
        <div className="bg-slate-800 text-white px-5 py-4 rounded-t-xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-slate-300" />
            <div>
              <h2 className="text-base font-semibold leading-none">Kliniske verktøy</h2>
              <p className="text-xs text-slate-400 mt-1">
                Skåringsverktøy og strukturerte undersøkelser — resultatet legges i notatet
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-400 hover:text-white hover:bg-slate-700"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* ── Kontekst-banner ── */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 shrink-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-medium text-slate-600">
              Konsultasjonens innhold brukes til å foreslå verktøy
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aktiv?.transkript ? (
              <span className="text-xs px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-medium">
                Transkript · {ordTeller(aktiv.transkript)} ord
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full border border-slate-200 bg-slate-100 text-slate-400">
                Transkript · tomt
              </span>
            )}
            {aktiv?.kontekst?.trim() && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600">
                Kontekst · {ordTeller(aktiv.kontekst)} ord
              </span>
            )}
            {aktiv?.tilleggsinfo?.trim() && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600">
                Tilleggsinfo · {ordTeller(aktiv.tilleggsinfo)} ord
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 italic">
            Poengsummer beregnes av appen, ikke av AI. Tolkningsteksten er gjengitt fra
            verktøyets egen kilde og erstatter ikke klinisk vurdering.
          </p>
        </div>

        {/* ── Hovedinnhold ── */}
        <div className="flex-1 flex min-h-0">
          {/* Venstre: søk + liste */}
          <div className="w-72 border-r border-slate-200 flex flex-col min-h-0 shrink-0">
            <div className="p-3 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Søk etter verktøy…"
                  value={sok}
                  onChange={(e) => setSok(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {forslag.length > 0 && !sok && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Foreslått for denne konsultasjonen
                  </h3>
                  {forslag.map(({ verktoy, treff: ord }) => (
                    <button
                      key={verktoy.id}
                      onClick={() => velgVerktoy(verktoy)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        valgtId === verktoy.id
                          ? "border-blue-400 bg-blue-50"
                          : "border-amber-200 bg-amber-50/60 hover:bg-amber-50"
                      }`}
                    >
                      <div className="text-sm font-medium text-slate-800">{verktoy.navn}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Nevnt: {ord.join(", ")}</div>
                    </button>
                  ))}
                </div>
              )}

              {gruppert.map(([kategori, liste]) => (
                <div key={kategori} className="space-y-1.5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {KATEGORI_LABEL[kategori]}
                  </h3>
                  {liste.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => velgVerktoy(v)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        valgtId === v.id
                          ? "border-blue-400 bg-blue-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-sm font-medium text-slate-800">{v.navn}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{v.langtNavn}</div>
                    </button>
                  ))}
                </div>
              ))}

              {treff.length === 0 && (
                <p className="text-xs text-slate-400 italic px-1">
                  Ingen verktøy matcher «{sok}».
                </p>
              )}
            </div>
          </div>

          {/* Høyre: aktivt verktøy */}
          <div className="flex-1 flex flex-col min-h-0">
            {!valgt ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <ClipboardList className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-sm text-slate-400">Velg et verktøy fra listen</p>
                </div>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-slate-100 shrink-0">
                  <h3 className="text-sm font-semibold text-slate-800">{valgt.navn}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {valgt.langtNavn} · Kilde: {valgt.kilde.navn}
                    {valgt.kilde.versjon ? ` ${valgt.kilde.versjon}` : ""}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <VerktoySkjema
                    verktoy={valgt}
                    svar={svar}
                    onSvar={settSvar}
                    side={side}
                    onSide={(s) => { setSide(s); setLagret(false) }}
                  />
                </div>

                {/* Resultat + handling */}
                <div className="px-5 py-3 border-t border-slate-200 shrink-0 space-y-2.5">
                  {ubesvart.length > 0 || tomUndersokelse ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-sm text-slate-600">
                        {tomUndersokelse
                          ? "Registrer minst ett funn. Tester du lar stå tomme, tas ikke med i notatet."
                          : ubesvart.length === 1
                            ? "Ett punkt gjenstår før skåren er gyldig."
                            : `${ubesvart.length} punkter gjenstår før skåren er gyldig.`}
                      </p>
                    </div>
                  ) : (
                    beregning &&
                    beregning.sum !== null && (
                      <div
                        className={`rounded-lg border px-3 py-2.5 ${
                          beregning.farge ? FARGE_KLASSE[beregning.farge] : "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-semibold tabular-nums">{beregning.sum}</span>
                          <span className="text-xs">{valgt.sumEtikett ?? "poeng"}</span>
                          {beregning.klasse && (
                            <span className="text-sm font-medium ml-1">· {beregning.klasse}</span>
                          )}
                        </div>
                        {beregning.tolkning && (
                          <p className="text-xs mt-1 opacity-90">{beregning.tolkning}</p>
                        )}
                      </div>
                    )
                  )}

                  <div className="flex items-center gap-2">
                    {manglerSide && (
                      <span className="text-xs text-amber-700">Velg side før du legger i notatet.</span>
                    )}
                    <div className="flex-1" />
                    <Button
                      size="sm"
                      className="gap-1.5 text-sm bg-slate-800 hover:bg-slate-900"
                      disabled={!kanLagre}
                      onClick={leggINotat}
                    >
                      {lagret ? <Check className="w-4 h-4" /> : null}
                      {lagret ? "Lagt i notat" : redigererId ? "Oppdater notat" : "Legg i notat"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Utførte verktøy ── */}
        {resultater.length > 0 && (
          <div className="px-5 py-2.5 border-t border-slate-200 flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 font-medium shrink-0 uppercase tracking-wide">
              I notatet
            </span>
            {resultater.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-slate-200 bg-white"
              >
                <button
                  onClick={() => apneResultat(r.id)}
                  className="font-medium text-slate-700 hover:text-blue-700 transition-colors"
                >
                  {r.navn}
                  {r.sum !== null ? ` · ${r.sum}` : ""}
                </button>
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <button
                      onClick={() => slettResultat(r.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                      aria-label={`Fjern ${r.navn} fra notatet`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Fjern fra notatet</TooltipContent>
                </Tooltip>
              </span>
            ))}
          </div>
        )}
    </>
  )
}
