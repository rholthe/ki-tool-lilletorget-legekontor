"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"
import { sendEpost, hentBasisUrl } from "@/lib/mail"
import { lagPassordOppsettToken } from "@/lib/passord-token"
import { slettKoder } from "@/lib/gjenoppretting"
import { varsleNullstilt2fa } from "@/lib/to-faktor-varsel"
import { sendPassordlenke } from "@/lib/passord-epost"
import { TILBAKESTILLING_ADMIN_MS } from "@/lib/passord-token"

const opprettSchema = z.object({
  name: z.string().min(2, "Navn må ha minst 2 tegn"),
  email: z.string().email("Ugyldig e-postadresse"),
})

export type OpprettBrukerState = {
  errors?: { name?: string[]; email?: string[] }
  message?: string
  advarsel?: string
  success?: boolean
}

async function sendInvitasjonsEpost(
  bruker: { id: string; name: string | null; email: string }
): Promise<void> {
  const token = await lagPassordOppsettToken(bruker.id)
  const basis = await hentBasisUrl()
  const lenke = `${basis}/sett-passord?token=${token}`
  const navn = bruker.name ?? "lege"

  await sendEpost({
    til: bruker.email,
    emne: "Velkommen til legeassist – sett passordet ditt",
    tekst:
      `Hei ${navn},\n\n` +
      `Det er opprettet en konto for deg i legeassist. ` +
      `For å fullføre oppsettet må du selv velge et passord.\n\n` +
      `Klikk på lenken under for å sette passord (gyldig i 7 dager):\n${lenke}\n\n` +
      `Hvis du ikke forventet denne e-posten kan du se bort fra den.\n\n` +
      `Vennlig hilsen\nlegeassist`,
    html:
      `<p>Hei ${navn},</p>` +
      `<p>Det er opprettet en konto for deg i <strong>legeassist</strong>. ` +
      `For å fullføre oppsettet må du selv velge et passord.</p>` +
      `<p><a href="${lenke}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Sett passord</a></p>` +
      `<p style="color:#64748b;font-size:13px">Lenken er gyldig i 7 dager. Fungerer ikke knappen, lim inn denne adressen i nettleseren:<br>${lenke}</p>` +
      `<p style="color:#64748b;font-size:13px">Hvis du ikke forventet denne e-posten kan du se bort fra den.</p>`,
  })
}

export async function opprettBruker(
  _prevState: OpprettBrukerState,
  formData: FormData
): Promise<OpprettBrukerState> {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return { message: "Uautorisert – kun administratorer kan opprette brukere." }
  }

  const parsed = opprettSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { name, email } = parsed.data

  const eksisterer = await prisma.user.findUnique({ where: { email } })
  if (eksisterer) {
    return { errors: { email: ["E-postadressen er allerede registrert"] } }
  }

  // Konto opprettes uten passord (passwordHash = null) → låst til bruker
  // selv setter passord via invitasjonslenken.
  const bruker = await prisma.user.create({
    data: { name, email },
  })

  revalidatePath("/admin/brukere")

  try {
    await sendInvitasjonsEpost(bruker)
  } catch (e) {
    console.error("Klarte ikke sende invitasjon:", e)
    return {
      success: true,
      message: `Bruker ${email} er opprettet, men invitasjonen kunne ikke sendes.`,
      advarsel: "Sjekk SMTP-oppsettet og bruk «Send invitasjon på nytt».",
    }
  }

  return {
    success: true,
    message: `Bruker ${email} er opprettet og invitasjon er sendt.`,
  }
}

export type ResendState = { ok?: boolean; melding?: string; brukerId?: string }

export async function sendInvitasjonPaaNytt(userId: string): Promise<ResendState> {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return { ok: false, melding: "Uautorisert" }
  }

  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, passwordHash: true },
  })
  if (!bruker) return { ok: false, melding: "Bruker ikke funnet", brukerId: userId }
  if (bruker.passwordHash) {
    return { ok: false, melding: "Brukeren har allerede satt passord", brukerId: userId }
  }

  try {
    await sendInvitasjonsEpost(bruker)
  } catch (e) {
    console.error("Klarte ikke sende invitasjon på nytt:", e)
    return { ok: false, melding: "Sending feilet – sjekk SMTP-oppsett", brukerId: userId }
  }

  return { ok: true, melding: "Invitasjon sendt på nytt", brukerId: userId }
}

export type SlettState = { ok?: boolean; melding?: string }

export async function slettBruker(userId: string): Promise<SlettState> {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return { ok: false, melding: "Uautorisert" }
  }

  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
  if (!bruker) return { ok: false, melding: "Bruker ikke funnet" }

  // Administratorer kan ikke slettes (definert via ADMIN_EMAILS)
  if (isAdmin(bruker.email)) {
    return { ok: false, melding: "Administratorer kan ikke slettes" }
  }
  if (bruker.id === session.user.id) {
    return { ok: false, melding: "Du kan ikke slette din egen konto" }
  }

  // Relaterte rader (maler, sesjoner, token) fjernes via onDelete: Cascade
  await prisma.user.delete({ where: { id: userId } })
  revalidatePath("/admin/brukere")

  return { ok: true, melding: "Bruker slettet" }
}

export type Nullstill2faState = { ok?: boolean; melding?: string }

/**
 * Admin nullstiller to-faktor for en bruker (også seg selv), når telefonen og
 * gjenopprettingskodene er borte. Hemmeligheten og kodene slettes. Er to-faktor
 * obligatorisk, sendes brukeren til «Sikre kontoen» ved neste forespørsel og må
 * sette det opp på nytt før appen kan brukes. Brukeren varsles på e-post.
 */
export async function nullstill2fa(userId: string): Promise<Nullstill2faState> {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return { ok: false, melding: "Uautorisert" }
  }

  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, twoFactorEnabled: true },
  })
  if (!bruker) return { ok: false, melding: "Bruker ikke funnet" }
  if (!bruker.twoFactorEnabled) return { ok: false, melding: "To-faktor er ikke aktivert" }

  await prisma.user.update({
    where: { id: bruker.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  })
  await slettKoder(bruker.id)
  // Uten pasientdata: hvem som nullstilte for hvem, til sporbarhet
  console.info(`[2fa] nullstilt for bruker ${bruker.id} av ${session.user.email}`)
  await varsleNullstilt2fa(bruker)

  revalidatePath("/admin/brukere")
  return { ok: true, melding: "To-faktor nullstilt" }
}

/**
 * Admin sender lenke for nytt passord til en aktiv bruker — reserven når
 * brukeren ikke får til «Glemt passord» selv. Lenken bytter bare passordet;
 * to-faktor står urørt.
 */
export async function sendPassordlenkeTilBruker(userId: string): Promise<ResendState> {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return { ok: false, melding: "Uautorisert" }
  }

  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, passwordHash: true },
  })
  if (!bruker) return { ok: false, melding: "Bruker ikke funnet", brukerId: userId }
  if (!bruker.passwordHash) {
    return { ok: false, melding: "Brukeren har ikke satt passord — send invitasjonen på nytt", brukerId: userId }
  }

  try {
    await sendPassordlenke(bruker, {
      gyldigMs: TILBAKESTILLING_ADMIN_MS,
      gyldigTekst: "24 timer",
      avAdministrator: true,
    })
  } catch (e) {
    console.error("Klarte ikke sende passordlenke:", e instanceof Error ? e.message : e)
    return { ok: false, melding: "Sending feilet – sjekk SMTP-oppsett", brukerId: userId }
  }
  console.info(`[passord] lenke sendt til bruker ${bruker.id} av ${session.user.email}`)
  return { ok: true, melding: "Passordlenke sendt", brukerId: userId }
}
