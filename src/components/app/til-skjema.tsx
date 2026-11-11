"use client"

import { useState } from "react"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import { lagreKonsultasjon, nyKonsultasjon } from "@/lib/idb"
import { konsultasjonEtikett, type Konsultasjon, type Vedlegg } from "@/types/konsultasjon"

type Del = "notat" | "kontekst" | "tilleggsinfo" | "transkript" | "vedlegg"

const MAKS_VEDLEGG = 5

const klokke = (ms: number) => new Date(ms).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
const dato = (ms: number) => new Date(ms).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" })

/** OCR-vedlegg er alt lest inn som tekst i notatet og tas ikke med som fil. */
const vedleggTilSkjema = (k: Konsultasjon): Vedlegg[] =>
  (k.vedlegg ?? []).filter((v) => v.oppgave !== "ocr").slice(0, MAKS_VEDLEGG)

/**
 * Konteksten til en skjemaoppgave som startes fra en konsultasjon. En kopi: skjemaet tåler
 * at konsultasjonen slettes, og senere endringer i notatet slår ikke inn i et skjema legen har lest over.
 */
export function byggSkjemaKontekst(k: Konsultasjon, med: Record<Del, boolean>): string {
  const fra = `${konsultasjonEtikett(k).toLowerCase()} ${dato(k.createdAt)}`
  const deler: [Del, string, string][] = [
    ["notat", `Notat fra ${fra}`, k.notat],
    ["kontekst", "Kontekst (bakgrunn lagt inn av legen)", k.kontekst],
    ["tilleggsinfo", "Tilleggsinfo", k.tilleggsinfo],
    ["transkript", `Transkript fra ${fra}`, k.transkript],
  ]
  return deler
    .filter(([del, , tekst]) => med[del] && tekst.trim())
    .map(([, tittel, tekst]) => `--- ${tittel} ---\n${tekst.trim()}`)
    .join("\n\n")
}

/**
 * «Skjema» i konsultasjonsbildet: oppretter en ny skjemaoppgave med det legen velger å ta med.
 * Alt skjer i nettleseren (IndexedDB); konsultasjonen står urørt.
 */
export function TilSkjema({ disabled, grunn }: { disabled?: boolean; grunn?: string }) {
  const { aktiv, setAktiv } = useKonsultasjon()
  const [apen, setApen] = useState(false)
  const [med, setMed] = useState<Record<Del, boolean>>({
    notat: true,
    kontekst: true,
    tilleggsinfo: true,
    transkript: false,
    vedlegg: true,
  })

  if (!aktiv) return null
  const filer = vedleggTilSkjema(aktiv)
  const valg: { del: Del; tekst: string; finnes: boolean; hjelp: string }[] = [
    { del: "notat", tekst: "Notatet", finnes: Boolean(aktiv.notat.trim()), hjelp: "Også kliniske verktøy og innlest tekst (OCR) som står i notatet" },
    { del: "kontekst", tekst: "Kontekst", finnes: Boolean(aktiv.kontekst.trim()), hjelp: "" },
    { del: "tilleggsinfo", tekst: "Tilleggsinfo", finnes: Boolean(aktiv.tilleggsinfo.trim()), hjelp: "" },
    { del: "vedlegg", tekst: `Vedlegg (${filer.length})`, finnes: filer.length > 0, hjelp: "" },
    {
      del: "transkript",
      tekst: "Transkriptet",
      finnes: Boolean(aktiv.transkript.trim()),
      hjelp: "Langt og dyrere for AI. Ta det med når skjemaet spør om ting som ikke står i notatet",
    },
  ]
  const noeValgt = valg.some((v) => v.finnes && med[v.del])

  async function opprett() {
    if (!aktiv) return
    const ny: Konsultasjon = {
      ...nyKonsultasjon("SKJEMA"),
      kontekst: byggSkjemaKontekst(aktiv, med),
      ...(med.vedlegg && filer.length
        ? { vedlegg: filer.map((v) => ({ id: v.id, navn: v.navn, mimeType: v.mimeType, base64: v.base64, oppgave: "kontekst" as const })) }
        : {}),
      fraKonsultasjon: { id: aktiv.id, etikett: konsultasjonEtikett(aktiv), createdAt: aktiv.createdAt },
    }
    await lagreKonsultasjon(ny)
    setApen(false)
    setAktiv(ny)
    window.dispatchEvent(new Event("legeassist:refresh-liste"))
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-sm"
        disabled={disabled}
        onClick={() => setApen(true)}
        title={disabled && grunn ? grunn : "Fyll ut et skjema ut fra denne konsultasjonen"}
      >
        <FileText className="w-4 h-4" />
        Skjema
      </Button>

      <Dialog open={apen} onOpenChange={setApen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fyll ut skjema fra konsultasjonen</DialogTitle>
            <DialogDescription>
              Det du velger, kopieres til konteksten i en ny skjemaoppgave. Der velger du skjema og ser over
              konteksten før AI fyller ut. Konsultasjonen ({klokke(aktiv.createdAt)}) blir stående som den er.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {valg.map((v) => (
              <li key={v.del}>
                <label className={`flex items-start gap-2 text-sm ${v.finnes ? "text-slate-700" : "text-slate-400"}`}>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-rose-600"
                    disabled={!v.finnes}
                    checked={v.finnes && med[v.del]}
                    onChange={(e) => setMed((m) => ({ ...m, [v.del]: e.target.checked }))}
                  />
                  <span>
                    {v.tekst}
                    {!v.finnes && " – tomt"}
                    {v.finnes && v.hjelp && <span className="block text-xs text-slate-400">{v.hjelp}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApen(false)}>
              Avbryt
            </Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" disabled={!noeValgt} onClick={opprett}>
              Opprett skjemaoppgave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
