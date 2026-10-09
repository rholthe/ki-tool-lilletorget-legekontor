"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { sendEpost, tilgangsforesporselMottaker } from "@/lib/mail"
import { headers } from "next/headers"
import { TILBAKESTILLING_SELV_MS, finnBrukerForToken, forbrukToken } from "@/lib/passord-token"
import { sendPassordEndret, sendPassordlenke } from "@/lib/passord-epost"
import { hentGjeldendeDpa } from "@/lib/dpa"

// ─── Tilgangsforespørsel (offentlig skjema) ──────────────────────────────────

const foresporselSchema = z.object({
  navn: z.string().min(2, "Navn må ha minst 2 tegn"),
  epost: z.string().email("Ugyldig e-postadresse"),
  arbeidssted: z.string().min(2, "Oppgi arbeidssted/klinikk"),
})

export type TilgangState = {
  errors?: { navn?: string[]; epost?: string[]; arbeidssted?: string[] }
  message?: string
  success?: boolean
}

export async function sendTilgangsforesporsel(
  _prev: TilgangState,
  formData: FormData
): Promise<TilgangState> {
  const parsed = foresporselSchema.safeParse({
    navn: formData.get("navn"),
    epost: formData.get("epost"),
    arbeidssted: formData.get("arbeidssted"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { navn, epost, arbeidssted } = parsed.data

  try {
    await sendEpost({
      til: tilgangsforesporselMottaker(),
      svarTil: epost,
      emne: `Tilgangsforespørsel – ${navn}`,
      tekst:
        `Ny tilgangsforespørsel til legeassist:\n\n` +
        `Navn: ${navn}\n` +
        `E-post: ${epost}\n` +
        `Arbeidssted/klinikk: ${arbeidssted}\n`,
      html:
        `<p>Ny tilgangsforespørsel til legeassist:</p>` +
        `<ul>` +
        `<li><strong>Navn:</strong> ${navn}</li>` +
        `<li><strong>E-post:</strong> ${epost}</li>` +
        `<li><strong>Arbeidssted/klinikk:</strong> ${arbeidssted}</li>` +
        `</ul>`,
    })
  } catch (e) {
    console.error("Klarte ikke sende tilgangsforespørsel:", e)
    return {
      message: "Kunne ikke sende forespørselen akkurat nå. Prøv igjen senere.",
    }
  }

  return {
    success: true,
    message: "Forespørselen er sendt. Du blir kontaktet når kontoen er klar.",
  }
}

// ─── Passordoppsett via invitasjonslenke ─────────────────────────────────────

const passordSchema = z
  .string()
  .min(8, "Passord må ha minst 8 tegn")
  .regex(/[A-Z]/, "Må inneholde minst én stor bokstav")
  .regex(/[0-9]/, "Må inneholde minst ett tall")

export type SettPassordState = {
  error?: string
  success?: boolean
}

export async function settPassordMedToken(
  _prev: SettPassordState,
  formData: FormData
): Promise<SettPassordState> {
  const token = String(formData.get("token") ?? "")
  const passord = String(formData.get("passord") ?? "")
  const gjenta = String(formData.get("gjenta") ?? "")
  const godta = formData.get("godta") === "ja"

  const bruker = await finnBrukerForToken(token)
  if (!bruker) {
    return { error: "Lenken er ugyldig eller utløpt. Be om en ny lenke på innloggingssiden eller hos administrator." }
  }

  const parsed = passordSchema.safeParse(passord)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ugyldig passord" }
  }

  if (passord !== gjenta) {
    return { error: "Passordene er ikke like" }
  }

  const passwordHash = await bcrypt.hash(passord, 12)

  // Tilbakestilling: bare passordet byttes. Signaturen på databehandleravtalen
  // står (er den utdatert, tar /godta-avtale seg av det etter innlogging)
  if (bruker.harPassord) {
    await prisma.user.update({ where: { id: bruker.id }, data: { passwordHash } })
    await forbrukToken(bruker.id)
    await sendPassordEndret(bruker)
    return { success: true }
  }

  if (!godta) {
    return { error: "Du må signere databehandleravtalen for å fullføre." }
  }

  const gjeldende = await hentGjeldendeDpa()
  await prisma.user.update({
    where: { id: bruker.id },
    data: {
      passwordHash,
      dpaSignedAt: new Date(),
      dpaVersion: gjeldende.versjon,
    },
  })
  await forbrukToken(bruker.id)

  return { success: true }
}

// ─── Glemt passord ────────────────────────────────────────────────────────────

export type GlemtPassordState = { sendt?: boolean; error?: string }

/** Forespørsler siste time, per e-post og per IP. I minnet: én serverprosess. */
const forsok = new Map<string, number[]>()
const VINDU_MS = 60 * 60 * 1000
const MAKS_PER_EPOST = 3
const MAKS_PER_IP = 10

function forMange(nokkel: string, maks: number): boolean {
  const naa = Date.now()
  const liste = (forsok.get(nokkel) ?? []).filter((t) => naa - t < VINDU_MS)
  if (liste.length >= maks) {
    forsok.set(nokkel, liste)
    return true
  }
  liste.push(naa)
  forsok.set(nokkel, liste)
  return false
}

/**
 * Sender lenke for nytt passord. Svarer alltid det samme, og sender i
 * bakgrunnen, så verken svaret eller svartiden avslører om adressen har konto.
 */
export async function bePassordlenke(
  _prev: GlemtPassordState,
  formData: FormData
): Promise<GlemtPassordState> {
  const epost = String(formData.get("epost") ?? "").trim().toLowerCase()
  if (!z.string().email().safeParse(epost).success) {
    return { error: "Skriv inn en gyldig e-postadresse." }
  }

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "ukjent"
  // Begge tellerne oppdateres, så en IP ikke kan prøve mange adresser
  const epostFull = forMange(`epost:${epost}`, MAKS_PER_EPOST)
  const ipFull = forMange(`ip:${ip}`, MAKS_PER_IP)
  if (epostFull || ipFull) return { sendt: true }

  void (async () => {
    try {
      const bruker = await prisma.user.findUnique({
        where: { email: epost },
        select: { id: true, email: true, name: true },
      })
      if (!bruker) return
      await sendPassordlenke(bruker, {
        gyldigMs: TILBAKESTILLING_SELV_MS,
        gyldigTekst: "én time",
        avAdministrator: false,
      })
    } catch (e) {
      console.error(`[passord] sending av lenke feilet: ${e instanceof Error ? e.message : e}`)
    }
  })()

  return { sendt: true }
}
