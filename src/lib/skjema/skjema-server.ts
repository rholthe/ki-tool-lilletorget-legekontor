import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import type { SkjemaFelt, SkjemaKategoriAdmin } from "@/lib/skjema/typer"

/**
 * Skjemadefinisjoner i databasen. Bare definisjoner — aldri utfylte verdier.
 * Felt-id-ene brukes som nøkler i verktøykallet til Claude og må derfor være
 * korte og uten spesialtegn.
 */

const brok = z.number().min(0).max(1)
const pdfMaal = z
  .object({
    felt: z.string().min(1).max(500).optional(),
    valg: z.string().min(1).max(500).optional(),
    boks: z.object({ side: z.number().int().min(0).max(500), x: brok, y: brok, b: brok, h: brok }).optional(),
    ark: z.boolean().optional(),
  })
  .optional()

/** Største PDF-mal som tas imot. MariaDB tar 16 MB per pakke som standard. */
export const MAKS_PDF_BYTE = 10 * 1024 * 1024

export const feltSkjema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
  etikett: z.string().trim().min(1).max(500),
  type: z.enum(["tekst", "flerlinje", "avkrysning"]),
  kilde: z.enum([
    "ai",
    "manuell",
    "pasient.navn",
    "pasient.fornavn",
    "pasient.etternavn",
    "pasient.fnr",
    "pasient.fodt",
    "pasient.adresse",
    "pasient.postnr",
    "pasient.poststed",
    "lege.navn",
    "lege.fornavn",
    "lege.etternavn",
    "lege.hpr",
    "dato.idag",
  ]),
  seksjon: z.string().trim().max(200).optional(),
  instruks: z.string().trim().max(2000).optional(),
  pridokTekst: z.string().trim().max(500).optional(),
  pdf: pdfMaal,
  pdfNei: pdfMaal,
  maksTegn: z.number().int().min(1).max(50_000).optional(),
})

export const felterSkjema = z
  .array(feltSkjema)
  .min(1, "Skjemaet må ha minst ett felt")
  .max(200, "Maks 200 felt")
  .refine((f) => new Set(f.map((x) => x.id)).size === f.length, "To felt har samme id")

export function tolkFelter(json: string): SkjemaFelt[] {
  try {
    const parsed = felterSkjema.safeParse(JSON.parse(json))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

/** Kategorier med skjema. Uten `alle` bare aktive skjema, og tomme kategorier utelates. */
export async function hentSkjemaKategorier(alle = false): Promise<SkjemaKategoriAdmin[]> {
  const kategorier = await prisma.skjemaKategori.findMany({
    orderBy: [{ rekkefolge: "asc" }, { navn: "asc" }],
    include: {
      skjemaer: {
        where: alle ? {} : { aktiv: true },
        orderBy: { navn: "asc" },
        // Aldri selve filen her — den hentes for seg når den trengs
        include: { pdf: { select: { filnavn: true, updatedAt: true } } },
      },
    },
  })
  return kategorier
    .filter((k) => alle || k.skjemaer.length > 0)
    .map((k) => ({
      id: k.id,
      navn: k.navn,
      rekkefolge: k.rekkefolge,
      skjemaer: k.skjemaer.map((s) => ({
        id: s.id,
        navn: s.navn,
        beskrivelse: s.beskrivelse,
        kategori: k.navn,
        prompt: s.prompt,
        felter: tolkFelter(s.felter),
        pdf: s.pdf ? { filnavn: s.pdf.filnavn, versjon: s.pdf.updatedAt.toISOString() } : null,
        aktiv: s.aktiv,
      })),
    }))
}
