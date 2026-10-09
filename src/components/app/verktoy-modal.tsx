"use client"

import { useMemo, useState } from "react"
import {
  ArrowLeft,
  Baby,
  Bone,
  Brain,
  CalendarHeart,
  Check,
  Droplet,
  ExternalLink,
  Eye,
  Glasses,
  Hand,
  HeartPulse,
  History,
  LayoutGrid,
  Siren,
  Smile,
  Utensils,
  Wind,
  Zap,
  Info,
  Search,
  ClipboardList,
  type LucideIcon,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { VerktoySkjema } from "@/components/app/verktoy-skjema"
import { VeiledningLenke } from "@/components/app/verktoy-veiledning"
import { RetningslinjeVisning } from "@/components/app/retningslinje-visning"
import { KalkulatorVisning } from "@/components/app/kalkulator-visning"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import { useVerktoy } from "@/hooks/use-verktoy"
import { useRetningslinjer } from "@/hooks/use-retningslinjer"
import {
  beregn,
  byggResultat,
  norskTall,
  standardSvar,
  ubesvarteValg,
} from "@/lib/verktoy/beregn"
import {
  INGEN_BEHANDLING,
  byggRetningslinjeResultat,
  lesRetningslinjeValg,
} from "@/lib/verktoy/retningslinje"
import {
  beregnKalkulator,
  byggKalkulatorResultat,
  synligeFelter,
} from "@/lib/verktoy/kalkulator"
import {
  FAGOMRADE_LABEL,
  INNEBYGDE_OPPSLAG,
  erKalkulator,
  erRetningslinje,
  finnOppslag,
} from "@/lib/verktoy/registry"
import {
  fagomraderFor,
  finnTreff,
  foreslaaOppslag,
  grupperEtterFagomrade,
  sokOppslag,
  treffId,
} from "@/lib/verktoy/sok"
import type { Treff } from "@/lib/verktoy/sok"
import type { Fagomrade, Retningslinje, Side, Svarverdi, VerktoyKategori } from "@/lib/verktoy/typer"
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

function treffKategori(t: Treff): VerktoyKategori {
  if (t.slag === "verktoy") return t.verktoy.kategori
  if (t.slag === "kalkulator") return "kalkulator"
  return "retningslinje"
}

const KATEGORI_KORT: Record<VerktoyKategori, string> = {
  score: "Skår",
  undersokelse: "Undersøkelse",
  kalkulator: "Kalkulator",
  retningslinje: "Retningslinje",
}

/** Kort typeetikett i listene. Tilstander viser retningslinjen de hører til. */
function treffType(t: Treff): string {
  if (t.slag === "tilstand") return t.retningslinje.kortNavn
  return KATEGORI_KORT[treffKategori(t)]
}

const FAGOMRADE_IKON: Record<Fagomrade, LucideIcon> = {
  akutt: Siren,
  barn: Baby,
  hjerte_kar: HeartPulse,
  luftveier: Wind,
  urinveier: Droplet,
  hud: Hand,
  muskel_skjelett: Bone,
  psykisk_helse: Brain,
  nevrologi: Zap,
  geriatri: Glasses,
  svangerskap: CalendarHeart,
  oye: Eye,
  mage_tarm: Utensils,
  tannhelse: Smile,
}

const FANE_NOKKEL = "legeassist:verktoy-fane"
/** Plassholderfane til fase 2 (andre retningslinjer og pakkeforløp). */
const ANDRE_RETNINGSLINJER = "andre-retningslinjer"

/** «verktoy» eller id-en til en retningslinje. Husker siste fane — bare en bekvemmelighet. */
function lesFane(): string {
  try {
    return localStorage.getItem(FANE_NOKKEL) ?? "verktoy"
  } catch {
    return "verktoy"
  }
}

function lagreFane(fane: string) {
  try {
    localStorage.setItem(FANE_NOKKEL, fane)
  } catch {
    // Privat modus o.l.
  }
}

/** Tilstandene gruppert etter kildens egne kapitler, i kildens rekkefølge. */
function kapitlerFor(retningslinje: Retningslinje): [string, Treff[]][] {
  const grupper = new Map<string, Treff[]>()
  for (const tilstand of retningslinje.tilstander) {
    const liste = grupper.get(tilstand.kapittel) ?? []
    liste.push({ slag: "tilstand", retningslinje, tilstand })
    grupper.set(tilstand.kapittel, liste)
  }
  return [...grupper.entries()]
}

const NYLIG_NOKKEL = "legeassist:verktoy-nylig"
const MAKS_NYLIG = 5

/** Kun treff-id-er — aldri svar eller pasientdata. */
function lesNylig(): string[] {
  try {
    const raa = JSON.parse(localStorage.getItem(NYLIG_NOKKEL) ?? "[]")
    return Array.isArray(raa) ? raa.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

function lagreNylig(id: string): string[] {
  const liste = [id, ...lesNylig().filter((x) => x !== id)].slice(0, MAKS_NYLIG)
  try {
    localStorage.setItem(NYLIG_NOKKEL, JSON.stringify(liste))
  } catch {
    // Privat modus o.l. — listen gjelder da bare denne økten
  }
  return liste
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
  const { retningslinjer, laster: lasterRetningslinjer, feil: retningslinjeFeil } =
    useRetningslinjer()
  /** Verktøyene i koden + retningslinjene fra Helsedirektoratet, når de er lastet. */
  const oppslag = useMemo(() => [...INNEBYGDE_OPPSLAG, ...retningslinjer], [retningslinjer])

  const [sok, setSok] = useState("")
  const [valgt, setValgt] = useState<Treff | null>(null)
  const [svar, setSvar] = useState<Record<string, Svarverdi>>({})
  const [side, setSide] = useState<Side | undefined>(undefined)
  const [valgteLinjer, setValgteLinjer] = useState<string[]>([])
  const [redigererId, setRedigererId] = useState<string | null>(null)
  const [lagret, setLagret] = useState(false)

  const forslag = useMemo(() => {
    if (!aktiv) return []
    const tekst = [aktiv.transkript, aktiv.kontekst, aktiv.tilleggsinfo]
      .filter(Boolean)
      .join(" ")
    return foreslaaOppslag(tekst, oppslag)
  }, [aktiv, oppslag])

  const treff = useMemo(() => sokOppslag(sok, oppslag), [sok, oppslag])

  /**
   * Nylig brukte verktøy, kun id-er (ingen pasientdata). En id kan bli
   * ugyldig hvis et verktøy fjernes — da faller raden bare ut.
   */
  const [nyligIder, setNyligIder] = useState<string[]>(lesNylig)
  const nylig = useMemo(
    () => nyligIder.map((id) => finnTreff(id, oppslag)).filter((t): t is Treff => Boolean(t)),
    [nyligIder, oppslag]
  )

  /**
   * Oversikten vises når ingenting er valgt, eller når legen går tilbake til
   * den fra et skjema. Skjemaet beholdes da, så «Tilbake til …» ikke mister svar.
   */
  const [visOversikt, setVisOversikt] = useState(true)
  const visSkjema = Boolean(valgt) && !visOversikt
  /**
   * Oversikten deles i faner: verktøyene etter fagområde, og hver retningslinje
   * etter sine egne kapitler. Ellers drukner tolv verktøy i 63 antibiotikarader.
   * Søket gjelder alt.
   */
  const [fane, setFaneState] = useState<string>(lesFane)
  function setFane(f: string) {
    setFaneState(f)
    lagreFane(f)
  }
  const aktivRetningslinje = retningslinjer.find((r) => r.id === fane)
  // En lagret fane for en retningslinje som ikke er lastet (ennå), viser verktøyene
  const visFane = aktivRetningslinje || fane === ANDRE_RETNINGSLINJER ? fane : "verktoy"
  const fagGrupper = useMemo(() => grupperEtterFagomrade(INNEBYGDE_OPPSLAG), [])
  const kapittelGrupper = useMemo(
    () => (aktivRetningslinje ? kapitlerFor(aktivRetningslinje) : []),
    [aktivRetningslinje]
  )

  const kalkulator = valgt?.slag === "kalkulator" ? valgt.kalkulator : undefined
  /**
   * Kalkulatoren regnes ut på hver render, med dagens dato. Gestasjonsalder
   * endrer seg fra dag til dag, så en memoisert verdi ville blitt stående feil
   * hvis modalen står åpen over midnatt.
   */
  const kalkResultat = kalkulator ? beregnKalkulator(kalkulator, svar) : null
  // Skjulte felter (feil inngangsvei) skal ikke telle som ubesvarte
  const kalkMangler =
    Boolean(kalkulator) &&
    (kalkResultat === null ||
      synligeFelter(kalkulator!, svar).some(
        (f) => f.type === "valg" && typeof svar[f.id] !== "number"
      ))

  const verktoy = valgt?.slag === "verktoy" ? valgt.verktoy : undefined
  const beregning = verktoy ? beregn(verktoy, svar) : null
  const manglerSide = Boolean(verktoy?.lateralitet) && !side
  // En delvis utfylt skala gir en sum som ser gyldig ut, men er for lav
  const ubesvart = verktoy ? ubesvarteValg(verktoy, svar) : []
  // Undersøkelser har ingen skår — der er kravet i stedet at noe faktisk er registrert
  const tomUndersokelse =
    verktoy?.beregning.type === "ingen" && (beregning?.detaljer.length ?? 0) === 0
  // Formelverktøy har tallfelter som `ubesvarteValg` ikke dekker, og formelen
  // returnerer null både ved manglende og ugyldige verdier
  const manglerFormelverdier =
    verktoy?.beregning.type === "formel" && beregning?.sum === null

  const kanLagre =
    valgt?.slag === "tilstand"
      ? valgteLinjer.length > 0
      : valgt?.slag === "kalkulator"
        ? !kalkMangler
        : Boolean(verktoy) &&
        !manglerSide &&
        ubesvart.length === 0 &&
        !tomUndersokelse &&
        !manglerFormelverdier

  function velg(t: Treff) {
    setValgt(t)
    setVisOversikt(false)
    setSok("")
    setSvar(t.slag === "verktoy" ? standardSvar(t.verktoy) : {})
    setValgteLinjer([])
    setSide(undefined)
    setRedigererId(null)
    setLagret(false)
  }

  function apneResultat(resultatId: string) {
    const resultat = resultater.find((r) => r.id === resultatId)
    if (!resultat) return

    const funnet = finnOppslag(resultat.verktoyId, oppslag)
    if (!funnet) return

    if (erKalkulator(funnet)) {
      setValgt({ slag: "kalkulator", kalkulator: funnet })
      setSvar(resultat.svar)
      setValgteLinjer([])
    } else if (erRetningslinje(funnet)) {
      const { tilstandId, valgte } = lesRetningslinjeValg(resultat)
      const tilstand = funnet.tilstander.find((t) => t.id === tilstandId)
      if (!tilstand) return
      setValgt({ slag: "tilstand", retningslinje: funnet, tilstand })
      setValgteLinjer(valgte)
      setSvar({})
    } else {
      setValgt({ slag: "verktoy", verktoy: funnet })
      setSvar({ ...standardSvar(funnet), ...resultat.svar })
      setValgteLinjer([])
    }

    setSide(resultat.side)
    setRedigererId(resultat.id)
    setLagret(false)
    setVisOversikt(false)
  }

  async function leggINotat() {
    if (!valgt || !kanLagre) return
    const id = redigererId ?? cuid()

    const resultat =
      valgt.slag === "tilstand"
        ? byggRetningslinjeResultat(valgt.retningslinje, valgt.tilstand, valgteLinjer, { id })
        : valgt.slag === "kalkulator"
          ? kalkResultat
            ? byggKalkulatorResultat(valgt.kalkulator, svar, kalkResultat, { id })
            : null
          : byggResultat(valgt.verktoy, svar, { id, side })
    if (!resultat) return

    await lagreResultat(resultat)
    setRedigererId(resultat.id)
    setLagret(true)
    setNyligIder(lagreNylig(treffId(valgt)))
  }

  function settSvar(id: string, verdi: Svarverdi) {
    setSvar((prev) => ({ ...prev, [id]: verdi }))
    setLagret(false)
  }

  /** «Ikke indisert» og et konkret preparat utelukker hverandre. */
  function veksleLinje(id: string) {
    setValgteLinjer((prev) => {
      if (id === INGEN_BEHANDLING) {
        return prev.includes(INGEN_BEHANDLING) ? [] : [INGEN_BEHANDLING]
      }
      const utenIngen = prev.filter((p) => p !== INGEN_BEHANDLING)
      return utenIngen.includes(id)
        ? utenIngen.filter((p) => p !== id)
        : [...utenIngen, id]
    })
    setLagret(false)
  }

  function treffNavn(t: Treff): string {
    if (t.slag === "verktoy") return t.verktoy.navn
    if (t.slag === "kalkulator") return t.kalkulator.navn
    return t.tilstand.navn
  }

  const valgtId = valgt ? treffId(valgt) : null

  /** Kildelenken, når oppslaget har en. Tilstander har sin egen i visningen. */
  const kildeUrl =
    valgt?.slag === "verktoy"
      ? valgt.verktoy.kilde.url
      : valgt?.slag === "kalkulator"
        ? valgt.kalkulator.kilde.url
        : undefined

  return (
    <>
      {/* ── Header ── */}
        <div className="bg-slate-800 text-white px-5 py-4 rounded-t-xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-slate-300" />
            <div>
              <h2 className="text-base font-semibold leading-none">Kliniske verktøy</h2>
              <p className="text-xs text-slate-400 mt-1">
                Skåringsverktøy, strukturerte undersøkelser og retningslinjer — resultatet
                legges i notatet
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
              Nøkkelord i konsultasjonen brukes til å foreslå verktøy (lokalt, uten AI)
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
            Poengsummer beregnes av appen, ikke av AI. Tolkninger og doser er gjengitt
            ordrett fra kilden og erstatter ikke klinisk vurdering.
          </p>
        </div>

        {/* ── Søkelinje ── */}
        <div className="px-5 py-3 border-b border-slate-200 shrink-0 flex items-center gap-3">
          {visSkjema ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => setVisOversikt(true)}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Alle verktøy
            </Button>
          ) : (
            valgt && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0 max-w-72"
                onClick={() => {
                  setSok("")
                  setVisOversikt(false)
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Tilbake til {treffNavn(valgt)}</span>
              </Button>
            )
          )}
          <div className={`relative ${visSkjema ? "w-72" : "flex-1"}`}>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              autoFocus
              placeholder="Søk: verktøy, tilstand, symptom, fagområde…"
              value={sok}
              onChange={(e) => {
                setSok(e.target.value)
                // Søk fra skjemaet tar deg til oversikten; skjemaet beholdes
                setVisOversikt(true)
              }}
              onKeyDown={(e) => {
                // Enter åpner beste treff — søk og velg uten mus
                if (e.key === "Enter" && sok && treff[0]) {
                  e.preventDefault()
                  velg(treff[0])
                }
              }}
              className="pl-8 text-sm"
            />
          </div>
        </div>

        {visSkjema && valgt ? (
          /* ── Aktivt oppslag, over hele bredden ── */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-slate-100 shrink-0 flex items-start justify-between gap-4 w-full max-w-5xl mx-auto">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-800">{treffNavn(valgt)}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {valgt.slag === "verktoy"
                    ? `${valgt.verktoy.langtNavn} · Kilde: ${valgt.verktoy.kilde.navn}${
                        valgt.verktoy.kilde.versjon ? ` ${valgt.verktoy.kilde.versjon}` : ""
                      }`
                    : valgt.slag === "kalkulator"
                      ? `${valgt.kalkulator.langtNavn} · ${valgt.kalkulator.kilde.navn}`
                      : valgt.retningslinje.langtNavn}
                </p>
              </div>
              {kildeUrl && (
                <a
                  href={kildeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 pt-0.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Kilde
                </a>
              )}
              {valgt.slag === "verktoy" && valgt.verktoy.veiledning && (
                <div className="shrink-0 pt-0.5">
                  <VeiledningLenke
                    veiledning={valgt.verktoy.veiledning}
                    etikett="Full veiledning"
                  />
                </div>
              )}
              {valgt.slag === "kalkulator" && valgt.kalkulator.veiledning && (
                <div className="shrink-0 pt-0.5">
                  <VeiledningLenke
                    veiledning={valgt.kalkulator.veiledning}
                    etikett="Metode"
                  />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="max-w-5xl mx-auto">
                {valgt.slag === "verktoy" || valgt.slag === "kalkulator" ? (
                  <VerktoySkjema
                    verktoy={valgt.slag === "verktoy" ? valgt.verktoy : valgt.kalkulator}
                    svar={svar}
                    onSvar={settSvar}
                    side={side}
                    onSide={(s) => { setSide(s); setLagret(false) }}
                  />
                ) : (
                  <RetningslinjeVisning
                    retningslinje={valgt.retningslinje}
                    tilstand={valgt.tilstand}
                    valgte={valgteLinjer}
                    onVelg={veksleLinje}
                  />
                )}
              </div>
            </div>

            {/* Resultat + handling */}
            <div className="border-t border-slate-200 shrink-0">
              <div className="px-5 py-3 space-y-2.5 w-full max-w-5xl mx-auto">
                {valgt.slag === "kalkulator" ? (
                  kalkResultat ? (
                    <KalkulatorVisning resultat={kalkResultat} />
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-sm text-slate-600">
                        Velg beregningsmetode og fyll ut feltene.
                      </p>
                    </div>
                  )
                ) : valgt.slag === "tilstand" ? (
                  valgteLinjer.length === 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-sm text-slate-600">
                        Velg behandlingslinjen som gjelder pasienten, eller merk at
                        antibiotika ikke er indisert.
                      </p>
                    </div>
                  )
                ) : ubesvart.length > 0 || tomUndersokelse || manglerFormelverdier ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-sm text-slate-600">
                      {tomUndersokelse
                        ? "Registrer minst ett funn. Tester du lar stå tomme, tas ikke med i notatet."
                        : ubesvart.length > 0
                          ? ubesvart.length === 1
                            ? "Ett punkt gjenstår før skåren er gyldig."
                            : `${ubesvart.length} punkter gjenstår før skåren er gyldig.`
                          : "Fyll ut alle feltene med verdier innenfor det validerte området før risikoen kan beregnes."}
                    </p>
                  </div>
                ) : (
                  beregning &&
                  beregning.sum !== null &&
                  verktoy && (
                    <div
                      className={`rounded-lg border px-3 py-2.5 ${
                        beregning.farge ? FARGE_KLASSE[beregning.farge] : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold tabular-nums">
                          {norskTall(beregning.sum)}
                        </span>
                        <span className="text-xs">{verktoy.sumEtikett ?? "poeng"}</span>
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
            </div>
          </div>
        ) : (
          /* ── Oversikt ── */
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {sok ? (
              treff.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {treff.map((t, i) => (
                    <button
                      key={treffId(t)}
                      onClick={() => velg(t)}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                        i === 0
                          ? "border-blue-300 bg-blue-50/50 hover:bg-blue-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-sm font-medium text-slate-800">{treffNavn(t)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {treffType(t)} · {fagomraderFor(t).map((f) => FAGOMRADE_LABEL[f]).join(", ")}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">Ingen treff på «{sok}».</p>
              )
            ) : (
              <>
                {(forslag.length > 0 || nylig.length > 0) && (
                  <div className="flex flex-wrap gap-x-8 gap-y-4">
                    {forslag.length > 0 && (
                      <div className="space-y-1.5">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Foreslått for denne konsultasjonen
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {forslag.map(({ treff: t, ord }) => (
                            <button
                              key={treffId(t)}
                              onClick={() => velg(t)}
                              title={`Nevnt: ${ord.join(", ")}`}
                              className="text-left px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50/60 hover:bg-amber-50 transition-colors"
                            >
                              <span className="text-sm font-medium text-slate-800">{treffNavn(t)}</span>
                              <span className="text-xs text-slate-500 ml-1.5">{ord.join(", ")}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {nylig.length > 0 && (
                      <div className="space-y-1.5">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <History className="w-3 h-3" />
                          Nylig brukt
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {nylig.map((t) => (
                            <button
                              key={treffId(t)}
                              onClick={() => velg(t)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-800 transition-colors"
                            >
                              {treffNavn(t)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Faner */}
                <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
                  {[
                    { id: "verktoy", navn: "Verktøy", antall: INNEBYGDE_OPPSLAG.length },
                    ...retningslinjer.map((r) => ({ id: r.id, navn: r.kortNavn, antall: r.tilstander.length })),
                    { id: ANDRE_RETNINGSLINJER, navn: "Andre retningslinjer", antall: null },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFane(f.id)}
                      className={`-mb-px px-3 py-2 text-sm border-b-2 transition-colors ${
                        visFane === f.id
                          ? "border-slate-800 text-slate-900 font-medium"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {f.navn}
                      {f.antall === null ? (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-400">kommer</span>
                      ) : (
                        <span className="ml-1.5 text-xs text-slate-400 tabular-nums">{f.antall}</span>
                      )}
                    </button>
                  ))}
                  {lasterRetningslinjer && (
                    <span className="px-3 py-2 text-xs text-slate-400 italic">Henter retningslinjer…</span>
                  )}
                </div>
                {retningslinjeFeil && (
                  <p className="text-xs text-amber-700">
                    Kunne ikke hente retningslinjene. Skåringsverktøyene virker som vanlig — prøv
                    igjen ved å lukke og åpne modalen.
                  </p>
                )}

                {visFane === "verktoy" ? (
                  /* Kolonner i stedet for rutenett, så korte og lange områder pakkes tett */
                  <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                    {fagGrupper.map(([fag, liste]) => {
                      const Ikon = FAGOMRADE_IKON[fag]
                      return (
                        <section
                          key={fag}
                          className="break-inside-avoid mb-4 rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 px-1">
                            <Ikon className="w-3.5 h-3.5 text-slate-400" />
                            {FAGOMRADE_LABEL[fag]}
                          </h3>
                          <div className="space-y-0.5">
                            {liste.map((t) => (
                              <button
                                key={treffId(t)}
                                onClick={() => velg(t)}
                                className={`w-full text-left px-2 py-1.5 rounded-md flex items-baseline justify-between gap-2 transition-colors ${
                                  valgtId === treffId(t) ? "bg-blue-50" : "hover:bg-slate-50"
                                }`}
                              >
                                <span className="text-sm text-slate-800">{treffNavn(t)}</span>
                                <span className="text-[11px] text-slate-400 shrink-0">{treffType(t)}</span>
                              </button>
                            ))}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                ) : visFane === ANDRE_RETNINGSLINJER ? (
                  <div className="max-w-xl rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 space-y-2">
                    <h3 className="text-sm font-semibold text-slate-700">Kommer: flere retningslinjer og pakkeforløp</h3>
                    <p className="text-sm text-slate-600">
                      Nasjonale faglige retningslinjer fra Helsedirektoratet skal kunne slås opp her, med
                      kapitler og anbefalinger gjengitt ordrett — for eksempel diabetes, kols, demens og
                      forebygging av hjerte- og karsykdom. Pakkeforløpenes kriterier for henvisning ved
                      begrunnet mistanke kommer også.
                    </p>
                    <p className="text-xs text-slate-400">
                      Innholdet hentes fra Helsedirektoratet på samme måte som antibiotikaretningslinjen.
                    </p>
                  </div>
                ) : (
                  aktivRetningslinje && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500">
                        {aktivRetningslinje.langtNavn} · Helsedirektoratet
                      </p>
                      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                        {kapittelGrupper.map(([kapittel, liste]) => (
                          <section
                            key={kapittel}
                            className="break-inside-avoid mb-4 rounded-xl border border-slate-200 bg-white p-3"
                          >
                            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 px-1">
                              {kapittel}
                            </h3>
                            <div>
                              {liste.map((t) => (
                                <button
                                  key={treffId(t)}
                                  onClick={() => velg(t)}
                                  className={`w-full text-left px-2 py-1 rounded-md text-sm text-slate-800 transition-colors ${
                                    valgtId === treffId(t) ? "bg-blue-50" : "hover:bg-slate-50"
                                  }`}
                                >
                                  {treffNavn(t)}
                                </button>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        )}

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
