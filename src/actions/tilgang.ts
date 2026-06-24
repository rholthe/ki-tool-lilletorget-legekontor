"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { sendEpost, tilgangsforesporselMottaker } from "@/lib/mail"
import { finnBrukerForToken, forbrukToken } from "@/lib/passord-token"
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
    return { error: "Lenken er ugyldig eller utløpt. Be administrator om en ny invitasjon." }
  }

  const parsed = passordSchema.safeParse(passord)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ugyldig passord" }
  }

  if (passord !== gjenta) {
    return { error: "Passordene er ikke like" }
  }

  if (!godta) {
    return { error: "Du må signere databehandleravtalen for å fullføre." }
  }

  const gjeldende = await hentGjeldendeDpa()
  const passwordHash = await bcrypt.hash(passord, 12)
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
