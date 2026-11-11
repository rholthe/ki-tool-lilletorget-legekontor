"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ArrowLeft,
  FileText,
  Loader2,
  Maximize2,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VedleggPanel } from "@/components/app/vedlegg-panel"
import { DikteringKnapp } from "@/components/app/diktering-knapp"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import {
  finnPridokSkjema,
  fyllPridokSkjema,
  hentPridokPasienter,
  stotterSkjema,
  useJournalUtvidelse,
  type JournalModus,
  type PridokPasient,
  type PridokSkjema,
} from "@/hooks/use-journal-utvidelse"
import { hentAiOppsett, hentStrukturertSvar } from "@/lib/bedrock-nettleser"
import { byggSkjemaForesporsel, harAiFelt, tolkSkjemaSvar } from "@/lib/skjema/ai"
import { fyllPdf, lastNedPdf, pdfFilnavn } from "@/lib/skjema/pdf"
import { hentKonsultasjon } from "@/lib/idb"
import { erGyldigFnr, formaterFnr, rensFnr } from "@/lib/skjema/fnr"
import {
  TOM_PASIENT,
  fyllFraKilder,
  harLegeFelt,
  pridokFeltliste,
  harPridokFelt,
  skjemaSomTekst,
  type Lege,
  type Pasient,
  type SkjemaDefinisjon,
  type SkjemaFelt,
  type SkjemaKategoriMedSkjema,
  type SkjemaVerdi,
} from "@/lib/skjema/typer"
import type { Vedlegg } from "@/types/konsultasjon"

type Melding = { type: "ok" | "info" | "feil"; tekst: string }

function likTekst(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim().toLowerCase()
  return n(a) === n(b)
}

/** «14.10.75» og «14.10.1975» er samme dato. */
function likDato(a: string, b: string): boolean {
  const n = (t: string) => {
    const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
    return m ? `${+m[1]}.${+m[2]}.${m[3].slice(-2)}` : t
  }
  return n(a) === n(b)
}

/** Sant når dokumentet i Pridok tydelig gjelder en annen pasient enn skjemaet. */
function annenPasient(pasient: Pasient | undefined, dok: PridokSkjema): boolean {
  if (!pasient?.navn.trim() || !dok.navn) return false
  if (!likTekst(pasient.navn, dok.navn)) return true
  return Boolean(pasient.fodt && dok.fodt && !likDato(pasient.fodt, dok.fodt))
}

function fraPridok(p: PridokPasient): Pasient {
  return {
    navn: p.navn.replace(/\s+/g, " ").trim(),
    fodt: p.fodt,
    fnr: p.fnr ?? "",
    adresse: p.adresse ?? "",
    postnr: p.postnr ?? "",
    poststed: p.poststed ?? "",
    fraPridok: true,
  }
}

export function SkjemaView() {
  const { aktiv, oppdater, setAktiv } = useKonsultasjon()
  const { installert, versjon } = useJournalUtvidelse()
  const harUtvidelse = installert && stotterSkjema(versjon)

  const [kategorier, setKategorier] = useState<SkjemaKategoriMedSkjema[] | null>(null)
  const [lastFeil, setLastFeil] = useState(false)
  const [lege, setLege] = useState<Lege | undefined>(undefined)
  const [sok, setSok] = useState("")
  const [fyller, setFyller] = useState(false)
  const [utvidetKontekst, setUtvidetKontekst] = useState(false)
  const [sender, setSender] = useState(false)
  const [melding, setMelding] = useState<Melding | null>(null)
  const [redigerPasient, setRedigerPasient] = useState(false)
  const [pasientValg, setPasientValg] = useState<PridokPasient[] | null>(null)
  const [skjemaValg, setSkjemaValg] = useState<PridokSkjema[] | null>(null)
  const [bekreft, setBekreft] = useState<{ dok: PridokSkjema; steg: "pasient" | "innhold" } | null>(null)
  const [kopiert, setKopiert] = useState(false)
  const [lagerPdf, setLagerPdf] = useState(false)
  const kontekstRef = useRef<HTMLTextAreaElement>(null)
  const avbrytRef = useRef<AbortController | null>(null)
  const harSpurtPridok = useRef(false)

  useEffect(() => {
    fetch("/api/skjema", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { kategorier: SkjemaKategoriMedSkjema[]; lege?: Lege }) => {
        setKategorier(d.kategorier)
        setLege(d.lege)
      })
      .catch(() => setLastFeil(true))
    return () => avbrytRef.current?.abort()
  }, [])

  const skjema = aktiv?.skjema
  const verdier = useMemo(() => aktiv?.skjemaVerdier ?? {}, [aktiv?.skjemaVerdier])
  const pasient = aktiv?.pasient

  const settPasient = useCallback(
    async (p: Pasient) => {
      await oppdater({
        pasient: p,
        ...(skjema ? { skjemaVerdier: fyllFraKilder(skjema.felter, verdier, p, lege) } : {}),
      })
    },
    [oppdater, skjema, verdier, lege],
  )

  const hentPasient = useCallback(
    async (stille: boolean) => {
      const svar = await hentPridokPasienter()
      if (!svar.ok) {
        if (!stille) setMelding({ type: "feil", tekst: `Kunne ikke hente pasient fra Pridok${svar.melding ? `: ${svar.melding}` : "."}` })
        return
      }
      if (svar.pasienter.length === 1) {
        await settPasient(fraPridok(svar.pasienter[0]))
        setRedigerPasient(false)
      } else if (svar.pasienter.length > 1) {
        setPasientValg(svar.pasienter)
      } else if (!stille) {
        setMelding({
          type: "info",
          tekst:
            svar.antallFaner === 0
              ? "Fant ingen åpen Pridok-fane. Åpne pasienten i Pridok, eller skriv inn opplysningene selv."
              : "Ingen pasient er åpen i Pridok. Åpne pasientens journal, eller skriv inn opplysningene selv.",
        })
      }
    },
    [settPasient],
  )

  // Ny oppgave: se om en pasient er åpen i Pridok (én gang, og bare når ingen er valgt)
  const manglerPasient = Boolean(aktiv) && !pasient
  useEffect(() => {
    if (!harUtvidelse || !manglerPasient || harSpurtPridok.current) return
    harSpurtPridok.current = true
    void hentPasient(true)
  }, [harUtvidelse, manglerPasient, hentPasient])

  // Legefelt som står tomme, fylles når navn og HPR-nummer er hentet (f.eks. etter at legen
  // har lagt inn HPR-nummeret under Innstillinger). Felt med innhold røres ikke
  useEffect(() => {
    if (!lege || !skjema) return
    const tomme = skjema.felter.filter(
      (f) => f.kilde.startsWith("lege.") && f.type !== "avkrysning" && !verdier[f.id],
    )
    if (tomme.length === 0) return
    const fylt = fyllFraKilder(tomme, {}, undefined, lege)
    if (!tomme.some((f) => fylt[f.id])) return
    void oppdater({ skjemaVerdier: { ...verdier, ...fylt } })
  }, [lege, skjema, verdier, oppdater])

  if (!aktiv) return null

  async function tilbakeTilKonsultasjon() {
    const fra = aktiv?.fraKonsultasjon
    if (!fra) return
    const k = await hentKonsultasjon(fra.id)
    if (k) setAktiv(k)
    else setMelding({ type: "info", tekst: "Konsultasjonen finnes ikke lenger på denne maskinen (slettes etter 24 timer)." })
  }

  const p = pasient ?? TOM_PASIENT
  const fnrFeil = Boolean(p.fnr) && !erGyldigFnr(p.fnr)
  const visPasientSkjema = redigerPasient || !pasient
  const aiFelt = new Set(aktiv.skjemaAiFelt ?? [])

  async function velgSkjema(s: SkjemaDefinisjon) {
    setMelding(null)
    await oppdater({
      skjema: s,
      skjemaVerdier: fyllFraKilder(s.felter, {}, pasient, lege),
      skjemaAiFelt: [],
      stikkord: [s.navn],
    })
  }

  async function byttSkjema() {
    const harVerdier = Object.values(verdier).some((v) => v !== "" && v !== undefined)
    if (harVerdier && !window.confirm("Feltene tømmes når du bytter skjema. Fortsette?")) return
    setMelding(null)
    await oppdater({ skjema: undefined, skjemaVerdier: {}, skjemaAiFelt: [], stikkord: [], status: "ny" })
  }

  async function tom() {
    if (!skjema || !window.confirm("Tømme alle feltene i skjemaet?")) return
    setMelding(null)
    await oppdater({ skjemaVerdier: fyllFraKilder(skjema.felter, {}, pasient, lege), skjemaAiFelt: [], status: "ny" })
  }

  async function settVerdi(felt: SkjemaFelt, verdi: SkjemaVerdi | undefined) {
    const nye = { ...verdier }
    if (verdi === undefined) delete nye[felt.id]
    else nye[felt.id] = verdi
    await oppdater({
      skjemaVerdier: nye,
      ...(aiFelt.has(felt.id) ? { skjemaAiFelt: [...aiFelt].filter((id) => id !== felt.id) } : {}),
    })
  }

  async function fyllMedAi() {
    if (!skjema || !aktiv || fyller) return
    setMelding(null)
    setFyller(true)
    const avbryt = new AbortController()
    avbrytRef.current = avbryt
    try {
      const { overrides } = await hentAiOppsett()
      const foresporsel = byggSkjemaForesporsel(
        {
          skjema,
          kontekst: aktiv.kontekst,
          vedlegg: (aktiv.vedlegg ?? []).map((v) => ({ mimeType: v.mimeType, base64: v.base64, oppgave: v.oppgave })),
        },
        overrides,
      )
      const forslag = tolkSkjemaSvar(skjema, await hentStrukturertSvar(foresporsel, "skjema", avbryt.signal))

      // Felt legen har skrevet i selv, beholdes. Bare tomme felt og tidligere AI-forslag byttes.
      const nye = { ...verdier }
      const fylt: string[] = []
      let beholdt = 0
      for (const [id, v] of Object.entries(forslag)) {
        const gammel = verdier[id]
        const egenTekst = gammel !== undefined && gammel !== "" && !aiFelt.has(id)
        if (egenTekst) {
          beholdt++
          continue
        }
        nye[id] = v
        fylt.push(id)
      }
      await oppdater({ skjemaVerdier: nye, skjemaAiFelt: fylt, status: "ferdig" })
      const antallAi = skjema.felter.filter((f) => f.kilde === "ai").length
      setMelding({
        type: fylt.length ? "ok" : "info",
        tekst:
          (fylt.length
            ? `Forslag lagt inn i ${fylt.length} av ${antallAi} felt. Les over — felt uten grunnlag i konteksten står tomme.`
            : "Fant ikke grunnlag for noen av feltene i konteksten.") +
          (beholdt ? ` ${beholdt} felt du har skrevet i selv, er ikke endret.` : ""),
      })
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMelding({ type: "feil", tekst: (err as Error).message || "Kunne ikke fylle ut skjemaet." })
      }
    } finally {
      setFyller(false)
    }
  }

  // ─── Send til skjema i Pridok ──────────────────────────────────────────────

  const pridokFelt = pridokFeltliste(skjema?.felter ?? [])
  const etikett = (id: string) => skjema?.felter.find((f) => f.id === id)?.etikett ?? id

  async function startSending() {
    if (!skjema) return
    setMelding(null)
    setSender(true)
    const svar = await finnPridokSkjema(pridokFelt)
    setSender(false)
    if (!svar.ok) {
      setMelding({ type: "feil", tekst: `Kunne ikke sende til Pridok${svar.melding ? `: ${svar.melding}` : "."}` })
      return
    }
    if (svar.skjema.length === 0) {
      setMelding({
        type: "feil",
        tekst:
          svar.antallFaner === 0
            ? "Fant ingen åpen Pridok-fane. Åpne skjemaet i Pridok og prøv igjen."
            : `Fant ikke skjemaet i Pridok. Åpne «${skjema.navn}» for pasienten og prøv igjen.`,
      })
      return
    }
    if (svar.skjema.length === 1) velgDok(svar.skjema[0])
    else setSkjemaValg(svar.skjema)
  }

  function velgDok(dok: PridokSkjema) {
    setSkjemaValg(null)
    if (dok.laast) {
      setMelding({ type: "feil", tekst: "Skjemaet som er åpent i Pridok er låst. Åpne et nytt og prøv igjen." })
      return
    }
    if (annenPasient(pasient, dok)) setBekreft({ dok, steg: "pasient" })
    else etterPasientsjekk(dok)
  }

  function etterPasientsjekk(dok: PridokSkjema) {
    if (dok.harInnhold.length) setBekreft({ dok, steg: "innhold" })
    else {
      setBekreft(null)
      void fyllDok(dok, "tom")
    }
  }

  async function fyllDok(dok: PridokSkjema, modus: JournalModus) {
    setBekreft(null)
    setSender(true)
    const tilSending = pridokFelt
      .filter((f) => {
        const v = verdier[f.id]
        return typeof v === "boolean" || (typeof v === "string" && v.trim() !== "")
      })
      .map((f) => ({ ...f, verdi: verdier[f.id] }))
    if (tilSending.length === 0) {
      setSender(false)
      setMelding({ type: "info", tekst: "Ingen felt er fylt ut ennå." })
      return
    }
    const svar = await fyllPridokSkjema(dok, tilSending, modus)
    setSender(false)
    if (svar.ok) {
      const hvem = dok.navn ? ` for ${dok.navn.replace(/\s+/g, " ")}` : ""
      setMelding({
        type: svar.urort.length ? "info" : "ok",
        tekst:
          `Lagt inn ${svar.fylt.length} felt i ${dok.tittel}${hvem}. Se over i Pridok.` +
          (svar.urort.length ? ` Disse må du fylle ut selv der: ${svar.urort.map(etikett).join(" · ")}` : ""),
      })
      return
    }
    if (svar.grunn === "har-innhold") {
      setBekreft({ dok: { ...dok, harInnhold: svar.felt ?? dok.harInnhold }, steg: "innhold" })
      return
    }
    setMelding({
      type: "feil",
      tekst:
        svar.grunn === "ingen-fane"
          ? "Pridok-fanen er lukket. Åpne skjemaet og prøv igjen."
          : svar.grunn === "fant-ikke-felt"
            ? "Fant ikke skjemaet i Pridok lenger. Er det lukket? Prøv igjen."
            : `Kunne ikke sende til Pridok${svar.melding ? `: ${svar.melding}` : "."}`,
    })
  }

  async function kopier() {
    if (!skjema) return
    try {
      await navigator.clipboard.writeText(skjemaSomTekst(skjema.felter, verdier))
      setKopiert(true)
      setTimeout(() => setKopiert(false), 1500)
    } catch {
      // utklippstavlen er ikke tilgjengelig
    }
  }

  /** Henter den tomme malen, fyller den ut her i nettleseren og lagrer filen hos legen. */
  async function lastNedSomPdf() {
    if (!skjema?.pdf || lagerPdf) return
    setMelding(null)
    setLagerPdf(true)
    try {
      const svar = await fetch(`/api/skjema/${skjema.id}/pdf`, { cache: "no-store" })
      if (svar.status === 404) throw new Error("PDF-malen er fjernet av administrator. Bytt skjema for å hente siste versjon.")
      if (!svar.ok) throw new Error("Kunne ikke hente PDF-malen.")
      const endret = svar.headers.get("X-Pdf-Versjon") !== skjema.pdf.versjon
      // Fortsettelsesarket merkes med skjema og pasient, så et løst ark kan føres tilbake
      const hvem = [pasient?.navn.trim(), pasient?.fnr ? `f.nr. ${formaterFnr(pasient.fnr)}` : pasient?.fodt ? `født ${pasient.fodt}` : ""]
        .filter(Boolean)
        .join(", ")
      const ut = await fyllPdf(new Uint8Array(await svar.arrayBuffer()), skjema.felter, verdier, {
        tittel: skjema.navn,
        undertittel: hvem,
      })
      if (ut.fylt === 0) {
        setMelding({ type: "info", tekst: "Ingen av de utfylte feltene er koblet til PDF-en." })
        return
      }
      lastNedPdf(ut.pdf, pdfFilnavn(skjema.navn))
      const merknader = [
        ut.forLangt.length
          ? `Teksten fikk ikke plass i: ${ut.forLangt.map(etikett).join(" · ")}. Hele teksten står på fortsettelsesarket bakerst — kort ned teksten og last ned på nytt hvis mottakeren ikke tar imot ekstra ark.`
          : "",
        ut.paaArk.length ? `På fortsettelsesarket bakerst står også: ${ut.paaArk.map(etikett).join(" · ")}.` : "",
        ut.mangler.length ? `Disse fant ikke plassen sin i PDF-en og må fylles inn for hånd: ${ut.mangler.map(etikett).join(" · ")}.` : "",
        endret ? "PDF-malen er endret av administrator etter at du valgte skjemaet — se nøye over, eller bytt skjema og fyll ut på nytt." : "",
      ].filter(Boolean)
      setMelding({
        type: merknader.length ? "info" : "ok",
        tekst:
          `PDF lastet ned med ${ut.fylt} felt. Se over før du sender den. Filen inneholder pasientopplysninger — slett den fra maskinen når den er sendt.` +
          (merknader.length ? ` ${merknader.join(" ")}` : ""),
      })
    } catch (err) {
      setMelding({ type: "feil", tekst: (err as Error).message || "Kunne ikke lage PDF-en." })
    } finally {
      setLagerPdf(false)
    }
  }

  // ─── Visning ───────────────────────────────────────────────────────────────

  const q = sok.trim().toLowerCase()
  const synligeKategorier = (kategorier ?? [])
    .map((k) => ({
      ...k,
      skjemaer: k.skjemaer.filter(
        (s) => !q || `${s.navn} ${s.beskrivelse ?? ""} ${k.navn}`.toLowerCase().includes(q),
      ),
    }))
    .filter((k) => k.skjemaer.length > 0)

  const harVerdier = Object.values(verdier).some((v) => typeof v === "boolean" || (typeof v === "string" && v.trim()))
  const flereFaner = new Set(skjemaValg?.map((s) => s.tabId)).size > 1

  return (
    <div className="h-full flex flex-col">
      {/* Topprad */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-3">
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 text-xs font-medium shrink-0 bg-rose-100 text-rose-700 border-rose-200"
        >
          <FileText className="w-3.5 h-3.5" />
          Skjema
        </Badge>
        {aktiv.fraKonsultasjon && (
          <button
            type="button"
            onClick={tilbakeTilKonsultasjon}
            className="flex shrink-0 items-center gap-1 text-xs text-slate-500 hover:text-slate-800 hover:underline"
            title="Åpne konsultasjonen skjemaet ble startet fra"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Fra {aktiv.fraKonsultasjon.etikett.toLowerCase()} kl.{" "}
            {new Date(aktiv.fraKonsultasjon.createdAt).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
          </button>
        )}
        {skjema && (
          <>
            <span className="text-sm font-medium text-slate-800 truncate">{skjema.navn}</span>
            <span className="text-xs text-slate-400 shrink-0">{skjema.kategori}</span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={byttSkjema}>
              Bytt skjema
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-slate-400 hover:text-red-600"
              title="Tøm feltene"
              onClick={tom}
              disabled={!harVerdier}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-5 space-y-5">
          {/* Pasient */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <UserRound className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-semibold text-slate-700">Pasient</h2>
              {pasient?.fraPridok && !redigerPasient && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700">
                  Hentet fra Pridok
                </span>
              )}
              <div className="flex-1" />
              {harUtvidelse && (
                <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500" onClick={() => hentPasient(false)}>
                  <RefreshCw className="w-3.5 h-3.5" /> Hent fra Pridok
                </Button>
              )}
              {pasient && (
                <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => setRedigerPasient((v) => !v)}>
                  {redigerPasient ? "Ferdig" : "Endre"}
                </Button>
              )}
            </div>

            {visPasientSkjema ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-6">
                <Input
                  className="sm:col-span-3 text-sm"
                  placeholder="Navn"
                  aria-label="Pasientens navn"
                  value={p.navn}
                  onChange={(e) => settPasient({ ...p, navn: e.target.value, fraPridok: false })}
                />
                <Input
                  className={`sm:col-span-2 text-sm ${fnrFeil ? "border-red-300" : ""}`}
                  placeholder="Fødselsnummer (11 siffer)"
                  aria-label="Fødselsnummer"
                  inputMode="numeric"
                  value={p.fnr}
                  onChange={(e) => settPasient({ ...p, fnr: rensFnr(e.target.value).slice(0, 11), fraPridok: false })}
                />
                <Input
                  className="sm:col-span-1 text-sm"
                  placeholder="Født"
                  aria-label="Fødselsdato"
                  value={p.fodt}
                  onChange={(e) => settPasient({ ...p, fodt: e.target.value, fraPridok: false })}
                />
                <Input
                  className="sm:col-span-3 text-sm"
                  placeholder="Adresse"
                  aria-label="Adresse"
                  value={p.adresse}
                  onChange={(e) => settPasient({ ...p, adresse: e.target.value, fraPridok: false })}
                />
                <Input
                  className="sm:col-span-1 text-sm"
                  placeholder="Postnr."
                  aria-label="Postnummer"
                  inputMode="numeric"
                  value={p.postnr}
                  onChange={(e) => settPasient({ ...p, postnr: e.target.value.replace(/\D/g, "").slice(0, 4), fraPridok: false })}
                />
                <Input
                  className="sm:col-span-2 text-sm"
                  placeholder="Poststed"
                  aria-label="Poststed"
                  value={p.poststed}
                  onChange={(e) => settPasient({ ...p, poststed: e.target.value, fraPridok: false })}
                />
                {!pasient && (
                  <p className="sm:col-span-6 text-xs text-slate-400">
                    {harUtvidelse
                      ? "Ingen pasient er hentet fra Pridok. Åpne pasienten der og trykk «Hent fra Pridok», eller skriv inn selv."
                      : "Med nettleserutvidelsen (versjon 1.2 eller nyere) hentes pasienten som er åpen i Pridok automatisk."}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-medium">{p.navn || "Uten navn"}</span>
                {p.fnr ? ` · ${formaterFnr(p.fnr)}` : p.fodt ? ` · født ${p.fodt}` : ""}
                {p.adresse && ` · ${p.adresse}${p.postnr ? `, ${p.postnr} ${p.poststed}` : ""}`}
              </p>
            )}
            {fnrFeil && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5" />
                Fødselsnummeret er ikke gyldig (kontrollsifrene stemmer ikke). Sjekk det før skjemaet sendes.
              </p>
            )}
          </section>

          {/* Velg skjema */}
          {!skjema && (
            <section className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  autoFocus
                  className="pl-8 text-sm"
                  placeholder="Søk etter skjema"
                  value={sok}
                  onChange={(e) => setSok(e.target.value)}
                />
              </div>
              {lastFeil && <p className="text-sm text-red-600">Kunne ikke hente skjemaene. Last siden på nytt.</p>}
              {kategorier && kategorier.length === 0 && (
                <p className="text-sm text-slate-500">
                  Ingen skjema er lagt inn ennå. En administrator legger dem inn under Admin → Skjema.
                </p>
              )}
              {kategorier && kategorier.length > 0 && synligeKategorier.length === 0 && (
                <p className="text-sm text-slate-500">Ingen skjema passer med søket.</p>
              )}
              {synligeKategorier.map((k) => (
                <div key={k.id}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{k.navn}</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {k.skjemaer.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => velgSkjema(s)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-rose-300 hover:bg-rose-50"
                      >
                        <div className="text-sm font-medium text-slate-800">{s.navn}</div>
                        {s.beskrivelse && <div className="mt-0.5 text-xs text-slate-500">{s.beskrivelse}</div>}
                        <div className="mt-1 text-xs text-slate-400">
                          {s.felter.length} felt{harPridokFelt(s) ? " · kan sendes til Pridok" : ""}{s.pdf ? " · PDF" : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Kontekst og felt */}
          {skjema && (
            <div className="grid gap-5 lg:grid-cols-5">
              <section className="lg:col-span-2 space-y-3 lg:sticky lg:top-0 lg:self-start">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">Kontekst</h2>
                  <button
                    type="button"
                    onClick={() => setUtvidetKontekst(true)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Utvid Kontekst"
                    title="Utvid"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="relative">
                  <Textarea
                    ref={kontekstRef}
                    placeholder="Skriv, dikter eller lim inn det skjemaet skal bygge på — sykehistorie, journalnotater, epikriser, funksjonsvurdering …"
                    value={aktiv.kontekst}
                    onChange={(e) => oppdater({ kontekst: e.target.value })}
                    className="min-h-56 max-h-[50vh] text-sm border-slate-200 bg-white pr-10"
                  />
                  <div className="absolute bottom-1.5 right-1.5">
                    <DikteringKnapp
                      tekst={aktiv.kontekst}
                      onTekst={(ny) => oppdater({ kontekst: ny })}
                      textareaRef={kontekstRef}
                      disabled={fyller}
                    />
                  </div>
                </div>
                <VedleggPanel
                  modus="enkel"
                  kompakt
                  vedlegg={aktiv.vedlegg ?? []}
                  onChange={(nye: Vedlegg[]) => oppdater({ vedlegg: nye })}
                  kontekst={aktiv.kontekst}
                  onKontekst={(ny) => oppdater({ kontekst: ny })}
                />
                {harAiFelt(skjema) && (
                  <Button
                    className="w-full gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
                    disabled={fyller || (!aktiv.kontekst.trim() && !(aktiv.vedlegg ?? []).length)}
                    onClick={fyllMedAi}
                  >
                    {fyller ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {fyller ? "Fyller ut – vennligst vent …" : aiFelt.size || aktiv.status === "ferdig" ? "Fyll ut på nytt" : "Fyll ut skjemaet"}
                  </Button>
                )}
                {skjema.beskrivelse && <p className="text-xs text-slate-400">{skjema.beskrivelse}</p>}
              </section>

              <section className="lg:col-span-3 space-y-3" aria-busy={fyller}>
                {fyller && (
                  <div
                    role="status"
                    className="sticky top-0 z-10 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm"
                  >
                    <Loader2 className="w-5 h-5 shrink-0 animate-spin text-rose-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-rose-800">AI fyller ut skjemaet – vennligst vent</p>
                      <p className="text-xs text-rose-700">
                        Det tar vanligvis under et minutt. Feltene er låst imens.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => avbrytRef.current?.abort()}>
                      Avbryt
                    </Button>
                  </div>
                )}
                <div className={`space-y-3 ${fyller ? "pointer-events-none opacity-50" : ""}`} inert={fyller}>
                {lege && harLegeFelt(skjema) && (!lege.navn || !lege.hpr) && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Skjemaet har felt for legens {!lege.navn && !lege.hpr ? "navn og HPR-nummer" : !lege.hpr ? "HPR-nummer" : "navn"}.
                    Legg det inn under{" "}
                    <a href="/innstillinger" className="font-medium underline">
                      Innstillinger
                    </a>
                    , så fylles det inn av seg selv.
                  </p>
                )}
                {skjema.felter.map((f, i) => {
                  const nySeksjon = f.seksjon && f.seksjon !== skjema.felter[i - 1]?.seksjon
                  const v = verdier[f.id]
                  const fraAi = aiFelt.has(f.id)
                  return (
                    <div key={f.id}>
                      {nySeksjon && (
                        <h3 className="mb-2 mt-4 first:mt-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {f.seksjon}
                        </h3>
                      )}
                      <div className={`rounded-lg border bg-white p-3 ${fraAi ? "border-rose-200" : "border-slate-200"}`}>
                        <div className="flex items-start gap-2">
                          <label htmlFor={`felt-${f.id}`} className="flex-1 text-sm font-medium text-slate-700">
                            {f.etikett}
                          </label>
                          {fraAi && (
                            <span
                              className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium"
                              title="Forslag fra AI — ikke lest over ennå"
                            >
                              AI-forslag
                            </span>
                          )}
                        </div>
                        {f.type === "avkrysning" ? (
                          <div className="mt-2 flex gap-1.5" role="group" aria-label={f.etikett}>
                            {(
                              [
                                ["Ja", true],
                                ["Nei", false],
                                ["Ubesvart", undefined],
                              ] as const
                            ).map(([tekst, verdi]) => (
                              <button
                                key={tekst}
                                type="button"
                                aria-pressed={v === verdi}
                                onClick={() => settVerdi(f, verdi)}
                                className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                                  v === verdi
                                    ? "border-rose-300 bg-rose-600 text-white"
                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {tekst}
                              </button>
                            ))}
                          </div>
                        ) : f.type === "tekst" ? (
                          <Input
                            id={`felt-${f.id}`}
                            className="mt-2 text-sm"
                            value={typeof v === "string" ? v : ""}
                            onChange={(e) => settVerdi(f, e.target.value)}
                          />
                        ) : (
                          <Textarea
                            id={`felt-${f.id}`}
                            className="mt-2 min-h-20 text-sm"
                            value={typeof v === "string" ? v : ""}
                            onChange={(e) => settVerdi(f, e.target.value)}
                          />
                        )}
                        {skjema.pdf && f.pdf?.ark && (
                          <p className="mt-1 text-xs text-slate-400">Settes på fortsettelsesarket bakerst i PDF-en.</p>
                        )}
                        {f.type !== "avkrysning" && f.maksTegn && typeof v === "string" && v.length > 0 && (
                          <p
                            className={`mt-1 text-right text-xs ${v.trim().length > f.maksTegn ? "text-amber-700" : "text-slate-400"}`}
                          >
                            {v.trim().length} av ca. {f.maksTegn} tegn
                            {v.trim().length > f.maksTegn &&
                              " — mer enn det er plass til i PDF-en. Skriften krympes, og blir det fortsatt for langt, havner teksten på et fortsettelsesark."}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Bunnlinje */}
      {(skjema || melding) && (
        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-3 flex items-center gap-3">
          {melding ? (
            <p
              role="status"
              className={`flex-1 flex items-start gap-2 text-sm ${
                melding.type === "feil" ? "text-red-700" : melding.type === "info" ? "text-amber-800" : "text-emerald-700"
              }`}
            >
              {melding.type === "ok" ? (
                <Check className="mt-0.5 w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 w-4 h-4 shrink-0" />
              )}
              <span>{melding.tekst}</span>
            </p>
          ) : (
            <p className="flex-1 text-xs text-slate-400">
              Forslagene er laget av AI ut fra konteksten. Les over hvert felt — du står ansvarlig for innholdet.
            </p>
          )}
          {skjema && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" disabled={!harVerdier} onClick={kopier}>
                {kopiert ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {kopiert ? "Kopiert" : "Kopier som tekst"}
              </Button>
              {skjema.pdf && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  disabled={!harVerdier || lagerPdf || fyller}
                  onClick={lastNedSomPdf}
                >
                  <Download className="w-4 h-4" />
                  {lagerPdf ? "Lager PDF…" : "Last ned PDF"}
                </Button>
              )}
              {harUtvidelse && pridokFelt.length > 0 && (
                <Button
                  size="sm"
                  className="gap-1.5 shrink-0 bg-sky-700 hover:bg-sky-800"
                  disabled={!harVerdier || sender || fyller}
                  onClick={startSending}
                >
                  <Send className="w-4 h-4" />
                  {sender ? "Sender…" : "Send til skjema i Pridok"}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Flere pasienter åpne i Pridok */}
      {/* Utvidet kontekstfelt */}
      <Dialog open={utvidetKontekst} onOpenChange={setUtvidetKontekst}>
        <DialogContent className="!w-[90vw] !max-w-[1400px] h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Kontekst</DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            placeholder="Skriv eller lim inn det skjemaet skal bygge på — sykehistorie, journalnotater, epikriser, funksjonsvurdering …"
            value={aktiv.kontekst}
            onChange={(e) => oppdater({ kontekst: e.target.value })}
            className="flex-1 resize-none text-sm border-slate-200 min-h-0"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={pasientValg !== null} onOpenChange={(open) => { if (!open) setPasientValg(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hvilken pasient gjelder skjemaet?</DialogTitle>
            <DialogDescription>Det er {pasientValg?.length} pasienter åpne i Pridok.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {pasientValg?.map((pp) => (
              <button
                key={`${pp.tabId}:${pp.navn}:${pp.fodt}`}
                type="button"
                onClick={async () => {
                  setPasientValg(null)
                  setRedigerPasient(false)
                  await settPasient(fraPridok(pp))
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-rose-300 hover:bg-rose-50"
              >
                <div className="font-medium text-slate-800">
                  {pp.navn}
                  <span className="font-normal text-slate-500"> · født {pp.fodt}</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">Pridok-fane {pp.fane}</div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasientValg(null)}>
              Avbryt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flere åpne skjema i Pridok */}
      <Dialog open={skjemaValg !== null} onOpenChange={(open) => { if (!open) setSkjemaValg(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hvilket skjema skal fylles ut?</DialogTitle>
            <DialogDescription>
              Det er {skjemaValg?.length} åpne dokumenter i Pridok med disse feltene. Sjekk at pasienten stemmer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {skjemaValg?.map((d) => (
              <button
                key={`${d.tabId}:${d.dokId}`}
                type="button"
                onClick={() => velgDok(d)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-sky-300 hover:bg-sky-50"
              >
                <div className="font-medium text-slate-800">
                  {d.navn ?? "Ukjent pasient"}
                  {d.fodt && <span className="font-normal text-slate-500"> · født {d.fodt}</span>}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {d.tittel}
                  {flereFaner && ` · Pridok-fane ${d.fane}`}
                  {` · ${d.treff} av ${pridokFelt.length} felt funnet`}
                  {d.laast ? " · låst" : d.harInnhold.length > 0 ? " · har tekst fra før" : " · tomt"}
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkjemaValg(null)}>
              Avbryt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Annen pasient / feltene har tekst */}
      <Dialog open={bekreft !== null} onOpenChange={(open) => { if (!open) setBekreft(null) }}>
        <DialogContent>
          {bekreft?.steg === "pasient" ? (
            <>
              <DialogHeader>
                <DialogTitle>Skjemaet i Pridok gjelder en annen pasient</DialogTitle>
                <DialogDescription>
                  Her er pasienten {p.navn}
                  {p.fodt && ` (født ${p.fodt})`}. Skjemaet som er åpent i Pridok gjelder {bekreft.dok.navn}
                  {bekreft.dok.fodt && ` (født ${bekreft.dok.fodt})`}. Vil du likevel sende?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBekreft(null)}>
                  Avbryt
                </Button>
                <Button className="bg-red-600 hover:bg-red-700" onClick={() => etterPasientsjekk(bekreft.dok)}>
                  Send likevel
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Skjemaet har allerede tekst</DialogTitle>
                <DialogDescription>
                  {bekreft && (
                    <>
                      {bekreft.dok.tittel} har allerede tekst i {bekreft.dok.harInnhold.length} felt (
                      {bekreft.dok.harInnhold.slice(0, 3).map(etikett).join(" · ")}
                      {bekreft.dok.harInnhold.length > 3 && " …"}). Vil du legge til under det som står der, eller
                      erstatte teksten?
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBekreft(null)}>
                  Avbryt
                </Button>
                <Button variant="outline" onClick={() => bekreft && fyllDok(bekreft.dok, "erstatt")}>
                  Erstatt
                </Button>
                <Button className="bg-sky-700 hover:bg-sky-800" onClick={() => bekreft && fyllDok(bekreft.dok, "legg-til")}>
                  Legg til under
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
