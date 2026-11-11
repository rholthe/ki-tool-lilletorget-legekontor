/**
 * Trekker ut teksten i en PDF i nettleseren (pdf.js). Filen forlater aldri maskinen.
 * Brukes når legen legger en PDF i konteksten: tekst er billigere og raskere for Claude
 * enn selve filen, og legen ser hva som sendes. Skannede dokumenter har ikke noe tekstlag
 * og må fortsatt sendes som PDF.
 */

export interface PdfTekst {
  tekst: string
  sider: number
  /** Sant når PDF-en ser ut til å ha et brukbart tekstlag (ikke skannet). */
  harTekstlag: boolean
}

/** Under dette snittet per side regnes dokumentet som skannet. */
const MIN_TEGN_PER_SIDE = 200

export async function lesPdfTekst(data: ArrayBuffer): Promise<PdfTekst> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

  // pdf.js tar over bufferen, så den får en kopi
  const lasting = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) })
  try {
    const pdf = await lasting.promise
    const sider: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const side = await pdf.getPage(i)
      const innhold = await side.getTextContent()
      let tekst = ""
      for (const item of innhold.items) {
        if (!("str" in item)) continue
        tekst += item.str
        tekst += item.hasEOL ? "\n" : item.str && !item.str.endsWith(" ") ? " " : ""
      }
      sider.push(
        tekst
          .split("\n")
          .map((l) => l.replace(/[ \t]+/g, " ").trim())
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim(),
      )
    }
    const tekst = sider.filter(Boolean).join("\n\n")
    const tegn = tekst.replace(/\s/g, "").length
    return { tekst, sider: pdf.numPages, harTekstlag: tegn >= MIN_TEGN_PER_SIDE * pdf.numPages }
  } finally {
    await lasting.destroy()
  }
}
